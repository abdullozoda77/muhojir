"""/api/flights/: air tickets between Tajikistan and Russia (both ways): airports, prices for a month with the
cheapest price of every day, and price alerts ("tell me when it is cheaper than ...")."""
import re
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, Response
from pydantic import Field, field_validator
from sqlalchemy import func, select

from app.core.deps import DB, CurrentUser
from app.core.errors import ApiError, FieldError
from app.models import Airport, FlightWatch
from app.schemas.common import Form
from app.services import flights

router = APIRouter(prefix="/api/flights", tags=["flights"])

MAX_WATCHES = 10
CODE = re.compile(r"^[A-Z]{3}$")


def airport_json(a):
    return {"id": a.id, "code": a.code, "city_code": a.city_code, "city": a.city, "city_tg": a.city_tg or a.city,
            "name": a.name, "country": a.country}


@router.get("/airports/")
async def airports(db: DB, country: str | None = None):
    """All airports (not paged: there are about 30). ?country=TJ or ?country=RU."""
    query = select(Airport).where(Airport.is_active.is_(True)).order_by(Airport.country.desc(), Airport.order, Airport.city)
    if country:
        query = query.where(Airport.country == country.upper())
    return [airport_json(a) for a in await db.scalars(query)]


async def country_of(db, code, field):
    """A code is an airport (SVO) or a city (MOW). Returns TJ or RU; unknown codes are refused."""
    if not CODE.match(code or ""):
        raise FieldError(field, "Use a 3-letter IATA code, e.g. DYU or MOW.")
    country = await db.scalar(select(Airport.country).where((Airport.code == code) | (Airport.city_code == code)).limit(1))
    if country is None:
        raise FieldError(field, f"Unknown airport or city: {code}.")
    return country


async def check_route(db, origin, destination):
    if {await country_of(db, origin, "origin"), await country_of(db, destination, "destination")} != {"TJ", "RU"}:
        raise ApiError("Tickets are only between Tajikistan and Russia (either way).")


def check_month(month):
    if month is None:
        return None
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month):
        raise FieldError("month", "Use the month as YYYY-MM, e.g. 2026-11.")
    if month < f"{date.today():%Y-%m}":
        raise FieldError("month", "This month is already over.")
    return month


@router.get("/prices/")
async def prices(
    db: DB,
    origin: Annotated[str, Query(min_length=3, max_length=3)],
    destination: Annotated[str, Query(min_length=3, max_length=3)],
    month: str | None = None,
    direct: bool = False,
):
    """The one-way tickets of the month (cheapest first) and a calendar {day: cheapest price}.
    enabled=false means no TRAVELPAYOUTS_TOKEN: then only search_url (aviasales.ru) is given."""
    origin, destination = origin.upper(), destination.upper()
    await check_route(db, origin, destination)
    month = check_month(month)
    first_day = date.fromisoformat(f"{month}-01") if month else None
    day = max(first_day, date.today()) if first_day else None
    answer = {"enabled": flights.enabled(), "currency": "RUB", "search_url": flights.search_url(origin, destination, day),
              "results": [], "calendar": {}}
    if not flights.enabled():
        return answer
    try:
        answer.update(await flights.prices(origin, destination, month, direct))
    except flights.FlightsUnavailable:
        raise ApiError("Ticket prices are not available right now. Try again later.", 503, code="unavailable")
    return answer


# --- Price alerts ----------------------------------------------------------------------------------------------

class WatchIn(Form):
    origin: str = Field(min_length=3, max_length=3)
    destination: str = Field(min_length=3, max_length=3)
    month: str
    max_price: int = Field(ge=1000, le=500000)
    is_active: bool = True

    @field_validator("origin", "destination")
    @classmethod
    def upper(cls, value):
        return value.upper()


def watch_json(w):
    return {"id": w.id, "origin": w.origin, "destination": w.destination, "month": w.month, "max_price": w.max_price,
            "is_active": w.is_active, "last_price": w.last_price, "created_at": w.created_at}


@router.get("/watches/")
async def list_watches(db: DB, user: CurrentUser):
    watches = await db.scalars(select(FlightWatch).where(FlightWatch.user_id == user.id).order_by(FlightWatch.created_at.desc()))
    return [watch_json(w) for w in watches.unique()]


@router.post("/watches/", status_code=201)
async def create_watch(data: WatchIn, db: DB, user: CurrentUser):
    await check_route(db, data.origin, data.destination)
    check_month(data.month)
    if await db.scalar(select(func.count()).where(FlightWatch.user_id == user.id)) >= MAX_WATCHES:
        raise ApiError({"detail": [f"You can have at most {MAX_WATCHES} price alerts."]})
    watch = FlightWatch(user_id=user.id, **data.model_dump())
    db.add(watch)
    await db.commit()
    return watch_json(watch)


async def my_watch(db, user, watch_id):
    watch = await db.scalar(select(FlightWatch).where(FlightWatch.id == watch_id, FlightWatch.user_id == user.id))
    if watch is None:
        raise ApiError("No FlightWatch matches the given query.", 404)
    return watch


@router.delete("/watches/{watch_id}/", status_code=204)
async def delete_watch(watch_id: int, db: DB, user: CurrentUser):
    await db.delete(await my_watch(db, user, watch_id))
    await db.commit()
    return Response(status_code=204)
