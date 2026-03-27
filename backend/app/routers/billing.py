import hashlib
import hmac
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import CurrentUser, DbDep, get_workspace
from app.models.billing import Subscription, SubscriptionStatus, UsageRecord
from app.models.contact import Contact
from app.models.flow import FlowRun
from app.models.message import Message, MessageDirection
from app.models.workspace import Workspace, PlanType

router = APIRouter(prefix="/workspaces/{workspace_id}/billing", tags=["billing"])
WorkspaceDep = Annotated[Workspace, Depends(get_workspace)]

# ── Plan definitions ──────────────────────────────────────────────────────────
PLANS = {
    "free":       {"price_inr": 0,    "max_messages": 1000,   "max_contacts": 500,   "max_flows": 3,  "max_broadcasts": 2,  "team_members": 1,  "razorpay_plan_id": None},
    "starter":    {"price_inr": 999,  "max_messages": 5000,   "max_contacts": 2000,  "max_flows": 10, "max_broadcasts": 10, "team_members": 3,  "razorpay_plan_id": "plan_starter"},
    "pro":        {"price_inr": 2499, "max_messages": 20000,  "max_contacts": 10000, "max_flows": 50, "max_broadcasts": 50, "team_members": 10, "razorpay_plan_id": "plan_pro"},
    "enterprise": {"price_inr": 7999, "max_messages": 100000, "max_contacts": -1,    "max_flows": -1, "max_broadcasts": -1, "team_members": -1, "razorpay_plan_id": "plan_enterprise"},
}


# ── Schemas ───────────────────────────────────────────────────────────────────
class SubscribeRequest(BaseModel):
    plan: str


# ── List plans ────────────────────────────────────────────────────────────────
@router.get("/plans")
async def list_plans():
    return [
        {"key": k, **{f: v for f, v in p.items() if f != "razorpay_plan_id"}}
        for k, p in PLANS.items()
    ]


# ── Current subscription ──────────────────────────────────────────────────────
@router.get("/subscription")
async def get_subscription(
    workspace_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    sub = await _get_or_create_subscription(db, workspace_id, workspace.plan)
    return {
        "plan": sub.plan,
        "status": sub.status,
        "razorpay_subscription_id": sub.razorpay_subscription_id,
        "current_period_start": sub.current_period_start,
        "current_period_end": sub.current_period_end,
        "cancel_at_period_end": sub.cancel_at_period_end,
    }


# ── Subscribe / upgrade ───────────────────────────────────────────────────────
@router.post("/subscribe")
async def subscribe(
    workspace_id: uuid.UUID,
    body: SubscribeRequest,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    if body.plan not in PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")
    if body.plan == "free":
        raise HTTPException(status_code=400, detail="Cannot subscribe to free plan")

    plan_config = PLANS[body.plan]
    razorpay_plan_id = plan_config["razorpay_plan_id"]

    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=400, detail="Razorpay not configured")

    try:
        import razorpay
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

        subscription = client.subscription.create({
            "plan_id": razorpay_plan_id,
            "total_count": 12,  # 12 months
            "quantity": 1,
            "customer_notify": 1,
        })

        sub = await _get_or_create_subscription(db, workspace_id, workspace.plan)
        sub.razorpay_subscription_id = subscription["id"]
        await db.commit()

        return {
            "subscription_id": subscription["id"],
            "short_url": subscription.get("short_url", ""),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Razorpay error: {str(e)}")


# ── Cancel subscription ───────────────────────────────────────────────────────
@router.delete("/subscription")
async def cancel_subscription(
    workspace_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    sub = await _get_or_create_subscription(db, workspace_id, workspace.plan)
    if not sub.razorpay_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription")

    try:
        import razorpay
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        client.subscription.cancel(sub.razorpay_subscription_id, {"cancel_at_cycle_end": 1})
        sub.cancel_at_period_end = True
        await db.commit()
        return {"detail": "Subscription will cancel at period end"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Razorpay error: {str(e)}")


# ── Razorpay webhook ──────────────────────────────────────────────────────────
@router.post("/webhook/razorpay")
async def razorpay_webhook(request: Request, db: DbDep):
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    # Verify HMAC signature
    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid signature")

    payload = await request.json()
    event = payload.get("event")
    subscription_data = payload.get("payload", {}).get("subscription", {}).get("entity", {})
    razorpay_sub_id = subscription_data.get("id")

    if not razorpay_sub_id:
        return {"status": "ok"}

    result = await db.execute(
        select(Subscription).where(Subscription.razorpay_subscription_id == razorpay_sub_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return {"status": "ok"}

    ws_result = await db.execute(select(Workspace).where(Workspace.id == sub.workspace_id))
    workspace = ws_result.scalar_one_or_none()

    if event == "subscription.activated":
        sub.status = SubscriptionStatus.active
        plan_name = subscription_data.get("plan_id", "").replace("plan_", "")
        if plan_name in PLANS and workspace:
            sub.plan = plan_name
            workspace.plan = PlanType(plan_name) if plan_name in PlanType.__members__ else workspace.plan
        sub.current_period_start = str(subscription_data.get("current_start"))
        sub.current_period_end = str(subscription_data.get("current_end"))

    elif event == "subscription.charged":
        sub.current_period_start = str(subscription_data.get("current_start"))
        sub.current_period_end = str(subscription_data.get("current_end"))

    elif event == "subscription.cancelled":
        sub.status = SubscriptionStatus.cancelled

    elif event == "subscription.halted":
        sub.status = SubscriptionStatus.halted

    await db.commit()
    return {"status": "ok"}


# ── Usage ─────────────────────────────────────────────────────────────────────
@router.get("/usage")
async def get_usage(
    workspace_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    month_str = datetime.now(timezone.utc).strftime("%Y-%m")
    plan_config = PLANS.get(workspace.plan, PLANS["free"])

    # Get or create usage record
    usage = await _get_or_create_usage(db, workspace_id, month_str)

    # Live counts
    messages_sent = await _count_messages(db, workspace_id, month_str)
    contacts_total = await _count_contacts(db, workspace_id)
    flows_executed = await _count_flow_runs(db, workspace_id, month_str)

    # Update usage record
    usage.messages_sent = messages_sent
    usage.contacts_created = contacts_total
    usage.flows_executed = flows_executed
    await db.commit()

    return {
        "month": month_str,
        "messages_sent": messages_sent,
        "max_messages": plan_config["max_messages"],
        "contacts": contacts_total,
        "max_contacts": plan_config["max_contacts"],
        "flows_executed": flows_executed,
        "max_flows": plan_config["max_flows"],
    }


# ── Invoices (placeholder — real data comes from Razorpay) ───────────────────
@router.get("/invoices")
async def get_invoices(
    workspace_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    sub = await _get_or_create_subscription(db, workspace_id, workspace.plan)
    if not sub.razorpay_subscription_id or not settings.RAZORPAY_KEY_ID:
        return []

    try:
        import razorpay
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        invoices = client.invoice.all({"subscription_id": sub.razorpay_subscription_id})
        return invoices.get("items", [])
    except Exception:
        return []


# ── Helpers ───────────────────────────────────────────────────────────────────
async def _get_or_create_subscription(db: AsyncSession, workspace_id: uuid.UUID, plan: str) -> Subscription:
    result = await db.execute(select(Subscription).where(Subscription.workspace_id == workspace_id))
    sub = result.scalar_one_or_none()
    if not sub:
        sub = Subscription(workspace_id=workspace_id, plan=plan, status=SubscriptionStatus.active)
        db.add(sub)
        await db.commit()
        await db.refresh(sub)
    return sub


async def _get_or_create_usage(db: AsyncSession, workspace_id: uuid.UUID, month: str) -> UsageRecord:
    result = await db.execute(
        select(UsageRecord).where(UsageRecord.workspace_id == workspace_id, UsageRecord.month == month)
    )
    usage = result.scalar_one_or_none()
    if not usage:
        usage = UsageRecord(workspace_id=workspace_id, month=month)
        db.add(usage)
        await db.flush()
    return usage


async def _count_messages(db: AsyncSession, workspace_id: uuid.UUID, month_str: str) -> int:
    from sqlalchemy import func
    result = await db.execute(
        select(func.count(Message.id)).where(
            Message.workspace_id == workspace_id,
            Message.direction == MessageDirection.outbound,
            func.to_char(Message.created_at, "YYYY-MM") == month_str,
        )
    )
    return result.scalar_one() or 0


async def _count_contacts(db: AsyncSession, workspace_id: uuid.UUID) -> int:
    from sqlalchemy import func
    result = await db.execute(
        select(func.count(Contact.id)).where(Contact.workspace_id == workspace_id)
    )
    return result.scalar_one() or 0


async def _count_flow_runs(db: AsyncSession, workspace_id: uuid.UUID, month_str: str) -> int:
    from sqlalchemy import func
    result = await db.execute(
        select(func.count(FlowRun.id)).where(
            FlowRun.workspace_id == workspace_id,
            func.to_char(FlowRun.created_at, "YYYY-MM") == month_str,
        )
    )
    return result.scalar_one() or 0
