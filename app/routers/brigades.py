from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import Field, model_validator
from sqlalchemy import exists, func, or_, select

from app.core.deps import DB, CurrentUser, OptionalUser
from app.core.errors import ApiError, FieldError
from app.core.pagination import Paginate
from app.core.throttle import throttle
from app.models import BRIGADE_TRADES, Brigade, BrigadeMember, BrigadeOrder, BrigadeReview
from app.routers.documents import param
from app.schemas.common import Form
from app.schemas.market import NO_CONTACT, ShopFields, hide_contacts, owner_name
from app.services.notify import notify

router = APIRouter(prefix="/api/brigades", tags=["brigades"])

MOSCOW = timezone(timedelta(hours=3))
NOT_FOUND = "No Brigade matches the given query."
ORDER_NOT_FOUND = "No BrigadeOrder matches the given query."
MEMBER_NOT_FOUND = "No BrigadeMember matches the given query."
Trade = Literal[tuple(BRIGADE_TRADES)]


def today():
    return datetime.now(MOSCOW).date()


class BrigadeIn(ShopFields):
    name: str = Field(min_length=3, max_length=120)
    trade: Trade
    city: str = Field(min_length=2, max_length=100)
    size: int = Field(ge=2, le=100)
    experience_years: int | None = Field(None, ge=0, le=60)
    price_note: str = Field("", max_length=120)
    description: str = Field("", max_length=2000)
    phone: str = ""
    whatsapp: str = ""
    telegram: str = ""
    is_free: bool = True

    @model_validator(mode="after")
    def has_contact(self):
        if not (self.phone or self.whatsapp or self.telegram):
            raise ValueError(NO_CONTACT)
        return self


class BrigadePatch(ShopFields):
    name: str | None = Field(None, min_length=3, max_length=120)
    trade: Trade | None = None
    city: str | None = Field(None, min_length=2, max_length=100)
    size: int | None = Field(None, ge=2, le=100)
    experience_years: int | None = Field(None, ge=0, le=60)
    price_note: str | None = Field(None, max_length=120)
    description: str | None = Field(None, max_length=2000)
    phone: str | None = None
    whatsapp: str | None = None
    telegram: str | None = None
    is_free: bool | None = None
    is_hidden: bool | None = None


class JoinIn(Form):
    skill: str = Field("", max_length=80)


class MemberPatch(Form):
    status: Literal["accepted"]


class OrderIn(ShopFields):
    description: str = Field(min_length=10, max_length=2000)
    city: str = Field("", max_length=100)
    start_date: date | None = None
    workers: int | None = Field(None, ge=1, le=100)
    budget: int | None = Field(None, ge=0, le=100_000_000)
    phone: str = Field(min_length=1)


class OrderPatch(Form):
    status: Literal["accepted", "declined", "done"]


class ReviewIn(Form):
    rating: int = Field(ge=1, le=5)
    text: str = Field("", max_length=1000)


def stats_columns():
    rating = select(func.avg(BrigadeReview.rating)).where(BrigadeReview.brigade_id == Brigade.id).scalar_subquery()
    reviews = select(func.count(BrigadeReview.id)).where(BrigadeReview.brigade_id == Brigade.id).scalar_subquery()
    members = select(func.count(BrigadeMember.id)).where(
        BrigadeMember.brigade_id == Brigade.id, BrigadeMember.status == "accepted").scalar_subquery()
    done = select(func.count(BrigadeOrder.id)).where(
        BrigadeOrder.brigade_id == Brigade.id, BrigadeOrder.status == "done").scalar_subquery()
    return rating, reviews, members, done


def brigade_json(b, rating=None, reviews=0, members=0, done=0, viewer=None):
    data = {
        "id": b.id, "name": b.name, "trade": b.trade, "trade_label": b.trade_label, "city": b.city, "size": b.size,
        "experience_years": b.experience_years, "price_note": b.price_note, "description": b.description,
        "phone": b.phone, "whatsapp": b.whatsapp, "telegram": b.telegram, "is_free": b.is_free,
        "leader": owner_name(b.user), "created_at": b.created_at,
        "rating": round(float(rating), 1) if rating is not None else None, "reviews": reviews or 0,
        "members": (members or 0) + 1, "jobs_done": done or 0,
        "mine": bool(viewer and viewer.id == b.user_id),
        "can_edit": bool(viewer and (viewer.is_editor or viewer.id == b.user_id)),
    }
    if viewer is None:
        data.update(phone="", whatsapp="", telegram="", description=hide_contacts(b.description))
    if viewer and viewer.is_editor:
        data["is_hidden"] = b.is_hidden
    return data


def order_json(o, viewer, reviewed=False):
    leader = viewer.id == o.brigade.user_id
    return {
        "id": o.id, "brigade": {"id": o.brigade.id, "name": o.brigade.name, "trade_label": o.brigade.trade_label},
        "customer": owner_name(o.user), "phone": o.phone if leader or viewer.id == o.user_id else "",
        "city": o.city, "description": o.description, "start_date": o.start_date, "workers": o.workers,
        "budget": o.budget, "status": o.status, "status_label": o.status_label, "created_at": o.created_at,
        "incoming": leader, "reviewed": reviewed,
        "can_review": viewer.id == o.user_id and o.status == "done" and not reviewed,
    }


async def get_brigade(db, brigade_id, viewer=None):
    brigade = await db.get(Brigade, brigade_id)
    if brigade is None or (brigade.is_hidden and not (viewer and (viewer.is_editor or viewer.id == brigade.user_id))):
        raise ApiError(NOT_FOUND, 404)
    return brigade


def own(brigade, user):
    if not (user.is_editor or user.id == brigade.user_id):
        raise ApiError("Only the brigade leader can do this.", 403)


@router.get("/")
async def list_brigades(request: Request, db: DB, page: Paginate, viewer: OptionalUser):
    query = select(Brigade, *stats_columns())
    if param(request, "mine") == "true":
        if viewer is None:
            raise ApiError("Учетные данные не были предоставлены.", 401)
        member = exists().where(BrigadeMember.brigade_id == Brigade.id, BrigadeMember.user_id == viewer.id,
                                BrigadeMember.status == "accepted")
        query = query.where(or_(Brigade.user_id == viewer.id, member))
    else:
        query = query.where(Brigade.is_hidden.is_(False))
    if (trade := param(request, "trade")) in BRIGADE_TRADES:
        query = query.where(Brigade.trade == trade)
    if city := (param(request, "city") or "").strip():
        query = query.where(Brigade.city.ilike(f"%{city}%"))
    if param(request, "free") == "true":
        query = query.where(Brigade.is_free.is_(True))
    if search := (param(request, "search") or "").strip():
        like = f"%{search}%"
        query = query.where(or_(Brigade.name.ilike(like), Brigade.description.ilike(like), Brigade.price_note.ilike(like)))
    query = query.order_by(Brigade.is_free.desc(), Brigade.created_at.desc())
    return await page.respond(db, query, lambda b, *stats: brigade_json(b, *stats, viewer=viewer))


@router.get("/summary/")
async def brigades_summary(db: DB, viewer: OptionalUser):
    shown = select(Brigade).where(Brigade.is_hidden.is_(False)).subquery()
    trades = dict((await db.execute(select(shown.c.trade, func.count()).group_by(shown.c.trade))).all())
    free = await db.scalar(select(func.count()).select_from(shown).where(shown.c.is_free.is_(True)))
    data = {
        "total": sum(trades.values()), "free": free or 0,
        "trades": [{"value": k, "label": v, "count": trades.get(k, 0)} for k, v in BRIGADE_TRADES.items()],
    }
    if viewer:
        data["incoming_new"] = await db.scalar(
            select(func.count(BrigadeOrder.id)).join(Brigade, Brigade.id == BrigadeOrder.brigade_id)
            .where(Brigade.user_id == viewer.id, BrigadeOrder.status == "new")) or 0
        data["outgoing"] = await db.scalar(select(func.count(BrigadeOrder.id)).where(BrigadeOrder.user_id == viewer.id)) or 0
        data["leads"] = await db.scalar(select(func.count(Brigade.id)).where(Brigade.user_id == viewer.id)) or 0
    return data


@router.post("/", status_code=201, dependencies=[Depends(throttle("brigade"))])
async def add_brigade(data: BrigadeIn, db: DB, user: CurrentUser):
    brigade = Brigade(**data.model_dump(), user_id=user.id)
    db.add(brigade)
    await db.commit()
    await db.refresh(brigade)
    return brigade_json(brigade, viewer=user)


@router.get("/orders/")
async def list_orders(request: Request, db: DB, page: Paginate, user: CurrentUser):
    query = select(BrigadeOrder, exists().where(BrigadeReview.order_id == BrigadeOrder.id))
    if param(request, "box") == "out":
        query = query.where(BrigadeOrder.user_id == user.id)
    else:
        query = query.join(Brigade, Brigade.id == BrigadeOrder.brigade_id).where(Brigade.user_id == user.id)
    if (status := param(request, "status")) in ("new", "accepted", "declined", "done"):
        query = query.where(BrigadeOrder.status == status)
    query = query.order_by(BrigadeOrder.created_at.desc())
    return await page.respond(db, query, lambda o, reviewed: order_json(o, user, reviewed))


async def get_order(db, order_id, user):
    order = await db.get(BrigadeOrder, order_id)
    if order is None or user.id not in (order.user_id, order.brigade.user_id):
        raise ApiError(ORDER_NOT_FOUND, 404)
    return order


@router.patch("/orders/{order_id}/")
async def update_order(order_id: int, data: OrderPatch, db: DB, user: CurrentUser):
    order = await get_order(db, order_id, user)
    if user.id != order.brigade.user_id:
        raise ApiError("Only the brigade leader can do this.", 403)
    allowed = {"new": ("accepted", "declined"), "accepted": ("done", "declined")}.get(order.status, ())
    if data.status not in allowed:
        raise FieldError("status", "This order cannot be changed like that.")
    order.status = data.status
    await db.commit()
    await db.refresh(order)
    texts = {
        "accepted": "фармоиши шуморо қабул кард. Бо шумо тамос мегиранд.",
        "declined": "фармоиши шуморо рад кард. Гурӯҳи дигарро интихоб кунед.",
        "done": "корро тамом кард. Лутфан ба гурӯҳ баҳо диҳед.",
    }
    await notify(db, order.user, f"Гурӯҳ «{order.brigade.name}»", f"Гурӯҳ «{order.brigade.name}» {texts[order.status]}",
                 url="/groups?tab=orders")
    return order_json(order, user)


@router.delete("/orders/{order_id}/", status_code=204)
async def cancel_order(order_id: int, db: DB, user: CurrentUser):
    order = await get_order(db, order_id, user)
    if user.id != order.user_id or order.status != "new":
        raise ApiError("Only a new order can be cancelled by the customer.", 400)
    await db.delete(order)
    await db.commit()


@router.post("/orders/{order_id}/review/", status_code=201)
async def review_order(order_id: int, data: ReviewIn, db: DB, user: CurrentUser):
    order = await get_order(db, order_id, user)
    if user.id != order.user_id or order.status != "done":
        raise ApiError("You can rate the brigade after the work is done.", 400)
    if await db.scalar(select(exists().where(BrigadeReview.order_id == order.id))):
        raise ApiError("You already rated this work.", 400)
    review = BrigadeReview(brigade_id=order.brigade_id, order_id=order.id, user_id=user.id, rating=data.rating, text=data.text)
    db.add(review)
    await db.commit()
    await notify(db, order.brigade.user, "Баҳои нав ба гурӯҳ",
                 f"Ба гурӯҳи «{order.brigade.name}» {data.rating} ситора доданд.", url=f"/groups/{order.brigade_id}")
    return {"id": review.id, "rating": review.rating, "text": review.text}


@router.get("/{brigade_id}/")
async def brigade_detail(brigade_id: int, db: DB, viewer: OptionalUser):
    await get_brigade(db, brigade_id, viewer)
    row = (await db.execute(select(Brigade, *stats_columns()).where(Brigade.id == brigade_id))).first()
    brigade = row[0]
    data = brigade_json(*row, viewer=viewer)
    leader = viewer is not None and viewer.id == brigade.user_id
    members = (await db.scalars(select(BrigadeMember).where(BrigadeMember.brigade_id == brigade.id)
                                .order_by(BrigadeMember.created_at))).all()
    data["team"] = [{"id": None, "name": owner_name(brigade.user), "skill": "", "status": "leader"}] + [
        {"id": m.id, "name": owner_name(m.user), "skill": m.skill, "status": m.status}
        for m in members if m.status == "accepted" or leader or (viewer and m.user_id == viewer.id)
    ]
    mine = next((m for m in members if viewer and m.user_id == viewer.id), None)
    data["my_status"] = "leader" if leader else (mine.status if mine else None)
    reviews = (await db.scalars(select(BrigadeReview).where(BrigadeReview.brigade_id == brigade.id)
                                .order_by(BrigadeReview.created_at.desc()).limit(30))).all()
    data["review_list"] = [{"id": r.id, "name": owner_name(r.user), "rating": r.rating, "text": r.text,
                            "created_at": r.created_at} for r in reviews]
    return data


@router.patch("/{brigade_id}/")
async def update_brigade(brigade_id: int, data: BrigadePatch, db: DB, user: CurrentUser):
    brigade = await get_brigade(db, brigade_id, user)
    own(brigade, user)
    changes = data.model_dump(exclude_unset=True)
    if "is_hidden" in changes and not user.is_editor:
        raise ApiError("Only editors can hide a brigade.", 403)
    for key, value in changes.items():
        if value is None and key not in ("experience_years",):
            continue
        setattr(brigade, key, value)
    if not (brigade.phone or brigade.whatsapp or brigade.telegram):
        raise ApiError(NO_CONTACT, 400)
    await db.commit()
    return await brigade_detail(brigade_id, db, user)


@router.delete("/{brigade_id}/", status_code=204)
async def delete_brigade(brigade_id: int, db: DB, user: CurrentUser):
    brigade = await get_brigade(db, brigade_id, user)
    own(brigade, user)
    await db.delete(brigade)
    await db.commit()


@router.post("/{brigade_id}/join/", status_code=201, dependencies=[Depends(throttle("brigade_join"))])
async def join_brigade(brigade_id: int, data: JoinIn, db: DB, user: CurrentUser):
    brigade = await get_brigade(db, brigade_id)
    if brigade.user_id == user.id:
        raise ApiError("You lead this brigade.", 400)
    if await db.scalar(select(exists().where(BrigadeMember.brigade_id == brigade.id, BrigadeMember.user_id == user.id))):
        raise ApiError("You already asked to join this brigade.", 400)
    db.add(BrigadeMember(brigade_id=brigade.id, user_id=user.id, skill=data.skill))
    await db.commit()
    skill = f" ({data.skill})" if data.skill else ""
    await notify(db, brigade.user, "Устои нав мехоҳад ба гурӯҳ ҳамроҳ шавад",
                 f"{owner_name(user)}{skill} мехоҳад ба гурӯҳи «{brigade.name}» ҳамроҳ шавад.", url=f"/groups/{brigade.id}")
    return {"status": "pending"}


@router.delete("/{brigade_id}/join/", status_code=204)
async def leave_brigade(brigade_id: int, db: DB, user: CurrentUser):
    member = await db.scalar(select(BrigadeMember).where(BrigadeMember.brigade_id == brigade_id, BrigadeMember.user_id == user.id))
    if member is None:
        raise ApiError(MEMBER_NOT_FOUND, 404)
    await db.delete(member)
    await db.commit()


async def get_member(db, brigade_id, member_id, user):
    brigade = await get_brigade(db, brigade_id, user)
    own(brigade, user)
    member = await db.get(BrigadeMember, member_id)
    if member is None or member.brigade_id != brigade.id:
        raise ApiError(MEMBER_NOT_FOUND, 404)
    return brigade, member


@router.patch("/{brigade_id}/members/{member_id}/")
async def accept_member(brigade_id: int, member_id: int, data: MemberPatch, db: DB, user: CurrentUser):
    brigade, member = await get_member(db, brigade_id, member_id, user)
    member.status = data.status
    await db.commit()
    await notify(db, member.user, "Шуморо ба гурӯҳ қабул карданд",
                 f"Акнун шумо аъзои гурӯҳи «{brigade.name}» ҳастед.", url=f"/groups/{brigade.id}")
    return {"id": member.id, "status": member.status}


@router.delete("/{brigade_id}/members/{member_id}/", status_code=204)
async def remove_member(brigade_id: int, member_id: int, db: DB, user: CurrentUser):
    _, member = await get_member(db, brigade_id, member_id, user)
    await db.delete(member)
    await db.commit()


@router.post("/{brigade_id}/orders/", status_code=201, dependencies=[Depends(throttle("brigade_order"))])
async def order_brigade(brigade_id: int, data: OrderIn, db: DB, user: CurrentUser):
    brigade = await get_brigade(db, brigade_id)
    if brigade.user_id == user.id:
        raise ApiError("You cannot hire your own brigade.", 400)
    if data.start_date and data.start_date < today():
        raise FieldError("start_date", "The date has already passed.")
    order = BrigadeOrder(**data.model_dump(), brigade_id=brigade.id, user_id=user.id)
    db.add(order)
    await db.commit()
    await db.refresh(order)
    await notify(db, brigade.user, "Фармоиши нав барои гурӯҳ",
                 f"{owner_name(user)} гурӯҳи «{brigade.name}»-ро ба кор даъват мекунад: {data.description[:120]}",
                 kind="job", url="/groups?tab=orders")
    return order_json(order, user)
