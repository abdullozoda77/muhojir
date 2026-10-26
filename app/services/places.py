import asyncio
import logging
import re

import httpx
from sqlalchemy import select

from app.core.config import settings
from app.models import Place

logger = logging.getLogger(__name__)

REGIONS = {
    "Москва": "RU-MOW", "Московская область": "RU-MOS", "Санкт-Петербург": "RU-SPE", "Ленинградская область": "RU-LEN",
    "Свердловская область": "RU-SVE", "Новосибирская область": "RU-NVS", "Республика Татарстан": "RU-TA",
    "Краснодарский край": "RU-KDA", "Самарская область": "RU-SAM", "Нижегородская область": "RU-NIZ",
    "Челябинская область": "RU-CHE", "Тюменская область": "RU-TYU", "Ханты-Мансийский автономный округ — Югра": "RU-KHM",
    "Ямало-Ненецкий автономный округ": "RU-YAN", "Ростовская область": "RU-ROS", "Красноярский край": "RU-KYA",
    "Иркутская область": "RU-IRK", "Калужская область": "RU-KLU", "Тульская область": "RU-TUL",
    "Воронежская область": "RU-VOR", "Пермский край": "RU-PER", "Республика Башкортостан": "RU-BA",
    "Омская область": "RU-OMS", "Волгоградская область": "RU-VGG", "Саратовская область": "RU-SAR",
    "Ярославская область": "RU-YAR", "Владимирская область": "RU-VLA", "Калининградская область": "RU-KGD",
    "Белгородская область": "RU-BEL", "Томская область": "RU-TOM",
}
CITY_REGIONS = {"Москва", "Санкт-Петербург"}

SELECTORS = {
    "migration": [
        'nwr["office"="government"]["name"~"миграц|ММЦ",i](area.a);',
        'nwr["name"~"многофункциональный миграционный|миграционный центр",i](area.a);',
        'nwr["office"="government"]["name"~"по вопросам миграции|ОВМ|УВМ|паспортно-визов",i](area.a);',
    ],
    "medical": [
        'nwr["amenity"~"^(clinic|doctors|hospital)$"]["name"~"мигра|освидетельств|медосмотр|иностран|патент",i](area.a);',
        'nwr["healthcare"]["name"~"мигра|освидетельств|медосмотр|иностран",i](area.a);',
    ],
    "notary": ['nwr["office"="notary"](area.a);'],
    "translation": [
        'nwr["name"~"бюро перевод|переводческ|нотариальн.{0,3} перевод",i](area.a);',
        'nwr["office"="translator"](area.a);',
    ],
    "embassy": [
        'nwr["office"="diplomatic"]["country"="TJ"](area.a);',
        'nwr["amenity"="embassy"]["country"="TJ"](area.a);',
        'nwr["office"~"^(diplomatic|government)$"]["name"~"Таджикистан",i](area.a);',
    ],
    "mosque": ['nwr["amenity"="place_of_worship"]["religion"="muslim"](area.a);'],
    "food": [
        'nwr["amenity"~"^(restaurant|cafe|fast_food)$"]["cuisine"~"uzbek|tajik|central_asian",i](area.a);',
        'nwr["amenity"~"^(restaurant|cafe|fast_food)$"]["name"~"чайхан|плов|таджик|самарканд|душанбе|бухар|навруз|худжанд|памир|лагман|тандыр|узбек",i](area.a);',
    ],
    "halal": [
        'nwr["shop"]["name"~"халял|халал|halal",i](area.a);',
        'nwr["shop"]["diet:halal"~"yes|only"](area.a);',
    ],
    "money": [
        'nwr["amenity"~"^(money_transfer|bureau_de_change)$"](area.a);',
        'nwr["brand"~"юнистрим|золотая корона|western union|колибри",i]["amenity"!="atm"](area.a);',
    ],
    "hostel": ['nwr["tourism"="hostel"](area.a);'],
    "market": ['nwr["amenity"="marketplace"]["name"](area.a);'],
    "photo": [
        'nwr["shop"="photo"](area.a);',
        'nwr["shop"]["name"~"фото на документы|фото на паспорт",i](area.a);',
    ],
}


def query(region, selector):
    return f'[out:json][timeout:120];area["ISO3166-2"="{REGIONS[region]}"]["admin_level"="4"]->.a;({selector});out center tags;'


RETRY_WAITS = (15, 60)


async def fetch_one(client, region, selector):
    error = None
    urls = [u.strip() for u in settings.overpass_urls.split(",") if u.strip()]
    for wait in (0, *RETRY_WAITS):
        await asyncio.sleep(wait)
        for url in urls:
            try:
                response = await client.post(url, data={"data": query(region, selector)})
                if response.status_code == 200 and response.headers.get("content-type", "").startswith("application/json"):
                    return response.json().get("elements", [])
                error = RuntimeError(f"{url}: HTTP {response.status_code}")
            except (httpx.HTTPError, ValueError) as e:
                error = e
    raise error or RuntimeError("no Overpass server")


async def fetch(client, region, category, pause=0.0, log=print):
    found, failed = {}, 0
    for selector in SELECTORS[category]:
        try:
            for element in await fetch_one(client, region, selector):
                found[(element["type"], element["id"])] = element
        except Exception as error:
            failed += 1
            log(f"  {region} / {category} / {selector[:50]}: {error!r}")
        await asyncio.sleep(pause)
    if failed == len(SELECTORS[category]):
        raise RuntimeError("every query failed")
    return list(found.values())


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
    by_code = {code: name for name, code in REGIONS.items()}
    regions = [by_code.get(r, r) for r in regions or REGIONS]
    unknown = [r for r in regions if r not in REGIONS]
    if unknown:
        raise ValueError(f"Unknown regions: {', '.join(unknown)}. Use a name or a code: {', '.join(REGIONS.values())}")
    async with httpx.AsyncClient(timeout=150, headers=headers) as client:
        for region in regions:
            for category in categories or SELECTORS:
                try:
                    elements = await fetch(client, region, category, pause, log)
                except Exception as error:
                    counts["failed"] += 1
                    log(f"  {region} / {category}: {error}")
                    continue
                for element in elements:
                    counts[await save(db, element, region, category)] += 1
            log(f"{region}: done")
    return counts
