import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import CurrentUser, DbDep, get_workspace
from app.models.template import Template, TemplateCategory, TemplateStatus
from app.models.workspace import Workspace
from app.services.whatsapp import WhatsAppService

router = APIRouter(prefix="/workspaces/{workspace_id}/templates", tags=["templates"])
WorkspaceDep = Annotated[Workspace, Depends(get_workspace)]


# ── Schemas ───────────────────────────────────────────────────────────────────
class TemplateCreate(BaseModel):
    name: str
    category: str
    language: str = "en"
    components: list


class TemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    category: str
    language: str
    status: str
    components: list
    meta_template_id: str | None
    rejection_reason: str | None

    model_config = {"from_attributes": True}


# ── List ──────────────────────────────────────────────────────────────────────
@router.get("/", response_model=list[TemplateOut])
async def list_templates(
    workspace_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    result = await db.execute(
        select(Template).where(Template.workspace_id == workspace_id).order_by(Template.created_at.desc())
    )
    return result.scalars().all()


# ── Create + submit to Meta ───────────────────────────────────────────────────
@router.post("/", response_model=TemplateOut, status_code=201)
async def create_template(
    workspace_id: uuid.UUID,
    body: TemplateCreate,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    template = Template(
        workspace_id=workspace_id,
        name=body.name,
        category=TemplateCategory(body.category.lower()),
        language=body.language,
        components=body.components,
        status=TemplateStatus.pending,
    )
    db.add(template)

    # Submit to Meta if WhatsApp is configured
    if workspace.whatsapp_access_token and workspace.whatsapp_business_account_id:
        try:
            wa = WhatsAppService(workspace.whatsapp_access_token, workspace.whatsapp_phone_number_id)
            meta_resp = await wa.create_template(
                name=body.name,
                category=body.category.upper(),
                language=body.language,
                components=body.components,
            )
            template.meta_template_id = meta_resp.get("id")
        except Exception:
            pass  # Save locally even if Meta submission fails

    await db.commit()
    await db.refresh(template)
    return template


# ── Get single ────────────────────────────────────────────────────────────────
@router.get("/{template_id}", response_model=TemplateOut)
async def get_template(
    workspace_id: uuid.UUID,
    template_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    return await _get_or_404(db, workspace_id, template_id)


# ── Delete ────────────────────────────────────────────────────────────────────
@router.delete("/{template_id}", status_code=204)
async def delete_template(
    workspace_id: uuid.UUID,
    template_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    template = await _get_or_404(db, workspace_id, template_id)
    await db.delete(template)
    await db.commit()


# ── Sync approval status from Meta ───────────────────────────────────────────
@router.post("/sync")
async def sync_templates(
    workspace_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace: WorkspaceDep = None,
):
    if not workspace.whatsapp_access_token or not workspace.whatsapp_business_account_id:
        raise HTTPException(status_code=400, detail="WhatsApp not configured")

    import httpx
    from app.config import settings

    url = f"https://graph.facebook.com/{settings.META_API_VERSION}/{workspace.whatsapp_business_account_id}/message_templates"
    headers = {"Authorization": f"Bearer {workspace.whatsapp_access_token}"}

    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        meta_templates = resp.json().get("data", [])

    # Build lookup by name
    meta_map = {t["name"]: t for t in meta_templates}

    result = await db.execute(select(Template).where(Template.workspace_id == workspace_id))
    templates = result.scalars().all()

    updated = 0
    for t in templates:
        meta = meta_map.get(t.name)
        if not meta:
            continue
        status_map = {"APPROVED": TemplateStatus.approved, "REJECTED": TemplateStatus.rejected, "PENDING": TemplateStatus.pending}
        new_status = status_map.get(meta.get("status", "").upper(), TemplateStatus.pending)
        if t.status != new_status:
            t.status = new_status
            t.rejection_reason = meta.get("rejected_reason")
            updated += 1

    await db.commit()
    return {"synced": len(templates), "updated": updated}


# ── Helper ────────────────────────────────────────────────────────────────────
async def _get_or_404(db: AsyncSession, workspace_id: uuid.UUID, template_id: uuid.UUID) -> Template:
    result = await db.execute(
        select(Template).where(Template.id == template_id, Template.workspace_id == workspace_id)
    )
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return t
