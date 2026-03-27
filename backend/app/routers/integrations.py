import hashlib
import hmac
import secrets
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import CurrentUser, DbDep, get_workspace
from app.models.workspace import Workspace

router = APIRouter(tags=["integrations"])
WorkspaceDep = Annotated[Workspace, Depends(get_workspace)]

# We store webhooks in a simple in-memory dict for now.
# In production this should be a DB table (Integration model).
# The model/migration can be added later without changing the API.
_webhooks: dict[str, dict] = {}  # webhook_id -> {workspace_id, secret, created_at}


# ── List integrations ─────────────────────────────────────────────────────────
@router.get("/workspaces/{workspace_id}/integrations")
async def list_integrations(
    workspace_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    workspace_webhooks = [
        {
            "id": wid,
            "webhook_url": f"/webhook/trigger/{workspace_id}/{wid}",
            "secret": v["secret"],
            "created_at": v["created_at"],
        }
        for wid, v in _webhooks.items()
        if v["workspace_id"] == str(workspace_id)
    ]
    return {"webhooks": workspace_webhooks}


# ── Create incoming webhook ───────────────────────────────────────────────────
@router.post("/workspaces/{workspace_id}/integrations/webhook", status_code=201)
async def create_webhook(
    workspace_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    from datetime import datetime, timezone

    webhook_id = secrets.token_urlsafe(12)
    secret = secrets.token_hex(32)
    created_at = datetime.now(timezone.utc).isoformat()

    _webhooks[webhook_id] = {
        "workspace_id": str(workspace_id),
        "secret": secret,
        "created_at": created_at,
    }

    return {
        "id": webhook_id,
        "webhook_url": f"/webhook/trigger/{workspace_id}/{webhook_id}",
        "secret": secret,
        "created_at": created_at,
    }


# ── Delete webhook ────────────────────────────────────────────────────────────
@router.delete("/workspaces/{workspace_id}/integrations/webhook/{webhook_id}", status_code=204)
async def delete_webhook(
    workspace_id: uuid.UUID,
    webhook_id: str,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    entry = _webhooks.get(webhook_id)
    if not entry or entry["workspace_id"] != str(workspace_id):
        raise HTTPException(status_code=404, detail="Webhook not found")
    del _webhooks[webhook_id]


# ── Incoming webhook trigger (called by external services) ────────────────────
@router.post("/webhook/trigger/{workspace_id}/{webhook_id}")
async def webhook_trigger(
    workspace_id: uuid.UUID,
    webhook_id: str,
    request: Request,
    db: DbDep,
):
    entry = _webhooks.get(webhook_id)
    if not entry or entry["workspace_id"] != str(workspace_id):
        raise HTTPException(status_code=404, detail="Webhook not found")

    # Verify HMAC signature if provided
    signature = request.headers.get("X-Hub-Signature-256", "")
    if signature:
        body = await request.body()
        expected = "sha256=" + hmac.new(
            entry["secret"].encode(), body, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise HTTPException(status_code=401, detail="Invalid signature")

    payload = await request.json()

    # Find active flows with webhook trigger for this workspace
    from app.models.flow import Flow, TriggerType
    from app.models.contact import Contact
    from app.services.flow_engine import FlowEngine

    result = await db.execute(
        select(Flow).where(
            Flow.workspace_id == workspace_id,
            Flow.trigger_type == TriggerType.webhook,
            Flow.is_active == True,
        )
    )
    flows = result.scalars().all()

    ws_result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    workspace = ws_result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Extract phone from payload (common field names)
    phone = (
        payload.get("phone")
        or payload.get("phone_number")
        or payload.get("customer", {}).get("phone")
        or payload.get("billing_address", {}).get("phone")
    )

    triggered = 0
    if phone and flows:
        # Find or create contact
        contact_result = await db.execute(
            select(Contact).where(
                Contact.workspace_id == workspace_id,
                Contact.phone_number == phone,
            )
        )
        contact = contact_result.scalar_one_or_none()

        if contact:
            engine = FlowEngine(db, workspace)
            for flow in flows:
                # Check if webhook_id matches trigger config (if configured)
                trigger_cfg = flow.trigger_config or {}
                if trigger_cfg.get("webhook_id") and trigger_cfg["webhook_id"] != webhook_id:
                    continue
                try:
                    await engine.trigger_flow(
                        flow_id=flow.id,
                        contact_id=contact.id,
                        context={"trigger": "webhook", "payload": payload, "contact_id": str(contact.id)},
                        workspace_id=workspace_id,
                    )
                    triggered += 1
                except Exception:
                    pass

    await db.commit()
    return {"status": "ok", "flows_triggered": triggered}


# ── Shopify connect (stub — full OAuth needed) ────────────────────────────────
@router.post("/workspaces/{workspace_id}/integrations/shopify/connect")
async def connect_shopify(
    workspace_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    raise HTTPException(status_code=501, detail="Shopify integration coming soon")


# ── Razorpay connect (stub) ───────────────────────────────────────────────────
@router.post("/workspaces/{workspace_id}/integrations/razorpay/connect")
async def connect_razorpay(
    workspace_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    raise HTTPException(status_code=501, detail="Razorpay integration coming soon")
