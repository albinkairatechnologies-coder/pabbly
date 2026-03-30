import uuid
from pydantic import BaseModel


class WorkspaceCreate(BaseModel):
    name: str


class WorkspaceUpdate(BaseModel):
    name: str | None = None


class WhatsAppCredentials(BaseModel):
    phone_number_id: str
    access_token: str
    business_account_id: str


class MemberInvite(BaseModel):
    email: str
    role: str = "agent"


class WorkspaceOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    plan: str
    is_active: bool
    whatsapp_phone_number_id: str | None
    whatsapp_provider: str | None = "meta"
    twilio_whatsapp_number: str | None = None

    model_config = {"from_attributes": True}


class MemberOut(BaseModel):
    user_id: uuid.UUID
    role: str
    user_email: str | None = None
    user_name: str | None = None

    model_config = {"from_attributes": True}
