import logging
import re
from datetime import datetime, timedelta

import httpx
from sqlalchemy import select

from app.core import cache
from app.core.config import TIME_ZONE
from app.models import ExchangeRate

logger = logging.getLogger(__name__)

NBT_URL = "https://nbt.tj/ru/kurs/export_xml.php"
CBR_URL = "https://www.cbr.ru/scripts/XML_daily.asp"
HISTORY_DAYS = 30
FAILED_PAUSE = 30 * 60


class RatesUnavailable(Exception):
    pass


def today():
    from zoneinfo import ZoneInfo

    return datetime.now(ZoneInfo(TIME_ZONE)).date()


def number(text):
    return float((text or "").replace(",", ".").strip())


VALUTE = re.compile(r"<Valute\b.*?</Valute>", re.S)
DATE = re.compile(r'<ValCurs[^>]*\bDate="([^"]+)"')


def tag(block, name):
    found = re.search(rf"<{name}>([^<]*)</{name}>", block)
    return found.group(1) if found else ""


def valute(text, code):
    for block in VALUTE.findall(text):
        if tag(block, "CharCode").strip() == code:
            try:
                return number(tag(block, "Value")), number(tag(block, "Nominal") or "1")
            except ValueError:
                break
    raise RatesUnavailable(f"{code} is missing")


def shown_day(text, pattern):
    found = DATE.search(text)
    try:
        return datetime.strptime(found.group(1), pattern).date() if found else None
    except ValueError:
        return None


async def get_text(client, url, params=None):
    try:
        response = await client.get(url, params=params, headers={"User-Agent": "Mozilla/5.0 Muhojir"})
    except httpx.HTTPError as error:
        raise RatesUnavailable(repr(error)) from error
    if response.status_code != 200:
        raise RatesUnavailable(f"HTTP {response.status_code}")
    return response.content.decode("latin-1")


async def fetch_nbt(client, day):
    text = await get_text(client, NBT_URL, {"date": day.isoformat(), "export": "xmlout"})
    value, nominal = valute(text, "RUB")
    return shown_day(text, "%Y-%m-%d") or day, value / nominal


async def fetch_cbr(client, day):
    text = await get_text(client, CBR_URL)
    value, nominal = valute(text, "TJS")
    return shown_day(text, "%d.%m.%Y") or day, nominal / value


FETCHERS = {"nbt": fetch_nbt, "cbr": fetch_cbr}


async def save_rate(db, source, day, value):
    rate = await db.scalar(select(ExchangeRate).where(ExchangeRate.source == source, ExchangeRate.day == day))
    if rate is None:
        rate = ExchangeRate(source=source, day=day, value=value)
        db.add(rate)
    else:
        rate.value = value
    await db.commit()
    return rate


async def update_rates(db, day=None):
    day = day or today()
    saved = {}
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        for source, fetch in FETCHERS.items():
            try:
                shown, value = await fetch(client, day)
            except RatesUnavailable as error:
                logger.warning("Rates %s: %s", source, error)
                continue
            if not 0.01 < value < 1:
                logger.warning("Rates %s: odd value %s", source, value)
                continue
            await save_rate(db, source, shown, round(value, 6))
            saved[source] = round(value, 6)
    return saved


async def ensure_fresh(db):
    day = today()
    have = set((await db.scalars(select(ExchangeRate.source).where(ExchangeRate.day >= day))).all())
    if have >= set(FETCHERS) or await cache.get(f"rates:tried:{day}"):
        return
    await cache.put(f"rates:tried:{day}", True, FAILED_PAUSE)
    await update_rates(db, day)


async def history(db, days=HISTORY_DAYS):
    since = today() - timedelta(days=days)
    rows = await db.scalars(select(ExchangeRate).where(ExchangeRate.day > since).order_by(ExchangeRate.day))
    by_day = {}
    for rate in rows:
        by_day.setdefault(rate.day.isoformat(), {})[rate.source] = rate.value
    return [{"day": day, **values} for day, values in by_day.items()]


async def latest(db):
    found = {}
    for source in FETCHERS:
        rate = await db.scalar(select(ExchangeRate).where(ExchangeRate.source == source)
                               .order_by(ExchangeRate.day.desc()).limit(1))
        if rate:
            found[source] = {"value": rate.value, "day": rate.day, "fetched_at": rate.fetched_at}
    return found
