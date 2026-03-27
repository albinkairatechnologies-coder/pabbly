import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import CurrentUser, DbDep, get_workspace
from app.models.broadcast import Broadcast, BroadcastStatus
from app.models.template import Template
from app.models.workspace import Workspace

router = APIRouter(prefix="/workspaces/{workspace_id}/broadcasts", tags=["broadcasts"])
WorkspaceDep = Annotated[Workspace, Depends(get_workspace)]


# ── Schemas ───────────────────────────────────────────────────────────────────
class BroadcastCreate(BaseModel):
    name: str
    template_id: uuid.UUID
    template_variables: dict = {}
    segment_filter: dict = {}
    scheduled_at: str | None = None


class BroadcastOut(BaseModel):
    id: uuid.UUID
    name: str
    status: str
    template_id: uuid.UUID | None
    segment_filter: dict
    scheduled_at: str | None
    sent_at: str | None
    total_contacts: int
    sent_count: int
    delivered_count: int
    read_count: int
    failed_count: int

    model_config = {"from_attributes": True}


# ── List ──────────────────────────────────────────────────────────────────────
@router.get("/", response_model=list[BroadcastOut])
async def list_broadcasts(
    workspace_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    result = await db.execute(
        select(Broadcast)
        .where(Broadcast.workspace_id == workspace_id)
        .order_by(Broadcast.created_at.desc())
    )
    return result.scalars().all()


# ── Create ────────────────────────────────────────────────────────────────────
@router.post("/", response_model=BroadcastOut, status_code=201)
async def create_broadcast(
    workspace_id: uuid.UUID,
    body: BroadcastCreate,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    # Verify template exists in this workspace
    t_result = await db.execute(
        select(Template).where(Template.id == body.template_id, Template.workspace_id == workspace_id)
    )
    if not t_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Template not found")

    broadcast = Broadcast(
        workspace_id=workspace_id,
        name=body.name,
        template_id=body.template_id,
        segment_filter=body.segment_filter,
        scheduled_at=body.scheduled_at,
        status=BroadcastStatus.scheduled if body.scheduled_at else BroadcastStatus.draft,
    )
    db.add(broadcast)
    await db.commit()
    await db.refresh(broadcast)
    return broadcast


# ── Get single ────────────────────────────────────────────────────────────────
@router.get("/{broadcast_id}", response_model=BroadcastOut)
async def get_broadcast(
    workspace_id: uuid.UUID,
    broadcast_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    return await _get_or_404(db, workspace_id, broadcast_id)


# ── Delete ────────────────────────────────────────────────────────────────────
@router.delete("/{broadcast_id}", status_code=204)
async def delete_broadcast(
    workspace_id: uuid.UUID,
    broadcast_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    broadcast = await _get_or_404(db, workspace_id, broadcast_id)
    if broadcast.status == BroadcastStatus.sending:
        raise HTTPException(status_code=400, detail="Cannot delete a broadcast that is currently sending")
    await db.delete(broadcast)
    await db.commit()


# ── Send now ──────────────────────────────────────────────────────────────────
@router.post("/{broadcast_id}/send")
async def send_broadcast(
    workspace_id: uuid.UUID,
    broadcast_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    broadcast = await _get_or_404(db, workspace_id, broadcast_id)
    if broadcast.status == BroadcastStatus.sending:
        raise HTTPException(status_code=400, detail="Broadcast is already sending")
    if broadcast.status == BroadcastStatus.sent:
        raise HTTPException(status_code=400, detail="Broadcast already sent")

    broadcast.status = BroadcastStatus.sending
    await db.commit()

    # Dispatch Celery task
    from app.tasks.broadcast_tasks import send_broadcast_task
    send_broadcast_task.delay(str(broadcast_id))

    return {"status": "sending", "broadcast_id": str(broadcast_id)}


# ── Cancel scheduled ──────────────────────────────────────────────────────────
@router.post("/{broadcast_id}/cancel")
async def cancel_broadcast(
    workspace_id: uuid.UUID,
    broadcast_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    broadcast = await _get_or_404(db, workspace_id, broadcast_id)
    if broadcast.status not in (BroadcastStatus.scheduled, BroadcastStatus.draft):
        raise HTTPException(status_code=400, detail="Only scheduled or draft broadcasts can be cancelled")
    broadcast.status = BroadcastStatus.draft
    broadcast.scheduled_at = None
    await db.commit()
    return {"status": "cancelled"}


# ── Delivery report ───────────────────────────────────────────────────────────
@router.get("/{broadcast_id}/report")
async def broadcast_report(
    workspace_id: uuid.UUID,
    broadcast_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    broadcast = await _get_or_404(db, workspace_id, broadcast_id)
    total = broadcast.total_contacts or 1  # avoid division by zero
    return {
        "id": str(broadcast.id),
        "name": broadcast.name,
        "status": broadcast.status,
        "total_contacts": broadcast.total_contacts,
        "sent_count": broadcast.sent_count,
        "delivered_count": broadcast.delivered_count,
        "read_count": broadcast.read_count,
        "failed_count": broadcast.failed_count,
        "delivery_rate": round(broadcast.delivered_count / total * 100, 1),
        "read_rate": round(broadcast.read_count / total * 100, 1),
        "failure_rate": round(broadcast.failed_count / total * 100, 1),
        "sent_at": broadcast.sent_at,
        "scheduled_at": broadcast.scheduled_at,
    }


# ── Helper ────────────────────────────────────────────────────────────────────
async def _get_or_404(db: AsyncSession, workspace_id: uuid.UUID, broadcast_id: uuid.UUID) -> Broadcast:
    result = await db.execute(
        select(Broadcast).where(Broadcast.id == broadcast_id, Broadcast.workspace_id == workspace_id)
    )
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    return b
