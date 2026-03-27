import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class Contact(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "contacts"

    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True)
    phone_number: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    tags: Mapped[list] = mapped_column(ARRAY(String), default=list)
    custom_fields: Mapped[dict] = mapped_column(JSONB, default=dict)
    opted_in: Mapped[bool] = mapped_column(Boolean, default=True)
    last_seen: Mapped[str | None] = mapped_column(String(50))
    total_messages_sent: Mapped[int] = mapped_column(Integer, default=0)
    total_messages_received: Mapped[int] = mapped_column(Integer, default=0)

    __table_args__ = (
        # unique phone per workspace enforced via UniqueConstraint
        __import__("sqlalchemy").UniqueConstraint("workspace_id", "phone_number", name="uq_contact_workspace_phone"),
    )


class ContactTag(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "contact_tags"

    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#6366f1")
