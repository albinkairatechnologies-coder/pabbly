import asyncio

from app.tasks.celery_app import celery_app


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@celery_app.task(name="app.tasks.flow_tasks.execute_flow_delay")
def execute_flow_delay(flow_run_id: str):
    """Resume a flow run that was paused by a wait/delay node."""
    _run(_resume_flow_async(flow_run_id))


async def _resume_flow_async(flow_run_id: str):
    import uuid
    from sqlalchemy import select
    from app.database import AsyncSessionLocal
    from app.models.flow import FlowRun
    from app.models.workspace import Workspace
    from app.services.flow_engine import FlowEngine

    async with AsyncSessionLocal() as db:
        run_result = await db.execute(select(FlowRun).where(FlowRun.id == uuid.UUID(flow_run_id)))
        run = run_result.scalar_one_or_none()
        if not run:
            return

        ws_result = await db.execute(select(Workspace).where(Workspace.id == run.workspace_id))
        workspace = ws_result.scalar_one_or_none()
        if not workspace:
            return

        engine = FlowEngine(db, workspace)
        await engine.resume_flow(run.id, {})


@celery_app.task(name="app.tasks.flow_tasks.trigger_scheduled_flows")
def trigger_scheduled_flows():
    """Celery beat task — every 60s, fire all active schedule_trigger flows."""
    _run(_trigger_scheduled_async())


async def _trigger_scheduled_async():
    from sqlalchemy import select
    from app.database import AsyncSessionLocal
    from app.models.flow import Flow, TriggerType
    from app.models.contact import Contact
    from app.models.workspace import Workspace
    from app.services.flow_engine import FlowEngine
    from datetime import datetime, timezone

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Flow).where(
                Flow.trigger_type == TriggerType.schedule,
                Flow.is_active == True,
            )
        )
        flows = result.scalars().all()

        for flow in flows:
            ws_result = await db.execute(select(Workspace).where(Workspace.id == flow.workspace_id))
            workspace = ws_result.scalar_one_or_none()
            if not workspace:
                continue

            # Get all opted-in contacts for this workspace
            contacts_result = await db.execute(
                select(Contact).where(
                    Contact.workspace_id == flow.workspace_id,
                    Contact.opted_in == True,
                ).limit(1000)
            )
            contacts = contacts_result.scalars().all()

            engine = FlowEngine(db, workspace)
            for contact in contacts:
                try:
                    await engine.trigger_flow(
                        flow_id=flow.id,
                        contact_id=contact.id,
                        context={"trigger": "schedule", "contact_id": str(contact.id)},
                        workspace_id=flow.workspace_id,
                    )
                except Exception:
                    pass
