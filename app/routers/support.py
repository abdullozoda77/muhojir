from typing import Literal

from datetime import timedelta

from fastapi import APIRouter, Response
from pydantic import Field
from sqlalchemy import or_, select

from app.core.crud import add_content_routes
from app.core.deps import DB, CurrentUser, OptionalUser, editor_user
from app.core.errors import ApiError
from app.core.i18n import tr
from app.db.types import utcnow
from app.models import CheckResult, DocumentType, HelpContact, Region, UserDocument
from app.schemas.documents import day
from app.routers.documents import int_param, must_exist, param
from app.schemas.common import Form


router = APIRouter(prefix="/api/help", tags=["help"])
Kind = Literal["info", "embassy", "hotline", "lawyer", "mvd_check", "other"]


class ContactIn(Form):
    kind: Kind = "other"
    title: str = Field(max_length=200)
    phone: str = Field("", max_length=30)
    website: str = Field("", max_length=200)
    description: str = ""
    title_ru: str = Field("", max_length=200)
    description_ru: str = ""
    needs: str = ""
    needs_ru: str = ""
    if_bad: str = ""
    if_bad_ru: str = ""
    documents: str = Field("", max_length=100)
    repeat_days: int | None = Field(None, ge=1, le=3650)
    region_id: int | None = Field(None, alias="region")
    order: int = Field(0, ge=0)
    is_active: bool = True


class ContactPatch(ContactIn):
    kind: Kind | None = None
    title: str | None = Field(None, max_length=200)
    is_active: bool | None = None


def contact_json(c):
    return {"id": c.id, "kind": c.kind, "title": tr(c, "title"), "phone": c.phone, "website": c.website,
            "description": tr(c, "description"), "region": c.region_id, "region_name": c.region.name if c.region else None,
            "needs": tr(c, "needs"), "if_bad": tr(c, "if_bad"), "documents": slugs(c), "repeat_days": c.repeat_days,
            "order": c.order, "is_active": c.is_active}


def slugs(contact):
    return [slug.strip() for slug in (contact.documents or "").split(",") if slug.strip()]


def contacts_query(request, user):
    query = select(HelpContact)
    if not (user and user.is_editor):
        query = query.where(HelpContact.is_active.is_(True))
    if param(request, "kind"):
        query = query.where(HelpContact.kind == param(request, "kind"))
    if (region := int_param(request, "region")) is not None:
        query = query.where(HelpContact.region_id == region)
    if words := param(request, "search"):
        query = query.where(or_(HelpContact.title.ilike(f"%{words}%"), HelpContact.description.ilike(f"%{words}%"),
                                HelpContact.phone.ilike(f"%{words}%")))
    return query.order_by(HelpContact.order, HelpContact.title)


async def check_contact(db, contact, data):
    await must_exist(db, Region, contact.region_id, "region")


add_content_routes(router, "contacts", model=HelpContact, to_json=contact_json, Create=ContactIn, Update=ContactPatch,
                   query=contacts_query, writer=editor_user, check=check_contact)


class ResultIn(Form):
    result: Literal["ok", "problem"]


def result_json(contact, result):
    if result is None:
        return None
    due_at = result.checked_at + timedelta(days=contact.repeat_days) if contact.repeat_days else None
    return {"result": result.result, "checked_at": result.checked_at, "due_at": due_at,
            "is_due": bool(due_at and due_at <= utcnow())}


async def my_papers(db, user, contacts):
    wanted = {slug for contact in contacts for slug in slugs(contact)}
    if user is None or not wanted:
        return {}
    papers = await db.scalars(select(UserDocument).join(DocumentType).where(UserDocument.user_id == user.id,
                              DocumentType.slug.in_(wanted)).order_by(UserDocument.expires_at.desc()))
    by_slug = {}
    for paper in papers.unique():
        by_slug.setdefault(paper.document_type.slug, []).append({
            "id": paper.id, "title": tr(paper.document_type, "title"), "number": paper.number,
            "issued_at": day(paper.issued_at), "expires_at": day(paper.expires_at), "status": paper.status})
    return by_slug


async def checks_json(db, user, contacts):
    results = {}
    if user is not None and contacts:
        rows = await db.scalars(select(CheckResult).where(CheckResult.user_id == user.id,
                                                          CheckResult.contact_id.in_([c.id for c in contacts])))
        results = {r.contact_id: r for r in rows}
    papers = await my_papers(db, user, contacts)
    return [{**contact_json(c), "my_result": result_json(c, results.get(c.id)),
             "my_documents": [p for slug in slugs(c) for p in papers.get(slug, [])]} for c in contacts]


async def get_check(db, check_id):
    contact = await db.scalar(select(HelpContact).where(HelpContact.id == check_id, HelpContact.kind == "mvd_check",
                                                        HelpContact.is_active.is_(True)))
    if contact is None:
        raise ApiError("No HelpContact matches the given query.", 404)
    return contact


@router.get("/checks/")
async def list_checks(db: DB, user: OptionalUser):
    contacts = (await db.scalars(select(HelpContact).where(HelpContact.kind == "mvd_check", HelpContact.is_active.is_(True))
                                 .order_by(HelpContact.order, HelpContact.title))).unique().all()
    return await checks_json(db, user, contacts)


@router.put("/checks/{check_id}/result/")
async def save_result(check_id: int, data: ResultIn, db: DB, user: CurrentUser):
    contact = await get_check(db, check_id)
    result = await db.scalar(select(CheckResult).where(CheckResult.user_id == user.id, CheckResult.contact_id == contact.id))
    if result is None:
        result = CheckResult(user_id=user.id, contact_id=contact.id, result=data.result)
        db.add(result)
    result.result, result.checked_at = data.result, utcnow()
    await db.commit()
    return (await checks_json(db, user, [contact]))[0]


@router.delete("/checks/{check_id}/result/", status_code=204)
async def delete_result(check_id: int, db: DB, user: CurrentUser):
    contact = await get_check(db, check_id)
    result = await db.scalar(select(CheckResult).where(CheckResult.user_id == user.id, CheckResult.contact_id == contact.id))
    if result is not None:
        await db.delete(result)
        await db.commit()
    return Response(status_code=204)
