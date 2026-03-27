import uuid
import enum

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class TemplateCategory(str, enum.Enum):
    marketing = "marketing"
    utility = "utility"
    authentication = "authentication"


class TemplateStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class Template(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "templates"

    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[TemplateCategory] = mapped_column(Enum(TemplateCategory), nullable=False)
    language: Mapped[str] = mapped_column(String(10), default="en")
    status: Mapped[TemplateStatus] = mapped_column(Enum(TemplateStatus), default=TemplateStatus.pending)
    components: Mapped[list] = mapped_column(JSONB, default=list)
    meta_template_id: Mapped[str | None] = mapped_column(String(255))
    rejection_reason: Mapped[str | None] = mapped_column(Text)
