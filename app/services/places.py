import asyncio
import logging
import re

import httpx
from sqlalchemy import select

from app.core.config import settings
from app.models import Place

logger = logging.getLogger(__name__)

REGIONS = [
    "Москва", "Московская область", "Санкт-Петербург", "Свердловская область", "Новосибирская область",
    "Республика Татарстан", "Краснодарский край", "Самарская область",
]
CITY_REGIONS = {"Москва", "Санкт-Петербург"}

SELECTORS = {
    "migration": [
        'nwr["office"="government"]["name"~"миграц|ММЦ",i](area.a);',
        'nwr["name"~"многофункциональный миграционный|миграционный центр",i](area.a);',
    ],
    "medical": ['nwr["amenity"~"^(clinic|doctors|hospital)$"]["name"~"мигра|освидетельств|медосмотр",i](area.a);'],
    "notary": ['nwr["office"="notary"](area.a);'],
    "translation": ['nwr["name"~"бюро перевод|переводческ|нотариальн.{0,3} перевод",i](area.a);'],
    "embassy": [
        'nwr["office"="diplomatic"]["country"="TJ"](area.a);',
        'nwr["amenity"="embassy"]["country"="TJ"](area.a);',
        'nwr["name"~"Таджикистан",i]["office"~"diplomatic|government"](area.a);',
    ],
    "mosque": ['nwr["amenity"="place_of_worship"]["religion"="muslim"](area.a);'],
    "food": [
        'nwr["amenity"~"^(restaurant|cafe|fast_food)$"]["cuisine"~"uzbek|tajik|central_asian",i](area.a);',
        'nwr["amenity"~"^(restaurant|cafe|fast_food)$"]["name"~"чайхан|плов|таджик|самарканд|душанбе|бухар|навруз",i](area.a);',
    ],
    "halal": [
        'nwr["shop"]["name"~"халял|халал|halal",i](area.a);',
        'nwr["shop"]["diet:halal"~"yes|only"](area.a);',
    ],
    "money": ['nwr["amenity"~"^(money_transfer|bureau_de_change)$"](area.a);'],
}


def query(region, category):
    body = "".join(SELECTORS[category])
    return f'[out:json][timeout:90];area["name"="{region}"]["admin_level"="4"]->.a;({body});out center tags;'


RETRY_WAITS = (10, 30, 60)


async def fetch(client, region, category):
    error = None
    urls = [u.strip() for u in settings.overpass_urls.split(",") if u.strip()]
    for wait in (0, *RETRY_WAITS):
        await asyncio.sleep(wait)
        for url in urls:
            try:
                response = await client.post(url, data={"data": query(region, category)})
                if response.status_code == 200 and response.headers.get("content-type", "").startswith("application/json"):
                    return response.json().get("elements", [])
                error = RuntimeError(f"{url}: HTTP {response.status_code}")
            except (httpx.HTTPError, ValueError) as e:
                error = e
    raise error or RuntimeError("no Overpass server")


def _clean(value, limit):
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]


def place_fields(element, region, category):
    tags = element.get("tags") or {}
    name = _clean(tags.get("name") or tags.get("official_name"), 200)
    lat = element.get("lat") or (element.get("center") or {}).get("lat")
    lon = element.get("lon") or (element.get("center") or {}).get("lon")
    if not name or lat is None:
        return None
    street = " ".join(filter(None, [tags.get("addr:street"), tags.get("addr:housenumber")]))
    city = tags.get("addr:city") or (region if region in CITY_REGIONS else "")
    address = tags.get("addr:full") or ", ".join(filter(None, [city if region not in CITY_REGIONS else "", street]))
    return {
        "category": category, "name": name, "region": region, "city": _clean(city, 100),
        "address": _clean(address, 255), "lat": float(lat), "lon": float(lon),
        "phone": _clean(tags.get("phone") or tags.get("contact:phone"), 60),
        "website": _clean(tags.get("website") or tags.get("contact:website"), 300),
        "opening_hours": _clean(tags.get("opening_hours"), 200),
        "description": _clean(tags.get("description"), 1000),
    }


async def save(db, element, region, category):
    fields = place_fields(element, region, category)
    if fields is None:
        return "skipped"
    external_id = f"osm:{element['type']}/{element['id']}"
    place = await db.scalar(select(Place).where(Place.external_id == external_id))
    if place is None:
        db.add(Place(external_id=external_id, source="osm", is_approved=True, **fields))
        await db.commit()
        return "created"
    if place.category != category:
        fields.pop("category")
    for key, value in fields.items():
        setattr(place, key, value)
    await db.commit()
    return "updated"


async def import_places(db, regions=None, categories=None, pause=5.0, log=print):
    counts = {"created": 0, "updated": 0, "skipped": 0, "failed": 0}
    headers = {"User-Agent": "Muhojir places import (https://king.tj)"}
    async with httpx.AsyncClient(timeout=120, headers=headers) as client:
        for region in regions or REGIONS:
            for category in categories or SELECTORS:
                try:
                    elements = await fetch(client, region, category)
                except Exception as error:
                    counts["failed"] += 1
                    log(f"  {region} / {category}: {error}")
                    continue
                for element in elements:
                    counts[await save(db, element, region, category)] += 1
                await asyncio.sleep(pause)
            log(f"{region}: done")
    return counts
