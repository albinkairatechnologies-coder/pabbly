import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import CurrentUser, DbDep, get_workspace
from app.models.broadcast import Broadcast
from app.models.contact import Contact
from app.models.flow import Flow, FlowRun, FlowRunStatus
from app.models.message import Conversation, ConversationStatus, Message, MessageDirection
from app.models.workspace import Workspace

router = APIRouter(prefix="/workspaces/{workspace_id}/analytics", tags=["analytics"])
WorkspaceDep = Annotated[Workspace, Depends(get_workspace)]


@router.get("/overview")
async def analytics_overview(
    workspace_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    month_str = now.strftime("%Y-%m")

    # Messages sent today
    sent_today = await _count(db, select(func.count(Message.id)).where(
        Message.workspace_id == workspace_id,
        Message.direction == MessageDirection.outbound,
        Message.created_at >= now.replace(hour=0, minute=0, second=0, microsecond=0),
    ))

    # Messages sent this month
    sent_month = await _count(db, select(func.count(Message.id)).where(
        Message.workspace_id == workspace_id,
        Message.direction == MessageDirection.outbound,
        func.to_char(Message.created_at, "YYYY-MM") == month_str,
    ))

    # Total outbound this month for rate calculations
    total_outbound = await _count(db, select(func.count(Message.id)).where(
        Message.workspace_id == workspace_id,
        Message.direction == MessageDirection.outbound,
        func.to_char(Message.created_at, "YYYY-MM") == month_str,
    ))

    # Read messages this month (open rate proxy)
    read_count = await _count(db, select(func.count(Message.id)).where(
        Message.workspace_id == workspace_id,
        Message.status == "read",
        func.to_char(Message.created_at, "YYYY-MM") == month_str,
    ))

    # Replied (inbound after outbound — proxy: inbound count this month)
    replied_count = await _count(db, select(func.count(Message.id)).where(
        Message.workspace_id == workspace_id,
        Message.direction == MessageDirection.inbound,
        func.to_char(Message.created_at, "YYYY-MM") == month_str,
    ))

    open_rate = round(read_count / total_outbound * 100, 1) if total_outbound else 0
    reply_rate = round(replied_count / total_outbound * 100, 1) if total_outbound else 0

    # Active conversations
    active_convs = await _count(db, select(func.count(Conversation.id)).where(
        Conversation.workspace_id == workspace_id,
        Conversation.status == ConversationStatus.open,
    ))

    # Resolved today
    resolved_today = await _count(db, select(func.count(Conversation.id)).where(
        Conversation.workspace_id == workspace_id,
        Conversation.status == ConversationStatus.resolved,
        Conversation.updated_at >= now.replace(hour=0, minute=0, second=0, microsecond=0),
    ))

    # Contacts added this month
    contacts_month = await _count(db, select(func.count(Contact.id)).where(
        Contact.workspace_id == workspace_id,
        func.to_char(Contact.created_at, "YYYY-MM") == month_str,
    ))

    # Top flows by runs
    flows_result = await db.execute(
        select(Flow.name, Flow.total_runs)
        .where(Flow.workspace_id == workspace_id, Flow.is_active == True)
        .order_by(Flow.total_runs.desc())
        .limit(5)
    )
    top_flows = [{"flow_name": name, "runs": runs or 0} for name, runs in flows_result.all()]

    # Message volume chart — last 30 days
    chart = await _message_volume_chart(db, workspace_id, days=30)

    return {
        "messages_sent_today": sent_today,
        "messages_sent_month": sent_month,
        "open_rate_percent": open_rate,
        "reply_rate_percent": reply_rate,
        "active_conversations": active_convs,
        "resolved_today": resolved_today,
        "contacts_added_month": contacts_month,
        "top_flows": top_flows,
        "message_volume_chart": chart,
    }


@router.get("/messages")
async def message_analytics(
    workspace_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
    start_date: str | None = None,
    end_date: str | None = None,
    group_by: str = Query("day", pattern="^(day|week|month)$"),
):
    days = 30
    if start_date and end_date:
        try:
            d1 = datetime.fromisoformat(start_date)
            d2 = datetime.fromisoformat(end_date)
            days = (d2 - d1).days + 1
        except ValueError:
            pass

    return await _message_volume_chart(db, workspace_id, days=days)


@router.get("/flows")
async def flow_analytics(
    workspace_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    result = await db.execute(
        select(Flow).where(Flow.workspace_id == workspace_id)
    )
    flows = result.scalars().all()

    output = []
    for flow in flows:
        completed = await _count(db, select(func.count(FlowRun.id)).where(
            FlowRun.flow_id == flow.id,
            FlowRun.status == FlowRunStatus.completed,
        ))
        failed = await _count(db, select(func.count(FlowRun.id)).where(
            FlowRun.flow_id == flow.id,
            FlowRun.status == FlowRunStatus.failed,
        ))
        total = flow.total_runs or 0
        success_rate = round(completed / total * 100, 1) if total else 0
        output.append({
            "flow_id": str(flow.id),
            "name": flow.name,
            "total_runs": total,
            "completed": completed,
            "failed": failed,
            "success_rate": success_rate,
        })

    return output


@router.get("/broadcasts")
async def broadcast_analytics(
    workspace_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    result = await db.execute(
        select(Broadcast)
        .where(Broadcast.workspace_id == workspace_id)
        .order_by(Broadcast.created_at.desc())
        .limit(50)
    )
    broadcasts = result.scalars().all()
    return [
        {
            "id": str(b.id),
            "name": b.name,
            "status": b.status,
            "total_contacts": b.total_contacts,
            "sent_count": b.sent_count,
            "delivered_count": b.delivered_count,
            "read_count": b.read_count,
            "failed_count": b.failed_count,
            "sent_at": b.sent_at,
        }
        for b in broadcasts
    ]


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _count(db: AsyncSession, stmt) -> int:
    result = await db.execute(stmt)
    return result.scalar_one() or 0


async def _message_volume_chart(db: AsyncSession, workspace_id: uuid.UUID, days: int = 30) -> list:
    now = datetime.now(timezone.utc)
    result = []

    for i in range(days - 1, -1, -1):
        day = now - timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)

        sent = await _count(db, select(func.count(Message.id)).where(
            Message.workspace_id == workspace_id,
            Message.direction == MessageDirection.outbound,
            Message.created_at >= day_start,
            Message.created_at < day_end,
        ))
        received = await _count(db, select(func.count(Message.id)).where(
            Message.workspace_id == workspace_id,
            Message.direction == MessageDirection.inbound,
            Message.created_at >= day_start,
            Message.created_at < day_end,
        ))
        result.append({"date": day_str, "sent": sent, "received": received})

    return result
