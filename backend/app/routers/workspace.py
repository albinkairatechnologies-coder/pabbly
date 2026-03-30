import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.dependencies import CurrentUser, DbDep
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember, MemberRole
from app.schemas.workspace import MemberInvite, MemberOut, WhatsAppCredentials, WorkspaceCreate, WorkspaceOut, WorkspaceUpdate
from app.routers.auth import _slugify

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("/", response_model=list[WorkspaceOut])
async def list_workspaces(user: CurrentUser, db: DbDep):
    result = await db.execute(
        select(Workspace).join(WorkspaceMember, Workspace.id == WorkspaceMember.workspace_id)
        .where(WorkspaceMember.user_id == user.id)
    )
    return result.scalars().all()


@router.post("/", response_model=WorkspaceOut, status_code=201)
async def create_workspace(body: WorkspaceCreate, user: CurrentUser, db: DbDep):
    workspace = Workspace(name=body.name, slug=_slugify(body.name), owner_id=user.id)
    db.add(workspace)
    await db.flush()
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=MemberRole.admin))
    await db.commit()
    await db.refresh(workspace)
    return workspace


@router.get("/{workspace_id}", response_model=WorkspaceOut)
async def get_workspace(workspace_id: uuid.UUID, user: CurrentUser, db: DbDep):
    workspace = await _get_member_workspace(workspace_id, user.id, db)
    return workspace


@router.put("/{workspace_id}", response_model=WorkspaceOut)
async def update_workspace(workspace_id: uuid.UUID, body: WorkspaceUpdate, user: CurrentUser, db: DbDep):
    workspace = await _get_member_workspace(workspace_id, user.id, db)
    if body.name:
        workspace.name = body.name
    await db.commit()
    await db.refresh(workspace)
    return workspace


@router.put("/{workspace_id}/whatsapp", response_model=WorkspaceOut)
async def update_whatsapp(workspace_id: uuid.UUID, body: WhatsAppCredentials, user: CurrentUser, db: DbDep):
    workspace = await _get_member_workspace(workspace_id, user.id, db)
    workspace.whatsapp_phone_number_id = body.phone_number_id
    workspace.whatsapp_access_token = body.access_token
    workspace.whatsapp_business_account_id = body.business_account_id
    await db.commit()
    await db.refresh(workspace)
    return workspace


@router.get("/{workspace_id}/whatsapp/test")
async def test_whatsapp(workspace_id: uuid.UUID, user: CurrentUser, db: DbDep):
    workspace = await _get_member_workspace(workspace_id, user.id, db)
    provider = getattr(workspace, "whatsapp_provider", "meta") or "meta"
    if provider == "twilio":
        if not workspace.twilio_account_sid or not workspace.twilio_auth_token:
            raise HTTPException(status_code=400, detail="Twilio credentials not configured")
        from app.services.twilio_service import TwilioWhatsAppService
        svc = TwilioWhatsAppService(
            workspace.twilio_account_sid,
            workspace.twilio_auth_token,
            workspace.twilio_whatsapp_number or "",
        )
    else:
        if not workspace.whatsapp_access_token or not workspace.whatsapp_phone_number_id:
            raise HTTPException(status_code=400, detail="WhatsApp credentials not configured")
        from app.services.whatsapp import WhatsAppService
        svc = WhatsAppService(workspace.whatsapp_access_token, workspace.whatsapp_phone_number_id)
    info = await svc.get_phone_number_info()
    return info


class ProviderUpdate(BaseModel):
    provider: str


@router.put("/{workspace_id}/provider")
async def update_provider(workspace_id: uuid.UUID, body: ProviderUpdate, user: CurrentUser, db: DbDep):
    if body.provider not in ("meta", "twilio"):
        raise HTTPException(status_code=400, detail="Invalid provider. Use 'meta' or 'twilio'")
    workspace = await _get_member_workspace(workspace_id, user.id, db)
    workspace.whatsapp_provider = body.provider
    await db.commit()
    return {"provider": body.provider}


class TwilioCredentials(BaseModel):
    account_sid: str
    auth_token: str
    whatsapp_number: str


@router.put("/{workspace_id}/twilio", response_model=WorkspaceOut)
async def update_twilio(workspace_id: uuid.UUID, body: TwilioCredentials, user: CurrentUser, db: DbDep):
    workspace = await _get_member_workspace(workspace_id, user.id, db)
    workspace.twilio_account_sid = body.account_sid
    workspace.twilio_auth_token = body.auth_token
    workspace.twilio_whatsapp_number = body.whatsapp_number
    workspace.whatsapp_provider = "twilio"
    await db.commit()
    await db.refresh(workspace)
    return workspace


@router.get("/{workspace_id}/members", response_model=list[MemberOut])
async def list_members(workspace_id: uuid.UUID, user: CurrentUser, db: DbDep):
    await _get_member_workspace(workspace_id, user.id, db)
    result = await db.execute(
        select(WorkspaceMember, User)
        .join(User, WorkspaceMember.user_id == User.id)
        .where(WorkspaceMember.workspace_id == workspace_id)
    )
    rows = result.all()
    return [
        MemberOut(user_id=m.user_id, role=m.role, user_email=u.email, user_name=u.full_name)
        for m, u in rows
    ]


@router.post("/{workspace_id}/members", status_code=201)
async def invite_member(workspace_id: uuid.UUID, body: MemberInvite, user: CurrentUser, db: DbDep):
    await _get_member_workspace(workspace_id, user.id, db)
    result = await db.execute(select(User).where(User.email == body.email))
    invitee = result.scalar_one_or_none()
    if not invitee:
        raise HTTPException(status_code=404, detail="User not found")
    db.add(WorkspaceMember(workspace_id=workspace_id, user_id=invitee.id, role=body.role))
    await db.commit()
    return {"detail": "Member added"}


@router.delete("/{workspace_id}/members/{user_id}", status_code=204)
async def remove_member(workspace_id: uuid.UUID, user_id: uuid.UUID, user: CurrentUser, db: DbDep):
    await _get_member_workspace(workspace_id, user.id, db)
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if member:
        await db.delete(member)
        await db.commit()


async def _get_member_workspace(workspace_id: uuid.UUID, user_id: uuid.UUID, db) -> Workspace:
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    member = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    if not member.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Access denied")
    return workspace
