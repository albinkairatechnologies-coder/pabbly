import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import CurrentUser, DbDep, get_workspace
from app.models.flow import Flow, FlowRun, FlowRunLog, FlowRunStatus, TriggerType
from app.models.workspace import Workspace

router = APIRouter(prefix="/workspaces/{workspace_id}/flows", tags=["flows"])
WorkspaceDep = Annotated[Workspace, Depends(get_workspace)]


# ── Schemas ───────────────────────────────────────────────────────────────────
class FlowCreate(BaseModel):
    name: str
    description: str = ""
    trigger_type: str = "keyword"
    trigger_config: dict = {}


class FlowUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    trigger_type: str | None = None
    trigger_config: dict | None = None
    nodes: list | None = None
    edges: list | None = None


class FlowOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    is_active: bool
    trigger_type: str
    trigger_config: dict
    nodes: list
    edges: list
    total_runs: int
    last_run_at: str | None

    model_config = {"from_attributes": True}


class FlowRunOut(BaseModel):
    id: uuid.UUID
    flow_id: uuid.UUID
    contact_id: uuid.UUID
    status: str
    current_node_id: str | None
    context: dict
    started_at: str | None
    completed_at: str | None

    model_config = {"from_attributes": True}


# ── List ──────────────────────────────────────────────────────────────────────
@router.get("/", response_model=list[FlowOut])
async def list_flows(
    workspace_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    result = await db.execute(
        select(Flow).where(Flow.workspace_id == workspace_id).order_by(Flow.created_at.desc())
    )
    return result.scalars().all()


# ── Create ────────────────────────────────────────────────────────────────────
@router.post("/", response_model=FlowOut, status_code=201)
async def create_flow(
    workspace_id: uuid.UUID,
    body: FlowCreate,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    try:
        trigger = TriggerType(body.trigger_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid trigger_type: {body.trigger_type}")

    flow = Flow(
        workspace_id=workspace_id,
        name=body.name,
        description=body.description,
        trigger_type=trigger,
        trigger_config=body.trigger_config,
        nodes=[],
        edges=[],
    )
    db.add(flow)
    await db.commit()
    await db.refresh(flow)
    return flow


# ── Get single ────────────────────────────────────────────────────────────────
@router.get("/{flow_id}", response_model=FlowOut)
async def get_flow(
    workspace_id: uuid.UUID,
    flow_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    return await _get_or_404(db, workspace_id, flow_id)


# ── Save (nodes + edges) ──────────────────────────────────────────────────────
@router.put("/{flow_id}", response_model=FlowOut)
async def save_flow(
    workspace_id: uuid.UUID,
    flow_id: uuid.UUID,
    body: FlowUpdate,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    flow = await _get_or_404(db, workspace_id, flow_id)
    for field, val in body.model_dump(exclude_none=True).items():
        if field == "trigger_type":
            try:
                val = TriggerType(val)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid trigger_type: {val}")
        setattr(flow, field, val)
    await db.commit()
    await db.refresh(flow)
    return flow


# ── Delete ────────────────────────────────────────────────────────────────────
@router.delete("/{flow_id}", status_code=204)
async def delete_flow(
    workspace_id: uuid.UUID,
    flow_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    flow = await _get_or_404(db, workspace_id, flow_id)
    await db.delete(flow)
    await db.commit()


# ── Toggle active/inactive ────────────────────────────────────────────────────
@router.patch("/{flow_id}/toggle")
async def toggle_flow(
    workspace_id: uuid.UUID,
    flow_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    flow = await _get_or_404(db, workspace_id, flow_id)
    flow.is_active = not flow.is_active
    await db.commit()
    return {"id": str(flow.id), "is_active": flow.is_active}


# ── Run history ───────────────────────────────────────────────────────────────
@router.get("/{flow_id}/runs", response_model=list[FlowRunOut])
async def list_flow_runs(
    workspace_id: uuid.UUID,
    flow_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    await _get_or_404(db, workspace_id, flow_id)
    result = await db.execute(
        select(FlowRun)
        .where(FlowRun.flow_id == flow_id, FlowRun.workspace_id == workspace_id)
        .order_by(FlowRun.started_at.desc())
        .limit(100)
    )
    return result.scalars().all()


# ── Single run with logs ──────────────────────────────────────────────────────
@router.get("/{flow_id}/runs/{run_id}")
async def get_flow_run(
    workspace_id: uuid.UUID,
    flow_id: uuid.UUID,
    run_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    run_result = await db.execute(
        select(FlowRun).where(FlowRun.id == run_id, FlowRun.flow_id == flow_id)
    )
    run = run_result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Flow run not found")

    logs_result = await db.execute(
        select(FlowRunLog).where(FlowRunLog.flow_run_id == run_id).order_by(FlowRunLog.executed_at)
    )
    logs = logs_result.scalars().all()

    return {
        "id": str(run.id),
        "flow_id": str(run.flow_id),
        "contact_id": str(run.contact_id),
        "status": run.status,
        "current_node_id": run.current_node_id,
        "context": run.context,
        "started_at": run.started_at,
        "completed_at": run.completed_at,
        "logs": [
            {
                "node_id": l.node_id,
                "node_type": l.node_type,
                "status": l.status,
                "input": l.input,
                "output": l.output,
                "error": l.error,
                "executed_at": l.executed_at,
            }
            for l in logs
        ],
    }


# ── Test flow with a contact ──────────────────────────────────────────────────
@router.post("/{flow_id}/test")
async def test_flow(
    workspace_id: uuid.UUID,
    flow_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    from app.models.contact import Contact
    from app.services.flow_engine import FlowEngine

    flow = await _get_or_404(db, workspace_id, flow_id)

    # Use first contact in workspace as test contact
    contact_result = await db.execute(
        select(Contact).where(Contact.workspace_id == workspace_id).limit(1)
    )
    contact = contact_result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=400, detail="No contacts found. Add a contact first to test.")

    engine = FlowEngine(db, workspace)
    run = await engine.trigger_flow(
        flow_id=flow.id,
        contact_id=contact.id,
        context={"test": True, "message": "test"},
        workspace_id=workspace_id,
    )
    return {"flow_run_id": str(run.id), "status": run.status}


# ── Helper ────────────────────────────────────────────────────────────────────
async def _get_or_404(db: AsyncSession, workspace_id: uuid.UUID, flow_id: uuid.UUID) -> Flow:
    result = await db.execute(
        select(Flow).where(Flow.id == flow_id, Flow.workspace_id == workspace_id)
    )
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404, detail="Flow not found")
    return f
