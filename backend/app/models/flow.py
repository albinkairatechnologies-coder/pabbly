import uuid
import enum

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class TriggerType(str, enum.Enum):
    keyword = "keyword"
    webhook = "webhook"
    api = "api"
    schedule = "schedule"
    opt_in = "opt_in"
    first_message = "first_message"
    button_reply = "button_reply"
    list_reply = "list_reply"


class FlowRunStatus(str, enum.Enum):
    running = "running"
    completed = "completed"
    failed = "failed"
    waiting = "waiting"


class Flow(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "flows"

    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    trigger_type: Mapped[TriggerType] = mapped_column(Enum(TriggerType), nullable=False)
    trigger_config: Mapped[dict] = mapped_column(JSONB, default=dict)
    nodes: Mapped[list] = mapped_column(JSONB, default=list)
    edges: Mapped[list] = mapped_column(JSONB, default=list)
    total_runs: Mapped[int] = mapped_column(Integer, default=0)
    last_run_at: Mapped[str | None] = mapped_column(String(50))


class FlowRun(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "flow_runs"

    flow_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("flows.id"), nullable=False, index=True)
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    contact_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("contacts.id"), nullable=False)
    status: Mapped[FlowRunStatus] = mapped_column(Enum(FlowRunStatus), default=FlowRunStatus.running)
    current_node_id: Mapped[str | None] = mapped_column(String(100))
    context: Mapped[dict] = mapped_column(JSONB, default=dict)
    started_at: Mapped[str | None] = mapped_column(String(50))
    completed_at: Mapped[str | None] = mapped_column(String(50))


class FlowRunLog(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "flow_run_logs"

    flow_run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("flow_runs.id"), nullable=False, index=True)
    node_id: Mapped[str] = mapped_column(String(100), nullable=False)
    node_type: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    input: Mapped[dict] = mapped_column(JSONB, default=dict)
    output: Mapped[dict] = mapped_column(JSONB, default=dict)
    error: Mapped[str | None] = mapped_column(Text)
    executed_at: Mapped[str | None] = mapped_column(String(50))
