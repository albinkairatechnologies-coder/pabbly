import csv
import io
import re
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import CurrentUser, DbDep, get_workspace
from app.models.contact import Contact, ContactTag
from app.models.message import Message
from app.schemas.contact import (
    ContactCreate, ContactOut, ContactUpdate,
    PaginatedContacts, SegmentPreviewRequest,
)

router = APIRouter(prefix="/workspaces/{workspace_id}/contacts", tags=["contacts"])

WorkspaceDep = Annotated[object, Depends(get_workspace)]


def _e164(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    return f"+{digits}" if not digits.startswith("+") else phone


# ── List ──────────────────────────────────────────────────────────────────────
@router.get("/", response_model=PaginatedContacts)
async def list_contacts(
    workspace_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace=Depends(get_workspace),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = None,
    tag: str | None = None,
    opted_in: bool | None = None,
):
    q = select(Contact).where(Contact.workspace_id == workspace_id)
    if search:
        q = q.where(or_(Contact.name.ilike(f"%{search}%"), Contact.phone_number.ilike(f"%{search}%")))
    if tag:
        q = q.where(Contact.tags.any(tag))
    if opted_in is not None:
        q = q.where(Contact.opted_in == opted_in)

    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar_one()

    q = q.offset((page - 1) * limit).limit(limit).order_by(Contact.created_at.desc())
    result = await db.execute(q)
    return PaginatedContacts(items=result.scalars().all(), total=total, page=page, limit=limit)


# ── Create ────────────────────────────────────────────────────────────────────
@router.post("/", response_model=ContactOut, status_code=201)
async def create_contact(
    workspace_id: uuid.UUID,
    body: ContactCreate,
    user: CurrentUser,
    db: DbDep,
    workspace=Depends(get_workspace),
):
    phone = _e164(body.phone_number)
    existing = await db.execute(
        select(Contact).where(Contact.workspace_id == workspace_id, Contact.phone_number == phone)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Contact with this phone already exists")

    contact = Contact(workspace_id=workspace_id, phone_number=phone, **body.model_dump(exclude={"phone_number"}))
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact


# ── Get ───────────────────────────────────────────────────────────────────────
@router.get("/{contact_id}", response_model=ContactOut)
async def get_contact(
    workspace_id: uuid.UUID, contact_id: uuid.UUID,
    user: CurrentUser, db: DbDep, workspace=Depends(get_workspace),
):
    return await _get_or_404(db, workspace_id, contact_id)


# ── Update ────────────────────────────────────────────────────────────────────
@router.put("/{contact_id}", response_model=ContactOut)
async def update_contact(
    workspace_id: uuid.UUID, contact_id: uuid.UUID,
    body: ContactUpdate, user: CurrentUser, db: DbDep, workspace=Depends(get_workspace),
):
    contact = await _get_or_404(db, workspace_id, contact_id)
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(contact, field, val)
    await db.commit()
    await db.refresh(contact)
    return contact


# ── Delete ────────────────────────────────────────────────────────────────────
@router.delete("/{contact_id}", status_code=204)
async def delete_contact(
    workspace_id: uuid.UUID, contact_id: uuid.UUID,
    user: CurrentUser, db: DbDep, workspace=Depends(get_workspace),
):
    contact = await _get_or_404(db, workspace_id, contact_id)
    await db.delete(contact)
    await db.commit()


# ── Messages history ──────────────────────────────────────────────────────────
@router.get("/{contact_id}/messages")
async def contact_messages(
    workspace_id: uuid.UUID, contact_id: uuid.UUID,
    user: CurrentUser, db: DbDep, workspace=Depends(get_workspace),
    page: int = Query(1, ge=1), limit: int = Query(50, ge=1, le=200),
):
    await _get_or_404(db, workspace_id, contact_id)
    q = (
        select(Message)
        .where(Message.workspace_id == workspace_id, Message.contact_id == contact_id)
        .order_by(Message.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(q)
    msgs = result.scalars().all()
    return [
        {
            "id": str(m.id),
            "direction": m.direction,
            "message_type": m.message_type,
            "content": m.content,
            "status": m.status,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in msgs
    ]


# ── CSV Import ────────────────────────────────────────────────────────────────
@router.post("/import")
async def import_contacts(
    workspace_id: uuid.UUID,
    file: UploadFile,
    user: CurrentUser,
    db: DbDep,
    workspace=Depends(get_workspace),
):
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
    created = skipped = 0
    for row in reader:
        phone_raw = row.get("phone_number", "").strip()
        if not phone_raw:
            skipped += 1
            continue
        phone = _e164(phone_raw)
        existing = await db.execute(
            select(Contact).where(Contact.workspace_id == workspace_id, Contact.phone_number == phone)
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue
        tags = [t.strip() for t in row.get("tags", "").split(",") if t.strip()]
        db.add(Contact(
            workspace_id=workspace_id,
            phone_number=phone,
            name=row.get("name", "").strip() or None,
            email=row.get("email", "").strip() or None,
            tags=tags,
        ))
        created += 1
    await db.commit()
    return {"created": created, "skipped": skipped}


# ── CSV Export ────────────────────────────────────────────────────────────────
@router.post("/export")
async def export_contacts(
    workspace_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    workspace=Depends(get_workspace),
):
    result = await db.execute(select(Contact).where(Contact.workspace_id == workspace_id))
    contacts = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["phone_number", "name", "email", "tags", "opted_in", "last_seen"])
    for c in contacts:
        writer.writerow([c.phone_number, c.name or "", c.email or "", ",".join(c.tags or []), c.opted_in, c.last_seen or ""])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=contacts.csv"},
    )


# ── Tags ──────────────────────────────────────────────────────────────────────
@router.get("/tags/all")
async def list_tags(workspace_id: uuid.UUID, user: CurrentUser, db: DbDep, workspace=Depends(get_workspace)):
    result = await db.execute(select(ContactTag).where(ContactTag.workspace_id == workspace_id))
    return result.scalars().all()


@router.post("/tags/create", status_code=201)
async def create_tag(
    workspace_id: uuid.UUID, name: str, color: str = "#6366f1",
    user: CurrentUser = None, db: DbDep = None, workspace=Depends(get_workspace),
):
    tag = ContactTag(workspace_id=workspace_id, name=name, color=color)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return tag


@router.post("/{contact_id}/tags")
async def add_tag(
    workspace_id: uuid.UUID, contact_id: uuid.UUID, tag: str,
    user: CurrentUser, db: DbDep, workspace=Depends(get_workspace),
):
    contact = await _get_or_404(db, workspace_id, contact_id)
    tags = list(contact.tags or [])
    if tag not in tags:
        tags.append(tag)
        contact.tags = tags
        await db.commit()
    return {"tags": contact.tags}


@router.delete("/{contact_id}/tags/{tag}")
async def remove_tag(
    workspace_id: uuid.UUID, contact_id: uuid.UUID, tag: str,
    user: CurrentUser, db: DbDep, workspace=Depends(get_workspace),
):
    contact = await _get_or_404(db, workspace_id, contact_id)
    contact.tags = [t for t in (contact.tags or []) if t != tag]
    await db.commit()
    return {"tags": contact.tags}


# ── Segment preview ───────────────────────────────────────────────────────────
@router.post("/segment/preview")
async def segment_preview(
    workspace_id: uuid.UUID,
    body: SegmentPreviewRequest,
    user: CurrentUser,
    db: DbDep,
    workspace=Depends(get_workspace),
):
    q = select(func.count(Contact.id)).where(Contact.workspace_id == workspace_id)
    for f in body.filters:
        q = _apply_filter(q, f)
    result = await db.execute(q)
    return {"count": result.scalar_one()}


def _apply_filter(q, f):
    from app.schemas.contact import SegmentFilter
    field, op, val = f.field, f.operator, f.value
    if field == "tag":
        if op == "contains":
            return q.where(Contact.tags.any(val))
        if op == "not_contains":
            return q.where(~Contact.tags.any(val))
    if field == "name":
        if op == "contains":
            return q.where(Contact.name.ilike(f"%{val}%"))
    if field == "phone":
        if op == "contains":
            return q.where(Contact.phone_number.ilike(f"%{val}%"))
    if field == "opted_in":
        return q.where(Contact.opted_in == (op == "is_true"))
    if field == "last_seen":
        if op == "before":
            return q.where(Contact.last_seen < val)
        if op == "after":
            return q.where(Contact.last_seen > val)
    return q


async def _get_or_404(db: AsyncSession, workspace_id: uuid.UUID, contact_id: uuid.UUID) -> Contact:
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id, Contact.workspace_id == workspace_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact
