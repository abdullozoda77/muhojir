from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import Field, model_validator
from sqlalchemy import func, or_, select

from app.core.deps import DB, CurrentUser, EditorUser, OptionalUser
from app.core.errors import ApiError, FieldError
from app.core.pagination import Paginate
from app.core.throttle import throttle
from app.models import PARCEL_KINDS, TJ_CITIES, Parcel
from app.routers.documents import param
from app.schemas.common import Form
from app.schemas.market import NO_CONTACT, ShopFields, owner_name

router = APIRouter(prefix="/api/parcels", tags=["parcels"])

MOSCOW = timezone(timedelta(hours=3))
NOT_FOUND = "No Parcel matches the given query."
Kind = Literal[tuple(PARCEL_KINDS)]


def today():
    return datetime.now(MOSCOW).date()


class ParcelIn(ShopFields):
    kind: Kind
    from_city: str = Field(min_length=2, max_length=100)
    to_city: str = Field(min_length=2, max_length=100)
    travel_date: date
    weight_kg: int | None = Field(None, ge=1, le=500)
    price_per_kg: int | None = Field(None, ge=0, le=100_000)
    description: str = Field("", max_length=1000)
    phone: str = ""
    whatsapp: str = ""
    telegram: str = ""

    @model_validator(mode="after")
    def has_contact(self):
        if not (self.phone or self.whatsapp or self.telegram):
            raise ValueError(NO_CONTACT)
        return self


class HidePatch(Form):
    is_hidden: bool


def parcel_json(p, viewer=None):
    data = {
        "id": p.id, "kind": p.kind, "kind_label": p.kind_label, "from_city": p.from_city, "to_city": p.to_city,
        "travel_date": p.travel_date, "weight_kg": p.weight_kg, "price_per_kg": p.price_per_kg,
        "description": p.description, "phone": p.phone, "whatsapp": p.whatsapp, "telegram": p.telegram,
        "name": owner_name(p.user), "created_at": p.created_at,
        "mine": bool(viewer and viewer.id == p.user_id),
        "can_delete": bool(viewer and (viewer.is_editor or viewer.id == p.user_id)),
    }
    if viewer and viewer.is_editor:
        data["is_hidden"] = p.is_hidden
    return data


@router.get("/")
async def list_parcels(request: Request, db: DB, page: Paginate, viewer: OptionalUser):
    query = select(Parcel).where(Parcel.is_hidden.is_(False))
    if param(request, "mine") == "true":
        if viewer is None:
            raise ApiError("Учетные данные не были предоставлены.", 401)
        query = query.where(Parcel.user_id == viewer.id)
    else:
        query = query.where(Parcel.travel_date >= today())
    if (kind := param(request, "kind")) in PARCEL_KINDS:
        query = query.where(Parcel.kind == kind)
    if from_city := (param(request, "from_city") or "").strip():
        query = query.where(Parcel.from_city.ilike(f"%{from_city}%"))
    if to_city := (param(request, "to_city") or "").strip():
        query = query.where(Parcel.to_city.ilike(f"%{to_city}%"))
    if search := (param(request, "search") or "").strip():
        like = f"%{search}%"
        query = query.where(or_(Parcel.from_city.ilike(like), Parcel.to_city.ilike(like), Parcel.description.ilike(like)))
    query = query.order_by(Parcel.travel_date, Parcel.id.desc())
    return await page.respond(db, query, lambda p: parcel_json(p, viewer))


@router.get("/summary/")
async def parcels_summary(db: DB):
    shown = select(Parcel).where(Parcel.is_hidden.is_(False), Parcel.travel_date >= today()).subquery()
    kinds = dict((await db.execute(select(shown.c.kind, func.count()).group_by(shown.c.kind))).all())
    return {"total": sum(kinds.values()), "kinds": {k: kinds.get(k, 0) for k in PARCEL_KINDS}, "tj_cities": list(TJ_CITIES)}


@router.post("/", status_code=201, dependencies=[Depends(throttle("parcel"))])
async def add_parcel(data: ParcelIn, db: DB, user: CurrentUser):
    if data.travel_date < today():
        raise FieldError("travel_date", "The date has already passed.")
    if data.travel_date > today() + timedelta(days=180):
        raise FieldError("travel_date", "Choose a date within the next 6 months.")
    parcel = Parcel(**data.model_dump(), user_id=user.id)
    db.add(parcel)
    await db.commit()
    await db.refresh(parcel)
    return parcel_json(parcel, user)


@router.patch("/{parcel_id}/")
async def hide_parcel(parcel_id: int, data: HidePatch, db: DB, user: EditorUser):
    parcel = await db.get(Parcel, parcel_id)
    if parcel is None:
        raise ApiError(NOT_FOUND, 404)
    parcel.is_hidden = data.is_hidden
    await db.commit()
    await db.refresh(parcel)
    return parcel_json(parcel, user)


@router.delete("/{parcel_id}/", status_code=204)
async def delete_parcel(parcel_id: int, db: DB, user: CurrentUser):
    parcel = await db.get(Parcel, parcel_id)
    if parcel is None or not (user.is_editor or parcel.user_id == user.id):
        raise ApiError(NOT_FOUND, 404)
    await db.delete(parcel)
    await db.commit()
