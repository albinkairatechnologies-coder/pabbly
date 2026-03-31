"""
Super Admin API
Only accessible to users with is_superadmin=True
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select

from app.dependencies import CurrentUser, DbDep
from app.models.billing import Subscription, SubscriptionStatus, UsageRecord
from app.models.contact import Contact
from app.models.flow import Flow, FlowRun
from app.models.message import Message, MessageDirection
from app.models.user import User
from app.models.workspace import Workspace, PlanType

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Guard ─────────────────────────────────────────────────────────────────────
async def require_superadmin(user: CurrentUser):
    if not user.is_superadmin:
        raise HTTPException(status_code=403, detail="Superadmin access required")
    return user


# ── Schemas ───────────────────────────────────────────────────────────────────
class PlanUpdate(BaseModel):
    plan: str

class SuspendUpdate(BaseModel):
    is_active: bool

class SuperadminGrant(BaseModel):
    is_superadmin: bool


# ── Overview stats ────────────────────────────────────────────────────────────
@router.get("/stats")
async def admin_stats(user: CurrentUser, db: DbDep):
    await require_superadmin(user)

    total_users      = (await db.execute(select(func.count(User.id)))).scalar_one()
    total_workspaces = (await db.execute(select(func.count(Workspace.id)))).scalar_one()
    active_workspaces= (await db.execute(select(func.count(Workspace.id)).where(Workspace.is_active == True))).scalar_one()
    total_messages   = (await db.execute(select(func.count(Message.id)).where(Message.direction == MessageDirection.outbound))).scalar_one()
    total_contacts   = (await db.execute(select(func.count(Contact.id)))).scalar_one()
    total_flows      = (await db.execute(select(func.count(Flow.id)))).scalar_one()

    # Plan breakdown
    plan_rows = (await db.execute(
        select(Workspace.plan, func.count(Workspace.id))
        .group_by(Workspace.plan)
    )).all()
    plan_breakdown = {str(row[0]).replace("PlanType.", ""): row[1] for row in plan_rows}

    # MRR estimate (simple)
    PLAN_PRICE = {"free": 0, "starter": 999, "pro": 2499, "enterprise": 7999}
    mrr = sum(PLAN_PRICE.get(p, 0) * c for p, c in plan_breakdown.items())

    return {
        "total_users": total_users,
        "total_workspaces": total_workspaces,
        "active_workspaces": active_workspaces,
        "total_messages_sent": total_messages,
        "total_contacts": total_contacts,
        "total_flows": total_flows,
        "plan_breakdown": plan_breakdown,
        "mrr_inr": mrr,
    }


# ── List all workspaces ───────────────────────────────────────────────────────
@router.get("/workspaces")
async def list_all_workspaces(
    user: CurrentUser, db: DbDep,
    search: str = "", page: int = 1, limit: int = 20,
):
    await require_superadmin(user)

    q = select(Workspace, User).join(User, Workspace.owner_id == User.id)
    if search:
        q = q.where(
            Workspace.name.ilike(f"%{search}%") |
            User.email.ilike(f"%{search}%")
        )
    q = q.order_by(Workspace.created_at.desc()).offset((page - 1) * limit).limit(limit)
    rows = (await db.execute(q)).all()

    result = []
    for ws, owner in rows:
        # get subscription
        sub = (await db.execute(
            select(Subscription).where(Subscription.workspace_id == ws.id)
        )).scalar_one_or_none()

        # get usage counts
        msg_count = (await db.execute(
            select(func.count(Message.id)).where(
                Message.workspace_id == ws.id,
                Message.direction == MessageDirection.outbound,
            )
        )).scalar_one()

        contact_count = (await db.execute(
            select(func.count(Contact.id)).where(Contact.workspace_id == ws.id)
        )).scalar_one()

        result.append({
            "id": str(ws.id),
            "name": ws.name,
            "slug": ws.slug,
            "plan": str(ws.plan).replace("PlanType.", ""),
            "is_active": ws.is_active,
            "created_at": ws.created_at.isoformat() if ws.created_at else None,
            "owner_email": owner.email,
            "owner_name": owner.full_name,
            "owner_id": str(owner.id),
            "whatsapp_connected": bool(ws.whatsapp_phone_number_id),
            "messages_sent": msg_count,
            "contacts": contact_count,
            "subscription_status": str(sub.status).replace("SubscriptionStatus.", "") if sub else "none",
            "subscription_end": sub.current_period_end if sub else None,
        })
    return result


# ── Get single workspace detail ───────────────────────────────────────────────
@router.get("/workspaces/{workspace_id}")
async def get_workspace_detail(workspace_id: uuid.UUID, user: CurrentUser, db: DbDep):
    await require_superadmin(user)

    ws = (await db.execute(select(Workspace).where(Workspace.id == workspace_id))).scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    owner = (await db.execute(select(User).where(User.id == ws.owner_id))).scalar_one_or_none()
    sub   = (await db.execute(select(Subscription).where(Subscription.workspace_id == workspace_id))).scalar_one_or_none()

    month = datetime.now(timezone.utc).strftime("%Y-%m")
    usage = (await db.execute(
        select(UsageRecord).where(UsageRecord.workspace_id == workspace_id, UsageRecord.month == month)
    )).scalar_one_or_none()

    flows      = (await db.execute(select(func.count(Flow.id)).where(Flow.workspace_id == workspace_id))).scalar_one()
    flow_runs  = (await db.execute(select(func.count(FlowRun.id)).where(FlowRun.workspace_id == workspace_id))).scalar_one()
    contacts   = (await db.execute(select(func.count(Contact.id)).where(Contact.workspace_id == workspace_id))).scalar_one()
    msgs_out   = (await db.execute(select(func.count(Message.id)).where(Message.workspace_id == workspace_id, Message.direction == MessageDirection.outbound))).scalar_one()
    msgs_in    = (await db.execute(select(func.count(Message.id)).where(Message.workspace_id == workspace_id, Message.direction == MessageDirection.inbound))).scalar_one()

    return {
        "id": str(ws.id),
        "name": ws.name,
        "slug": ws.slug,
        "plan": str(ws.plan).replace("PlanType.", ""),
        "is_active": ws.is_active,
        "created_at": ws.created_at.isoformat() if ws.created_at else None,
        "whatsapp_phone_number_id": ws.whatsapp_phone_number_id,
        "whatsapp_business_account_id": ws.whatsapp_business_account_id,
        "owner": {"id": str(owner.id), "email": owner.email, "name": owner.full_name} if owner else None,
        "subscription": {
            "plan": sub.plan, "status": str(sub.status).replace("SubscriptionStatus.", ""),
            "period_end": sub.current_period_end, "cancel_at_period_end": sub.cancel_at_period_end,
            "razorpay_id": sub.razorpay_subscription_id,
        } if sub else None,
        "usage": {
            "messages_sent": msgs_out, "messages_received": msgs_in,
            "contacts": contacts, "flows": flows, "flow_runs": flow_runs,
            "this_month": {"messages": usage.messages_sent if usage else 0},
        },
    }


# ── Change plan ───────────────────────────────────────────────────────────────
@router.patch("/workspaces/{workspace_id}/plan")
async def change_plan(workspace_id: uuid.UUID, body: PlanUpdate, user: CurrentUser, db: DbDep):
    await require_superadmin(user)

    if body.plan not in ("free", "starter", "pro", "enterprise"):
        raise HTTPException(status_code=400, detail="Invalid plan")

    ws = (await db.execute(select(Workspace).where(Workspace.id == workspace_id))).scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=404, detail="Not found")

    ws.plan = PlanType(body.plan)

    sub = (await db.execute(select(Subscription).where(Subscription.workspace_id == workspace_id))).scalar_one_or_none()
    if sub:
        sub.plan = body.plan
        sub.status = SubscriptionStatus.active

    await db.commit()
    return {"plan": body.plan, "status": "updated"}


# ── Suspend / unsuspend workspace ─────────────────────────────────────────────
@router.patch("/workspaces/{workspace_id}/suspend")
async def suspend_workspace(workspace_id: uuid.UUID, body: SuspendUpdate, user: CurrentUser, db: DbDep):
    await require_superadmin(user)

    ws = (await db.execute(select(Workspace).where(Workspace.id == workspace_id))).scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=404, detail="Not found")

    ws.is_active = body.is_active
    await db.commit()
    return {"is_active": body.is_active}


# ── List all users ────────────────────────────────────────────────────────────
@router.get("/users")
async def list_all_users(
    user: CurrentUser, db: DbDep,
    search: str = "", page: int = 1, limit: int = 20,
):
    await require_superadmin(user)

    q = select(User)
    if search:
        q = q.where(User.email.ilike(f"%{search}%") | User.full_name.ilike(f"%{search}%"))
    q = q.order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit)
    users = (await db.execute(q)).scalars().all()

    return [
        {
            "id": str(u.id),
            "email": u.email,
            "full_name": u.full_name,
            "is_active": u.is_active,
            "is_superadmin": u.is_superadmin,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


# ── Grant / revoke superadmin ─────────────────────────────────────────────────
@router.patch("/users/{user_id}/superadmin")
async def set_superadmin(user_id: uuid.UUID, body: SuperadminGrant, user: CurrentUser, db: DbDep):
    await require_superadmin(user)

    target = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    target.is_superadmin = body.is_superadmin
    await db.commit()
    return {"is_superadmin": body.is_superadmin}


# ── Suspend user ──────────────────────────────────────────────────────────────
@router.patch("/users/{user_id}/suspend")
async def suspend_user(user_id: uuid.UUID, body: SuspendUpdate, user: CurrentUser, db: DbDep):
    await require_superadmin(user)

    target = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    target.is_active = body.is_active
    await db.commit()
    return {"is_active": body.is_active}
