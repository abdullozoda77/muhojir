from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import Field
from sqlalchemy import func, or_, select

from app.core.deps import DB, CurrentUser, EditorUser
from app.core.errors import ApiError, FieldError
from app.core.pagination import Paginate
from app.core.throttle import throttle
from app.db.types import utcnow
from app.models import SCAM_KINDS, SCAM_SCHEMES, SCAM_STATUSES, ScamReport, scam_key, search_keys
from app.routers.documents import param
from app.schemas.common import Form
from app.schemas.market import owner_name
from app.services.notify import notify_editors
from app.services.scams import send_decision

router = APIRouter(prefix="/api/scams", tags=["scams"])

Kind = Literal[tuple(SCAM_KINDS)]
Scheme = Literal[tuple(SCAM_SCHEMES)]
Status = Literal[SCAM_STATUSES]


class ScamIn(Form):
    kind: Kind
    value: str = Field(min_length=3, max_length=200)
    scheme: Scheme = "other"
    description: str = Field(min_length=20, max_length=2000)
    city: str = Field("", max_length=100)
    lost_amount: int | None = Field(None, ge=0, le=100_000_000)


class ScamPatch(Form):
    status: Status | None = None
    note: str | None = Field(None, max_length=2000)


def scam_json(s, viewer=None, reports=None):
    data = {"id": s.id, "kind": s.kind, "kind_label": s.kind_label, "value": s.value, "scheme": s.scheme,
            "scheme_label": s.scheme_label, "description": s.description, "city": s.city,
            "lost_amount": s.lost_amount, "created_at": s.created_at}
    if reports is not None:
        data["reports"] = reports
    if viewer and (viewer.is_editor or viewer.id == s.user_id):
        data.update({"status": s.status, "note": s.note})
    if viewer and viewer.is_editor:
        data.update({"user": s.user_id, "name": owner_name(s.user)})
    return data


async def report_counts(db, keys):
    if not keys:
        return {}
    rows = await db.execute(select(ScamReport.key, func.count()).where(
        ScamReport.status == "approved", ScamReport.key.in_(keys)).group_by(ScamReport.key))
    return dict(rows.all())


@router.get("/")
async def list_scams(request: Request, db: DB, page: Paginate):
    query = select(ScamReport).where(ScamReport.status == "approved").order_by(ScamReport.created_at.desc())
    if (kind := param(request, "kind")) in SCAM_KINDS:
        query = query.where(ScamReport.kind == kind)
    if (scheme := param(request, "scheme")) in SCAM_SCHEMES:
        query = query.where(ScamReport.scheme == scheme)
    if search := (param(request, "search") or "").strip():
        like = f"%{search}%"
        keys = search_keys(search)
        query = query.where(or_(ScamReport.value.ilike(like), ScamReport.description.ilike(like),
                                ScamReport.city.ilike(like), ScamReport.key.in_(keys)))
    data = await page.respond(db, query, lambda s: s)
    counts = await report_counts(db, {s.key for s in data["results"]})
    data["results"] = [scam_json(s, reports=counts.get(s.key, 1)) for s in data["results"]]
    return data


@router.get("/check/", dependencies=[Depends(throttle("scam_check"))])
async def check_scam(request: Request, db: DB):
    query = (param(request, "q") or "").strip()
    keys = search_keys(query)
    if not keys:
        raise FieldError("q", "Write a phone number, Telegram, website or card number.")
    rows = (await db.scalars(select(ScamReport).where(ScamReport.status == "approved", ScamReport.key.in_(keys))
                             .order_by(ScamReport.created_at.desc()).limit(20))).unique().all()
    return {"found": bool(rows), "count": len(rows), "results": [scam_json(s) for s in rows]}


@router.post("/", status_code=201, dependencies=[Depends(throttle("scam"))])
async def report_scam(data: ScamIn, db: DB, user: CurrentUser):
    key = scam_key(data.kind, data.value)
    if len(key) < 4:
        raise FieldError("value", "Write the full number, username or address.")
    duplicate = await db.scalar(select(ScamReport.id).where(
        ScamReport.user_id == user.id, ScamReport.key == key, ScamReport.status != "rejected"))
    if duplicate:
        raise FieldError("value", "You already reported this one.")
    report = ScamReport(**data.model_dump(), key=key, user_id=user.id)
    db.add(report)
    await db.commit()
    await db.refresh(report)
    await notify_editors(db, f"Огоҳии нав: {report.kind_label}",
                         f"{owner_name(user)}: {report.value} — {report.description[:300]}", skip=user)
    return scam_json(report, user)


@router.get("/mine/")
async def my_scams(db: DB, user: CurrentUser):
    rows = await db.scalars(select(ScamReport).where(ScamReport.user_id == user.id).order_by(ScamReport.created_at.desc()))
    return [scam_json(s, user) for s in rows.unique()]


@router.get("/review/")
async def review_scams(request: Request, db: DB, user: EditorUser, page: Paginate):
    query = select(ScamReport).order_by(ScamReport.created_at.desc())
    if (status := param(request, "status")) in SCAM_STATUSES:
        query = query.where(ScamReport.status == status)
    return await page.respond(db, query, lambda s: scam_json(s, user))


@router.patch("/{scam_id}/")
async def update_scam(scam_id: int, data: ScamPatch, db: DB, user: EditorUser):
    report = await db.get(ScamReport, scam_id)
    if report is None:
        raise ApiError("No ScamReport matches the given query.", 404)
    changed = data.status and data.status != report.status
    if data.note is not None:
        report.note = data.note
    if changed:
        report.status = data.status
        report.reviewed_at = utcnow()
    await db.commit()
    await db.refresh(report)
    if changed:
        await send_decision(db, report)
    return scam_json(report, user)


@router.delete("/{scam_id}/", status_code=204)
async def delete_scam(scam_id: int, db: DB, user: CurrentUser):
    report = await db.get(ScamReport, scam_id)
    if report is None or not (user.is_editor or (report.user_id == user.id and report.status == "pending")):
        raise ApiError("No ScamReport matches the given query.", 404)
    await db.delete(report)
    await db.commit()
