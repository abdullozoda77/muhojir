from typing import Literal

from fastapi import APIRouter
from pydantic import Field
from sqlalchemy import or_, select

from app.core.crud import add_content_routes
from app.core.deps import editor_user
from app.models import HelpContact, Region
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
    region_id: int | None = Field(None, alias="region")
    order: int = Field(0, ge=0)
    is_active: bool = True


class ContactPatch(ContactIn):
    kind: Kind | None = None
    title: str | None = Field(None, max_length=200)
    is_active: bool | None = None


def contact_json(c):
    return {"id": c.id, "kind": c.kind, "title": c.title, "phone": c.phone, "website": c.website,
            "description": c.description, "region": c.region_id, "region_name": c.region.name if c.region else None,
            "order": c.order, "is_active": c.is_active}


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
