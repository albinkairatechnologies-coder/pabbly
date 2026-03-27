import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import CurrentUser, DbDep, get_workspace
from app.models.contact import Contact
from app.models.message import (
    Conversation, ConversationStatus, Message,
    MessageDirection, MessageStatus, MessageType,
)
from app.models.workspace import Workspace
from app.schemas.message import AssignRequest, ConversationOut, MessageOut, NoteRequest, SendMessageRequest
from app.services.whatsapp import WhatsAppService
from app.services.ws_manager import manager

router = APIRouter(tags=["inbox"])


# ── WebSocket ─────────────────────────────────────────────────────────────────
@router.websocket("/ws/{workspace_id}")
async def websocket_endpoint(ws: WebSocket, workspace_id: uuid.UUID):
    await manager.connect(workspace_id, ws)
    try:
        while True:
            await ws.receive_text()  # keep alive; client can send pings
    except WebSocketDisconnect:
        manager.disconnect(workspace_id, ws)


# ── Conversations ─────────────────────────────────────────────────────────────
@router.get("/workspaces/{workspace_id}/conversations")
async def list_conversations(
    workspace_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace=Depends(get_workspace),
    status: str | None = None,
    assigned_to: uuid.UUID | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    q = (
        select(Conversation, Contact)
        .join(Contact, Conversation.contact_id == Contact.id)
        .where(Conversation.workspace_id == workspace_id)
    )
    if status:
        q = q.where(Conversation.status == status)
    if assigned_to:
        q = q.where(Conversation.assigned_to == assigned_to)
    if search:
        q = q.where(Contact.name.ilike(f"%{search}%") | Contact.phone_number.ilike(f"%{search}%"))

    q = q.order_by(Conversation.last_message_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(q)
    rows = result.all()

    return [
        {
            "id": str(conv.id),
            "contact_id": str(conv.contact_id),
            "status": conv.status,
            "assigned_to": str(conv.assigned_to) if conv.assigned_to else None,
            "last_message_at": conv.last_message_at,
            "unread_count": conv.unread_count,
            "contact_name": contact.name,
            "contact_phone": contact.phone_number,
        }
        for conv, contact in rows
    ]


@router.get("/workspaces/{workspace_id}/conversations/{conversation_id}/messages")
async def get_messages(
    workspace_id: uuid.UUID,
    conversation_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace=Depends(get_workspace),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    conv = await _get_conv(db, workspace_id, conversation_id)
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv.id)
        .order_by(Message.created_at.asc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    msgs = result.scalars().all()
    return [_msg_dict(m) for m in msgs]


@router.post("/workspaces/{workspace_id}/conversations/{conversation_id}/send")
async def send_message(
    workspace_id: uuid.UUID,
    conversation_id: uuid.UUID,
    body: SendMessageRequest,
    user: CurrentUser,
    db: DbDep,
    workspace: Workspace = Depends(get_workspace),
):
    conv = await _get_conv(db, workspace_id, conversation_id)
    contact_result = await db.execute(select(Contact).where(Contact.id == conv.contact_id))
    contact = contact_result.scalar_one()

    if not workspace.whatsapp_access_token or not workspace.whatsapp_phone_number_id:
        raise HTTPException(status_code=400, detail="WhatsApp not configured for this workspace")

    wa = WhatsAppService(workspace.whatsapp_access_token, workspace.whatsapp_phone_number_id)
    meta_response = await _dispatch_send(wa, contact.phone_number, body)
    meta_msg_id = meta_response.get("messages", [{}])[0].get("id")

    now = datetime.now(timezone.utc).isoformat()
    message = Message(
        workspace_id=workspace_id,
        contact_id=contact.id,
        conversation_id=conv.id,
        direction=MessageDirection.outbound,
        message_type=MessageType(body.message_type) if body.message_type in MessageType.__members__ else MessageType.text,
        content=body.content,
        status=MessageStatus.sent,
        meta_message_id=meta_msg_id,
        agent_id=user.id,
    )
    db.add(message)
    conv.last_message_at = now
    contact.total_messages_sent = (contact.total_messages_sent or 0) + 1
    await db.commit()
    await db.refresh(message)

    await manager.broadcast(workspace_id, {
        "type": "new_message",
        "conversation_id": str(conv.id),
        "message": _msg_dict(message),
    })
    return _msg_dict(message)


@router.put("/workspaces/{workspace_id}/conversations/{conversation_id}/assign")
async def assign_conversation(
    workspace_id: uuid.UUID, conversation_id: uuid.UUID,
    body: AssignRequest, user: CurrentUser, db: DbDep, workspace=Depends(get_workspace),
):
    conv = await _get_conv(db, workspace_id, conversation_id)
    conv.assigned_to = body.agent_id
    await db.commit()
    await manager.broadcast(workspace_id, {
        "type": "conversation_assigned",
        "conversation_id": str(conv.id),
        "agent_id": str(body.agent_id),
    })
    return {"assigned_to": str(body.agent_id)}


@router.put("/workspaces/{workspace_id}/conversations/{conversation_id}/resolve")
async def resolve_conversation(
    workspace_id: uuid.UUID, conversation_id: uuid.UUID,
    user: CurrentUser, db: DbDep, workspace=Depends(get_workspace),
):
    conv = await _get_conv(db, workspace_id, conversation_id)
    conv.status = ConversationStatus.resolved
    conv.unread_count = 0
    await db.commit()
    return {"status": "resolved"}


@router.put("/workspaces/{workspace_id}/conversations/{conversation_id}/reopen")
async def reopen_conversation(
    workspace_id: uuid.UUID, conversation_id: uuid.UUID,
    user: CurrentUser, db: DbDep, workspace=Depends(get_workspace),
):
    conv = await _get_conv(db, workspace_id, conversation_id)
    conv.status = ConversationStatus.open
    await db.commit()
    return {"status": "open"}


@router.post("/workspaces/{workspace_id}/conversations/{conversation_id}/note")
async def add_note(
    workspace_id: uuid.UUID, conversation_id: uuid.UUID,
    body: NoteRequest, user: CurrentUser, db: DbDep, workspace=Depends(get_workspace),
):
    conv = await _get_conv(db, workspace_id, conversation_id)
    # Store note as an internal outbound message with type "note"
    note = Message(
        workspace_id=workspace_id,
        contact_id=conv.contact_id,
        conversation_id=conv.id,
        direction=MessageDirection.outbound,
        message_type=MessageType.text,
        content={"text": body.text, "is_note": True},
        status=MessageStatus.sent,
        agent_id=user.id,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return _msg_dict(note)


# ── Helpers ───────────────────────────────────────────────────────────────────
async def _get_conv(db: AsyncSession, workspace_id: uuid.UUID, conversation_id: uuid.UUID) -> Conversation:
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.workspace_id == workspace_id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


async def _dispatch_send(wa: WhatsAppService, phone: str, body: SendMessageRequest) -> dict:
    t = body.message_type
    c = body.content
    if t == "text":
        return await wa.send_text(phone, c["text"])
    if t == "image":
        return await wa.send_image(phone, c["url"], c.get("caption", ""))
    if t == "document":
        return await wa.send_document(phone, c["url"], c.get("filename", "file"))
    if t == "audio":
        return await wa.send_audio(phone, c["url"])
    if t == "video":
        return await wa.send_video(phone, c["url"], c.get("caption", ""))
    if t == "template":
        return await wa.send_template(phone, c["name"], c.get("language", "en"), c.get("components", []))
    if t == "buttons":
        return await wa.send_interactive_buttons(phone, c["body"], c["buttons"])
    if t == "list":
        return await wa.send_interactive_list(phone, c["body"], c["button_text"], c["sections"])
    raise HTTPException(status_code=400, detail=f"Unsupported message type: {t}")


def _msg_dict(m: Message) -> dict:
    return {
        "id": str(m.id),
        "direction": m.direction,
        "message_type": m.message_type,
        "content": m.content,
        "status": m.status,
        "meta_message_id": m.meta_message_id,
        "agent_id": str(m.agent_id) if m.agent_id else None,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }
