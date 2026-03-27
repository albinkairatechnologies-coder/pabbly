import uuid
from typing import Any
from pydantic import BaseModel


class ContactCreate(BaseModel):
    phone_number: str
    name: str | None = None
    email: str | None = None
    tags: list[str] = []
    custom_fields: dict[str, Any] = {}


class ContactUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    tags: list[str] | None = None
    custom_fields: dict[str, Any] | None = None
    opted_in: bool | None = None


class ContactOut(BaseModel):
    id: uuid.UUID
    phone_number: str
    name: str | None
    email: str | None
    tags: list[str]
    custom_fields: dict[str, Any]
    opted_in: bool
    last_seen: str | None
    total_messages_sent: int
    total_messages_received: int

    model_config = {"from_attributes": True}


class SegmentFilter(BaseModel):
    field: str       # tag / phone / name / last_seen / opted_in
    operator: str    # contains / not_contains / equals / before / after / is_true / is_false
    value: str = ""


class SegmentPreviewRequest(BaseModel):
    filters: list[SegmentFilter]


class PaginatedContacts(BaseModel):
    items: list[ContactOut]
    total: int
    page: int
    limit: int
