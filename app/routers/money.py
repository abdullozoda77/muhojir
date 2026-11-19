from decimal import Decimal

from fastapi import APIRouter
from sqlalchemy import extract, select

from app.core.deps import DB, CurrentUser
from app.core.i18n import tr
from app.models import Payment
from app.schemas.documents import money
from app.services import stats

router = APIRouter(prefix="/api/money", tags=["money"])


def year_of(value):
    return value if value and 2000 <= value <= 2100 else stats.today().year


@router.get("/report/")
async def report(db: DB, user: CurrentUser, year: int | None = None):
    year = year_of(year)
    months = [{"month": m, "paid": Decimal(0), "payments": 0} for m in range(1, 13)]
    documents = {}
    paid = (await db.scalars(select(Payment).where(
        Payment.user_id == user.id, extract("year", Payment.paid_at) == year))).unique().all()
    for payment in paid:
        row = months[payment.paid_at.month - 1]
        row["paid"] += payment.amount
        row["payments"] += 1
        title = tr(payment.document.document_type, "title")
        documents[title] = documents.get(title, Decimal(0)) + payment.amount
    found = await db.scalars(select(extract("year", Payment.paid_at)).where(Payment.user_id == user.id).distinct())
    years = {year, stats.today().year, *(int(y) for y in found if y)}
    return {
        "year": year,
        "years": sorted(years, reverse=True),
        "months": [{**m, "paid": money(m["paid"])} for m in months],
        "total": money(sum((m["paid"] for m in months), Decimal(0))),
        "payments": sum(m["payments"] for m in months),
        "documents": [{"title": title, "paid": money(value)}
                      for title, value in sorted(documents.items(), key=lambda item: -item[1])],
    }
