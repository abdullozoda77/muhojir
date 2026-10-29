import asyncio
import logging
from datetime import date

import httpx
from sqlalchemy import select

from app.core import cache
from app.core.config import settings
from app.models import AIRLINES, FlightWatch, User
from app.services.notify import notify

logger = logging.getLogger(__name__)

API = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates"
CACHE_SECONDS = 30 * 60


class FlightsUnavailable(Exception):
    pass


def enabled():
    return bool(settings.travelpayouts_token)


def search_url(origin, destination, day=None):
    day = day or date.today()
    return f"https://www.aviasales.ru/search/{origin}{day:%d%m}{destination}1"


def _ticket(item):
    departure = item.get("departure_at") or ""
    link = item.get("link") or ""
    airline = (item.get("airline") or "").upper()
    return {
        "origin": item.get("origin"), "destination": item.get("destination"),
        "origin_airport": item.get("origin_airport") or item.get("origin"),
        "destination_airport": item.get("destination_airport") or item.get("destination"),
        "departure_at": departure, "price": int(item.get("price") or 0),
        "airline": airline, "airline_name": AIRLINES.get(airline, airline),
        "flight_number": str(item.get("flight_number") or ""),
        "transfers": int(item.get("transfers") or 0), "duration": item.get("duration") or item.get("duration_to"),
        "link": f"https://www.aviasales.ru{link}" if link.startswith("/") else (link or None),
    }


async def _fetch(origin, destination, departure_at=None, direct=False, limit=200):
    params = {"origin": origin, "destination": destination, "currency": "rub", "one_way": "true",
              "direct": "true" if direct else "false", "sorting": "price", "limit": limit, "unique": "false"}
    if departure_at:
        params["departure_at"] = departure_at
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(API, params=params, headers={"X-Access-Token": settings.travelpayouts_token,
                                                                      "Accept": "application/json"})
    except httpx.HTTPError as error:
        logger.warning("Travelpayouts: %r", error)
        raise FlightsUnavailable from error
    if response.status_code in (401, 403):
        logger.error("Travelpayouts: the TRAVELPAYOUTS_TOKEN was rejected")
        raise FlightsUnavailable
    if response.status_code != 200:
        logger.warning("Travelpayouts: HTTP %s %s", response.status_code, response.text[:200])
        raise FlightsUnavailable
    return [_ticket(item) for item in response.json().get("data") or [] if item.get("price")]


async def prices(origin, destination, month=None, direct=False):
    key = f"flights:{origin}:{destination}:{month or 'any'}:{int(direct)}"
    cached = await cache.get(key)
    if cached is not None:
        return cached
    tickets = await _fetch(origin, destination, month, direct)
    calendar = {}
    for ticket in tickets:
        day = ticket["departure_at"][:10]
        if day and (day not in calendar or ticket["price"] < calendar[day]):
            calendar[day] = ticket["price"]
    result = {"results": tickets, "calendar": dict(sorted(calendar.items()))}
    await cache.put(key, result, CACHE_SECONDS)
    return result


def _same_flight(ticket):
    return (ticket["airline"], ticket["flight_number"], ticket["departure_at"][:16], ticket["transfers"])


async def day_prices(origins, destinations, day, direct=False):
    key = f"flights:day:{','.join(origins)}:{','.join(destinations)}:{day}:{int(direct)}"
    cached = await cache.get(key)
    if cached is not None:
        return cached
    jobs = [(o, d, only_direct) for o in origins for d in destinations for only_direct in ((True,) if direct else (False, True))]
    answers = await asyncio.gather(*(_fetch(o, d, day, only_direct, limit=1000) for o, d, only_direct in jobs),
                                   return_exceptions=True)
    found = {}
    for tickets in answers:
        if isinstance(tickets, FlightsUnavailable):
            continue
        if isinstance(tickets, BaseException):
            raise tickets
        for ticket in tickets:
            if not ticket["departure_at"].startswith(day):
                continue
            same = _same_flight(ticket)
            if same not in found or ticket["price"] < found[same]["price"]:
                found[same] = ticket
    if all(isinstance(a, BaseException) for a in answers):
        raise FlightsUnavailable
    result = sorted(found.values(), key=lambda t: (t["price"], t["departure_at"]))
    await cache.put(key, result, CACHE_SECONDS)
    return result


async def check_watches(db, today=None):
    if not enabled():
        return 0
    today = today or date.today()
    this_month = f"{today:%Y-%m}"
    told = 0
    watches = (await db.scalars(select(FlightWatch).join(User, User.id == FlightWatch.user_id)
                                .where(FlightWatch.is_active.is_(True), User.is_active.is_(True)))).unique().all()
    for watch in watches:
        if watch.month < this_month:
            watch.is_active = False
            await db.commit()
            continue
        try:
            found = await prices(watch.origin, watch.destination, watch.month)
        except FlightsUnavailable:
            continue
        cheapest = min((t for t in found["results"]), key=lambda t: t["price"], default=None)
        if cheapest is None or cheapest["price"] > watch.max_price:
            continue
        if watch.last_price is not None and cheapest["price"] >= watch.last_price:
            continue
        watch.last_price = cheapest["price"]
        await db.commit()
        user = await db.get(User, watch.user_id)
        when = cheapest["departure_at"][:10]
        await notify(db, user, "Чиптаи арзон",
                     f"{watch.origin} → {watch.destination}: {cheapest['price']:,} ₽ ({when}, {cheapest['airline_name']}). "
                     .replace(",", " ") + "Нархҳо зуд иваз мешаванд — дар сайти Aviasales санҷед.", kind="system")
        told += 1
    return told
