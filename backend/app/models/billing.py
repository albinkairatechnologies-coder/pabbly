import uuid
import enum

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class SubscriptionStatus(str, enum.Enum):
    active = "active"
    cancelled = "cancelled"
    past_due = "past_due"
    halted = "halted"


class Subscription(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "subscriptions"

    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, unique=True)
    plan: Mapped[str] = mapped_column(String(50), default="free")
    status: Mapped[SubscriptionStatus] = mapped_column(Enum(SubscriptionStatus), default=SubscriptionStatus.active)
    razorpay_subscription_id: Mapped[str | None] = mapped_column(String(255))
    razorpay_customer_id: Mapped[str | None] = mapped_column(String(255))
    current_period_start: Mapped[str | None] = mapped_column(String(50))
    current_period_end: Mapped[str | None] = mapped_column(String(50))
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False)


class UsageRecord(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "usage_records"

    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True)
    month: Mapped[str] = mapped_column(String(7), nullable=False)  # YYYY-MM
    messages_sent: Mapped[int] = mapped_column(Integer, default=0)
    broadcasts_sent: Mapped[int] = mapped_column(Integer, default=0)
    contacts_created: Mapped[int] = mapped_column(Integer, default=0)
    flows_executed: Mapped[int] = mapped_column(Integer, default=0)
    api_calls: Mapped[int] = mapped_column(Integer, default=0)
