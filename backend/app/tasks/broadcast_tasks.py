import asyncio
import time
from datetime import datetime, timezone

from app.tasks.celery_app import celery_app


def _run(coro):
    """Run an async coroutine from a sync Celery task."""
    return asyncio.get_event_loop().run_until_complete(coro)


@celery_app.task(name="app.tasks.broadcast_tasks.send_broadcast_task", bind=True, max_retries=3)
def send_broadcast_task(self, broadcast_id: str):
    """
    1. Load broadcast + template + workspace
    2. Query matching contacts in batches of 100
    3. Send template message to each contact
    4. Rate limit: ~80 msg/sec (0.013s sleep between sends)
    5. Update counts in real-time
    6. Mark broadcast sent/failed when done
    """
    _run(_send_broadcast_async(broadcast_id))


async def _send_broadcast_async(broadcast_id: str):
    import uuid
    from sqlalchemy import select, update, func
    from app.database import AsyncSessionLocal
    from app.models.broadcast import Broadcast, BroadcastStatus
    from app.models.contact import Contact
    from app.models.template import Template
    from app.models.workspace import Workspace
    from app.services.whatsapp import WhatsAppService

    async with AsyncSessionLocal() as db:
        # Load broadcast
        result = await db.execute(select(Broadcast).where(Broadcast.id == uuid.UUID(broadcast_id)))
        broadcast = result.scalar_one_or_none()
        if not broadcast:
            return

        # Load template
        t_result = await db.execute(select(Template).where(Template.id == broadcast.template_id))
        template = t_result.scalar_one_or_none()
        if not template:
            broadcast.status = BroadcastStatus.failed
            await db.commit()
            return

        # Load workspace
        ws_result = await db.execute(select(Workspace).where(Workspace.id == broadcast.workspace_id))
        workspace = ws_result.scalar_one_or_none()
        if not workspace or not workspace.whatsapp_access_token:
            broadcast.status = BroadcastStatus.failed
            await db.commit()
            return

        wa = WhatsAppService(workspace.whatsapp_access_token, workspace.whatsapp_phone_number_id)

        # Count total matching contacts
        contact_q = select(Contact).where(
            Contact.workspace_id == broadcast.workspace_id,
            Contact.opted_in == True,
        )
        count_result = await db.execute(select(func.count()).select_from(contact_q.subquery()))
        total = count_result.scalar_one()
        broadcast.total_contacts = total
        await db.commit()

        # Send in batches of 100
        sent = delivered = failed = 0
        offset = 0
        batch_size = 100

        while offset < total:
            batch_result = await db.execute(
                contact_q.offset(offset).limit(batch_size)
            )
            contacts = batch_result.scalars().all()
            if not contacts:
                break

            for contact in contacts:
                try:
                    await wa.send_template(
                        to=contact.phone_number,
                        template_name=template.name,
                        language=template.language,
                        components=[],
                    )
                    sent += 1
                    contact.total_messages_sent = (contact.total_messages_sent or 0) + 1
                except Exception:
                    failed += 1

                # Meta rate limit: ~80 msg/sec
                time.sleep(0.013)

            # Update counts after each batch
            broadcast.sent_count = sent
            broadcast.failed_count = failed
            await db.commit()
            offset += batch_size

        broadcast.status = BroadcastStatus.sent if failed < total else BroadcastStatus.failed
        broadcast.sent_at = datetime.now(timezone.utc).isoformat()
        broadcast.sent_count = sent
        broadcast.failed_count = failed
        await db.commit()


@celery_app.task(name="app.tasks.broadcast_tasks.check_scheduled_broadcasts")
def check_scheduled_broadcasts():
    """Celery beat task — every 60s, fire any broadcasts whose scheduled_at has passed."""
    _run(_check_scheduled_async())


async def _check_scheduled_async():
    from sqlalchemy import select
    from app.database import AsyncSessionLocal
    from app.models.broadcast import Broadcast, BroadcastStatus
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Broadcast).where(
                Broadcast.status == BroadcastStatus.scheduled,
                Broadcast.scheduled_at <= now,
            )
        )
        due = result.scalars().all()
        for broadcast in due:
            broadcast.status = BroadcastStatus.sending
            await db.commit()
            send_broadcast_task.delay(str(broadcast.id))
