"""Ticket prices between Tajikistan and Russia from Travelpayouts (Aviasales Data API v3, prices_for_dates).
They are the cheapest prices other people found in the last days, cached by Aviasales; the button opens the
search on aviasales.ru, where the ticket is bought. Our own cache keeps an answer for 30 minutes."""
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
    """The search page on aviasales.ru: /search/DYU0112MOW1 = from DYU on 1 December to MOW, 1 passenger."""
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


async def prices(origin, destination, month=None, direct=False):
    """The cheapest one-way tickets of the month (or the nearest ones), and the cheapest price of every day."""
    key = f"flights:{origin}:{destination}:{month or 'any'}:{int(direct)}"
    cached = await cache.get(key)
    if cached is not None:
        return cached
    params = {"origin": origin, "destination": destination, "currency": "rub", "one_way": "true",
              "direct": "true" if direct else "false", "sorting": "price", "limit": 200, "unique": "false"}
    if month:
        params["departure_at"] = month
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
    tickets = [_ticket(item) for item in response.json().get("data") or [] if item.get("price")]
    calendar = {}
    for ticket in tickets:
        day = ticket["departure_at"][:10]
        if day and (day not in calendar or ticket["price"] < calendar[day]):
            calendar[day] = ticket["price"]
    result = {"results": tickets[:30], "calendar": dict(sorted(calendar.items()))}
    await cache.put(key, result, CACHE_SECONDS)
    return result


async def check_watches(db, today=None):
    """Every day: tells users whose watched route got cheaper than their price. Returns how many were told."""
    if not enabled():
        return 0
    today = today or date.today()
    this_month = f"{today:%Y-%m}"
    told = 0
    watches = (await db.scalars(select(FlightWatch).join(User, User.id == FlightWatch.user_id)
                                .where(FlightWatch.is_active.is_(True), User.is_active.is_(True)))).unique().all()
    for watch in watches:
        if watch.month < this_month:
            watch.is_active = False  # the month is over
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
            continue  # already told about this price (or a cheaper one)
        watch.last_price = cheapest["price"]
        await db.commit()
        user = await db.get(User, watch.user_id)
        when = cheapest["departure_at"][:10]
        await notify(db, user, "Чиптаи арзон",
                     f"{watch.origin} → {watch.destination}: {cheapest['price']:,} ₽ ({when}, {cheapest['airline_name']}). "
                     .replace(",", " ") + "Нархҳо зуд иваз мешаванд — дар сайти Aviasales санҷед.", kind="system")
        told += 1
    return told
