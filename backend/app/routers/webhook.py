from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request
from fastapi.responses import Response
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.contact import Contact
from app.models.message import Conversation, ConversationStatus, Message, MessageDirection, MessageStatus, MessageType
from app.models.workspace import Workspace
from app.services.ws_manager import manager

router = APIRouter(prefix="/webhook", tags=["webhook"])


# ── Test endpoint ──────────────────────────────────────────────────────────────────
@router.get("/test")
async def test_webhook():
    """Test endpoint to verify webhook is accessible"""
    return {
        "status": "ok",
        "message": "Webhook endpoint is accessible",
        "verify_token": settings.META_WEBHOOK_VERIFY_TOKEN,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── Verify handshake ──────────────────────────────────────────────────────────
@router.get("/whatsapp")
async def verify_webhook(
    hub_mode: str = Query(alias="hub.mode", default=""),
    hub_verify_token: str = Query(alias="hub.verify_token", default=""),
    hub_challenge: str = Query(alias="hub.challenge", default=""),
):
    """Meta WhatsApp webhook verification endpoint"""
    print(f"[WEBHOOK VERIFY] mode={hub_mode}, token={hub_verify_token}, challenge={hub_challenge}")
    print(f"[WEBHOOK VERIFY] Expected token: {settings.META_WEBHOOK_VERIFY_TOKEN}")
    
    if hub_mode == "subscribe" and hub_verify_token == settings.META_WEBHOOK_VERIFY_TOKEN:
        print("[WEBHOOK VERIFY] ✅ Success - returning challenge")
        return int(hub_challenge)
    
    print("[WEBHOOK VERIFY] ❌ Failed - token mismatch or invalid mode")
    raise HTTPException(status_code=403, detail="Verification failed")


# ── Meta inbound webhook ──────────────────────────────────────────────────────
@router.post("/whatsapp")
async def receive_webhook(request: Request, background: BackgroundTasks):
    payload = await request.json()
    background.add_task(_process_webhook, payload)
    return {"status": "ok"}


# ── Twilio inbound webhook ────────────────────────────────────────────────────
@router.post("/twilio")
async def receive_twilio_webhook(request: Request, background: BackgroundTasks):
    form = await request.form()
    payload = dict(form)
    background.add_task(_process_twilio_webhook, payload)
    # Twilio expects TwiML response
    return Response(content="<Response></Response>", media_type="application/xml")


async def _process_webhook(payload: dict):
    async with AsyncSessionLocal() as db:
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                phone_number_id = value.get("metadata", {}).get("phone_number_id")

                workspace = await _get_workspace_by_phone(db, phone_number_id)
                if not workspace:
                    continue

                # Handle inbound messages
                for msg in value.get("messages", []):
                    contact_name = None
                    for c in value.get("contacts", []):
                        contact_name = c.get("profile", {}).get("name")

                    await _handle_inbound_message(db, workspace, msg, contact_name)

                # Handle status updates
                for status in value.get("statuses", []):
                    await _handle_status_update(db, workspace, status)

        await db.commit()


async def _get_workspace_by_phone(db: AsyncSession, phone_number_id: str | None) -> Workspace | None:
    if not phone_number_id:
        return None
    result = await db.execute(
        select(Workspace).where(Workspace.whatsapp_phone_number_id == phone_number_id)
    )
    return result.scalar_one_or_none()


async def _handle_inbound_message(db: AsyncSession, workspace: Workspace, msg: dict, contact_name: str | None):
    phone = msg["from"]
    meta_msg_id = msg["id"]
    msg_type = msg.get("type", "text")
    now = datetime.now(timezone.utc).isoformat()

    # Upsert contact
    result = await db.execute(
        select(Contact).where(
            Contact.workspace_id == workspace.id,
            Contact.phone_number == phone,
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        contact = Contact(
            workspace_id=workspace.id,
            phone_number=phone,
            name=contact_name,
            last_seen=now,
        )
        db.add(contact)
        await db.flush()
    else:
        contact.last_seen = now
        if contact_name and not contact.name:
            contact.name = contact_name

    # Upsert conversation
    conv_result = await db.execute(
        select(Conversation).where(
            Conversation.workspace_id == workspace.id,
            Conversation.contact_id == contact.id,
        )
    )
    conversation = conv_result.scalar_one_or_none()
    if not conversation:
        conversation = Conversation(
            workspace_id=workspace.id,
            contact_id=contact.id,
            status=ConversationStatus.open,
            last_message_at=now,
            unread_count=1,
        )
        db.add(conversation)
        await db.flush()
    else:
        conversation.last_message_at = now
        conversation.unread_count = (conversation.unread_count or 0) + 1
        if conversation.status == ConversationStatus.resolved:
            conversation.status = ConversationStatus.open

    # Build content JSONB
    content = _extract_content(msg, msg_type)

    message = Message(
        workspace_id=workspace.id,
        contact_id=contact.id,
        conversation_id=conversation.id,
        direction=MessageDirection.inbound,
        message_type=_map_type(msg_type),
        content=content,
        status=MessageStatus.delivered,
        meta_message_id=meta_msg_id,
    )
    db.add(message)
    await db.flush()

    contact.total_messages_received = (contact.total_messages_received or 0) + 1

    # ── Trigger matching flows ────────────────────────────────────────────────
    await _trigger_matching_flows(db, workspace, contact, msg, content, conversation)

    # Broadcast to live inbox
    await manager.broadcast(workspace.id, {
        "type": "new_message",
        "conversation_id": str(conversation.id),
        "message": {
            "id": str(message.id),
            "direction": "inbound",
            "message_type": msg_type,
            "content": content,
            "meta_message_id": meta_msg_id,
            "created_at": now,
            "contact": {"id": str(contact.id), "name": contact.name, "phone": phone},
        },
    })


async def _handle_status_update(db: AsyncSession, workspace: Workspace, status_obj: dict):
    meta_id = status_obj.get("id")
    new_status = status_obj.get("status")  # sent / delivered / read / failed

    status_map = {
        "sent": MessageStatus.sent,
        "delivered": MessageStatus.delivered,
        "read": MessageStatus.read,
        "failed": MessageStatus.failed,
    }
    mapped = status_map.get(new_status)
    if not mapped or not meta_id:
        return

    await db.execute(
        update(Message)
        .where(Message.meta_message_id == meta_id, Message.workspace_id == workspace.id)
        .values(status=mapped)
    )

    await manager.broadcast(workspace.id, {
        "type": "status_update",
        "meta_message_id": meta_id,
        "status": new_status,
    })


def _extract_content(msg: dict, msg_type: str) -> dict:
    if msg_type == "text":
        return {"text": msg.get("text", {}).get("body", "")}
    if msg_type in ("image", "video", "audio", "document", "sticker"):
        media = msg.get(msg_type, {})
        return {
            "media_id": media.get("id"),
            "mime_type": media.get("mime_type"),
            "caption": media.get("caption", ""),
            "filename": media.get("filename"),
            "sha256": media.get("sha256"),
        }
    if msg_type == "interactive":
        interactive = msg.get("interactive", {})
        itype = interactive.get("type")
        if itype == "button_reply":
            return {"type": "button_reply", **interactive.get("button_reply", {})}
        if itype == "list_reply":
            return {"type": "list_reply", **interactive.get("list_reply", {})}
    if msg_type == "location":
        return msg.get("location", {})
    if msg_type == "contacts":
        return {"contacts": msg.get("contacts", [])}
    return {"raw": msg}


def _map_type(msg_type: str) -> MessageType:
    mapping = {
        "text": MessageType.text,
        "image": MessageType.image,
        "document": MessageType.document,
        "audio": MessageType.audio,
        "video": MessageType.video,
        "interactive": MessageType.interactive,
        "template": MessageType.template,
    }
    return mapping.get(msg_type, MessageType.text)


async def _trigger_matching_flows(
    db: AsyncSession,
    workspace: Workspace,
    contact,
    msg: dict,
    content: dict,
    conversation,
):
    from app.models.flow import Flow, FlowRun, FlowRunStatus
    from app.services.flow_engine import FlowEngine

    message_text = content.get("text", "").lower().strip()
    is_first_message = contact.total_messages_received == 1

    flows_result = await db.execute(
        select(Flow).where(Flow.workspace_id == workspace.id, Flow.is_active == True)
    )
    flows = flows_result.scalars().all()

    # Resume any waiting flow run first (wait_for_reply)
    waiting_result = await db.execute(
        select(FlowRun).where(
            FlowRun.workspace_id == workspace.id,
            FlowRun.contact_id == contact.id,
            FlowRun.status == FlowRunStatus.waiting,
        ).limit(1)
    )
    waiting_run = waiting_result.scalar_one_or_none()
    if waiting_run:
        engine = FlowEngine(db, workspace)
        await engine.resume_flow(
            waiting_run.id,
            {"message": message_text, "contact_id": str(contact.id),
             "button_id": content.get("id", ""), "list_id": content.get("id", "")},
        )
        return

    engine = FlowEngine(db, workspace)
    context = {
        "message": message_text,
        "contact_id": str(contact.id),
        "meta_message_id": msg.get("id"),
        "contact_tags": contact.tags or [],
        "button_id": content.get("id", ""),
        "list_id": content.get("id", ""),
    }

    for flow in flows:
        triggered = False
        cfg = flow.trigger_config or {}
        trigger = flow.trigger_type

        # Map new frontend trigger types to existing TriggerType enum values
        trigger_str = str(trigger).replace("TriggerType.", "")

        # First message
        if trigger_str in ("first_message", "trigger_first") and is_first_message:
            triggered = True

        # Keyword
        elif trigger_str in ("keyword", "trigger_keyword") and message_text:
            raw = cfg.get("keywords", cfg.get("keyword", ""))
            if not raw and flow.nodes:
                # fallback: read from trigger node data directly
                for n in flow.nodes:
                    if str(n.get("type", "")).startswith("trigger"):
                        raw = n.get("data", {}).get("keyword", n.get("data", {}).get("keywords", ""))
                        break
            keywords = [k.strip().lower() for k in raw.split(",") if k.strip()]
            match_type = cfg.get("match_type", "contains")
            for kw in keywords:
                if match_type == "exact" and message_text == kw:
                    triggered = True; break
                elif match_type == "starts_with" and message_text.startswith(kw):
                    triggered = True; break
                elif match_type == "regex":
                    import re as _re
                    if _re.search(kw, message_text):
                        triggered = True; break
                elif kw in message_text:  # contains (default)
                    triggered = True; break

        # Opt-in
        elif trigger_str in ("opt_in", "trigger_optin") and contact.opted_in:
            triggered = is_first_message  # fire on first message after opt-in

        # Button reply
        elif trigger_str in ("button_reply", "trigger_button"):
            if content.get("type") == "button_reply":
                expected = cfg.get("button_id", "")
                if not expected or content.get("id") == expected:
                    triggered = True

        # List reply
        elif trigger_str in ("list_reply", "trigger_list"):
            if content.get("type") == "list_reply":
                expected = cfg.get("list_id", "")
                if not expected or content.get("id") == expected:
                    triggered = True

        if triggered:
            try:
                await engine.trigger_flow(
                    flow_id=flow.id,
                    contact_id=contact.id,
                    context=context,
                    workspace_id=workspace.id,
                )
            except Exception:
                pass


async def _process_twilio_webhook(payload: dict):
    """
    Process inbound Twilio WhatsApp message.
    Twilio sends form data with fields: From, To, Body, MessageSid, NumMedia, MediaUrl0 etc.
    """
    async with AsyncSessionLocal() as db:
        # Extract fields from Twilio payload
        from_number = payload.get("From", "").replace("whatsapp:", "")
        to_number = payload.get("To", "").replace("whatsapp:", "")
        body = payload.get("Body", "")
        message_sid = payload.get("MessageSid", "")
        num_media = int(payload.get("NumMedia", 0))

        if not from_number:
            return

        # Find workspace by Twilio number
        result = await db.execute(
            select(Workspace).where(Workspace.twilio_whatsapp_number == to_number)
        )
        workspace = result.scalar_one_or_none()
        if not workspace:
            # Try without + prefix
            result = await db.execute(
                select(Workspace).where(
                    Workspace.twilio_whatsapp_number.in_([to_number, f"+{to_number}"])
                )
            )
            workspace = result.scalar_one_or_none()
        if not workspace:
            return

        # Build a Meta-compatible msg dict
        msg_type = "text"
        content: dict = {"text": body}

        if num_media > 0:
            media_url = payload.get("MediaUrl0", "")
            media_type = payload.get("MediaContentType0", "")
            if "image" in media_type:
                msg_type = "image"
                content = {"media_id": message_sid, "caption": body, "url": media_url}
            elif "audio" in media_type:
                msg_type = "audio"
                content = {"media_id": message_sid, "url": media_url}
            elif "video" in media_type:
                msg_type = "video"
                content = {"media_id": message_sid, "caption": body, "url": media_url}
            else:
                msg_type = "document"
                content = {"media_id": message_sid, "url": media_url}

        now = datetime.now(timezone.utc).isoformat()

        # Upsert contact
        contact_result = await db.execute(
            select(Contact).where(
                Contact.workspace_id == workspace.id,
                Contact.phone_number == from_number,
            )
        )
        contact = contact_result.scalar_one_or_none()
        if not contact:
            contact = Contact(
                workspace_id=workspace.id,
                phone_number=from_number,
                last_seen=now,
            )
            db.add(contact)
            await db.flush()
        else:
            contact.last_seen = now

        # Upsert conversation
        conv_result = await db.execute(
            select(Conversation).where(
                Conversation.workspace_id == workspace.id,
                Conversation.contact_id == contact.id,
            )
        )
        conversation = conv_result.scalar_one_or_none()
        if not conversation:
            conversation = Conversation(
                workspace_id=workspace.id,
                contact_id=contact.id,
                status=ConversationStatus.open,
                last_message_at=now,
                unread_count=1,
            )
            db.add(conversation)
            await db.flush()
        else:
            conversation.last_message_at = now
            conversation.unread_count = (conversation.unread_count or 0) + 1

        message = Message(
            workspace_id=workspace.id,
            contact_id=contact.id,
            conversation_id=conversation.id,
            direction=MessageDirection.inbound,
            message_type=_map_type(msg_type),
            content=content,
            status=MessageStatus.delivered,
            meta_message_id=message_sid,
        )
        db.add(message)
        await db.flush()

        contact.total_messages_received = (contact.total_messages_received or 0) + 1

        # Trigger flows
        fake_msg = {"from": from_number, "id": message_sid, "type": msg_type}
        await _trigger_matching_flows(db, workspace, contact, fake_msg, content, conversation)

        # Broadcast to live inbox
        await manager.broadcast(workspace.id, {
            "type": "new_message",
            "conversation_id": str(conversation.id),
            "message": {
                "id": str(message.id),
                "direction": "inbound",
                "message_type": msg_type,
                "content": content,
                "meta_message_id": message_sid,
                "created_at": now,
                "contact": {"id": str(contact.id), "name": contact.name, "phone": from_number},
            },
        })

        await db.commit()
