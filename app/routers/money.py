from datetime import date
from decimal import Decimal

from fastapi import APIRouter
from pydantic import Field, field_validator
from sqlalchemy import extract, select

from app.core.deps import DB, CurrentUser
from app.core.errors import ApiError
from app.models import REMITTANCE_SERVICES, Payment, Remittance
from app.schemas.common import Form
from app.schemas.documents import day, money
from app.services import stats

router = APIRouter(prefix="/api/money", tags=["money"])

NOT_FOUND = "No Remittance matches the given query."


class RemittanceIn(Form):
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    fee: Decimal = Field(Decimal(0), ge=0, max_digits=10, decimal_places=2)
    service: str = "other"
    recipient: str = Field("", max_length=100)
    sent_at: date | None = None
    note: str = Field("", max_length=255)

    @field_validator("service")
    @classmethod
    def known_service(cls, value):
        if value not in REMITTANCE_SERVICES:
            raise ValueError("Unknown money transfer service.")
        return value

    @field_validator("sent_at")
    @classmethod
    def not_in_future(cls, value):
        if value and value > stats.today():
            raise ValueError("The date cannot be in the future.")
        return value


def remittance_json(r):
    return {"id": r.id, "amount": money(r.amount), "fee": money(r.fee), "service": r.service,
            "service_label": r.service_label, "recipient": r.recipient, "sent_at": day(r.sent_at),
            "note": r.note, "created_at": r.created_at}


def year_of(value):
    return value if value and 2000 <= value <= 2100 else stats.today().year


@router.get("/services/")
async def services():
    return [{"value": key, "label": label} for key, label in REMITTANCE_SERVICES.items()]


@router.get("/remittances/")
async def list_remittances(db: DB, user: CurrentUser, year: int | None = None):
    rows = await db.scalars(select(Remittance).where(
        Remittance.user_id == user.id, extract("year", Remittance.sent_at) == year_of(year))
        .order_by(Remittance.sent_at.desc(), Remittance.id.desc()))
    return [remittance_json(r) for r in rows]


@router.post("/remittances/", status_code=201)
async def create_remittance(data: RemittanceIn, db: DB, user: CurrentUser):
    remittance = Remittance(user_id=user.id, **data.model_dump(exclude={"sent_at"}),
                            sent_at=data.sent_at or stats.today())
    remittance.recipient, remittance.note = remittance.recipient.strip(), remittance.note.strip()
    db.add(remittance)
    await db.commit()
    await db.refresh(remittance)
    return remittance_json(remittance)


@router.delete("/remittances/{remittance_id}/", status_code=204)
async def delete_remittance(remittance_id: int, db: DB, user: CurrentUser):
    remittance = await db.get(Remittance, remittance_id)
    if remittance is None or remittance.user_id != user.id:
        raise ApiError(NOT_FOUND, 404)
    await db.delete(remittance)
    await db.commit()


@router.get("/report/")
async def report(db: DB, user: CurrentUser, year: int | None = None):
    year = year_of(year)
    months = [{"month": m, "sent": Decimal(0), "fees": Decimal(0), "patent": Decimal(0), "transfers": 0, "payments": 0}
              for m in range(1, 13)]
    services = {}
    sent = (await db.scalars(select(Remittance).where(
        Remittance.user_id == user.id, extract("year", Remittance.sent_at) == year))).all()
    for r in sent:
        row = months[r.sent_at.month - 1]
        row["sent"] += r.amount
        row["fees"] += r.fee
        row["transfers"] += 1
        services[r.service] = services.get(r.service, Decimal(0)) + r.amount
    paid = (await db.execute(select(Payment.paid_at, Payment.amount).where(
        Payment.user_id == user.id, extract("year", Payment.paid_at) == year))).all()
    for paid_at, amount in paid:
        row = months[paid_at.month - 1]
        row["patent"] += amount
        row["payments"] += 1
    years = {year, stats.today().year}
    for model, column in ((Remittance, Remittance.sent_at), (Payment, Payment.paid_at)):
        found = await db.scalars(select(extract("year", column)).where(model.user_id == user.id).distinct())
        years.update(int(y) for y in found if y)
    totals = {key: sum((m[key] for m in months), Decimal(0)) for key in ("sent", "fees", "patent")}
    return {
        "year": year,
        "years": sorted(years, reverse=True),
        "months": [{**m, "sent": money(m["sent"]), "fees": money(m["fees"]), "patent": money(m["patent"])} for m in months],
        "totals": {key: money(value) for key, value in totals.items()},
        "services": [{"service": key, "label": REMITTANCE_SERVICES[key], "sent": money(value)}
                     for key, value in sorted(services.items(), key=lambda item: -item[1])],
    }
