import uuid
from typing import Any
from pydantic import BaseModel


class SendMessageRequest(BaseModel):
    message_type: str = "text"   # text / image / document / audio / video / template / buttons / list
    content: dict[str, Any]      # {"text": "..."} or {"url": "...", "caption": "..."} etc.


class AssignRequest(BaseModel):
    agent_id: uuid.UUID


class NoteRequest(BaseModel):
    text: str


class ConversationOut(BaseModel):
    id: uuid.UUID
    contact_id: uuid.UUID
    status: str
    assigned_to: uuid.UUID | None
    last_message_at: str | None
    unread_count: int
    contact_name: str | None = None
    contact_phone: str | None = None

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: uuid.UUID
    direction: str
    message_type: str
    content: dict[str, Any]
    status: str
    meta_message_id: str | None
    agent_id: uuid.UUID | None
    created_at: str | None

    model_config = {"from_attributes": True}
