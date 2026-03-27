import re
import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.dependencies import CurrentUser, DbDep
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember, MemberRole
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut, WorkspaceOut
from app.utils.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return f"{slug}-{uuid.uuid4().hex[:6]}"


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: DbDep):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
    )
    db.add(user)
    await db.flush()

    workspace = Workspace(name=body.workspace_name, slug=_slugify(body.workspace_name), owner_id=user.id)
    db.add(workspace)
    await db.flush()

    member = WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=MemberRole.admin)
    db.add(member)
    await db.commit()
    await db.refresh(user)
    await db.refresh(workspace)

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=token,
        user=UserOut.model_validate(user),
        workspace=WorkspaceOut.model_validate(workspace),
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: DbDep):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Get first workspace
    ws_result = await db.execute(
        select(Workspace).join(WorkspaceMember, Workspace.id == WorkspaceMember.workspace_id)
        .where(WorkspaceMember.user_id == user.id)
        .limit(1)
    )
    workspace = ws_result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="No workspace found")

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=token,
        user=UserOut.model_validate(user),
        workspace=WorkspaceOut.model_validate(workspace),
    )


@router.get("/me")
async def me(user: CurrentUser, db: DbDep):
    ws_result = await db.execute(
        select(Workspace).join(WorkspaceMember, Workspace.id == WorkspaceMember.workspace_id)
        .where(WorkspaceMember.user_id == user.id)
    )
    workspaces = ws_result.scalars().all()
    return {
        "user": UserOut.model_validate(user),
        "workspaces": [WorkspaceOut.model_validate(w) for w in workspaces],
    }
