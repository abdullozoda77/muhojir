import asyncio
import html
import logging
import re
import urllib.parse
from datetime import timedelta

import httpx
from sqlalchemy import select, update

from app.db.types import utcnow
from app.models import Employer, Job

logger = logging.getLogger(__name__)

API = "https://opendata.trudvsem.ru/api/v1/vacancies/region/{region}?{query}"

REGIONS = {
    "7700000000000": "Москва",
    "5000000000000": "Московская область",
    "7800000000000": "Санкт-Петербург",
    "6600000000000": "Свердловская область",
    "5400000000000": "Новосибирская область",
    "2300000000000": "Краснодарский край",
    "1600000000000": "Республика Татарстан",
}
DEFAULT_REGIONS = ["7700000000000", "5000000000000", "7800000000000"]

SEARCHES = {
    "construction": ["разнорабочий", "строитель", "сварщик", "монтажник", "отделочник"],
    "warehouse": ["грузчик", "кладовщик", "комплектовщик"],
    "delivery": ["курьер"],
    "taxi": ["водитель"],
    "food": ["повар", "кухонный работник"],
    "cleaning": ["уборщик", "дворник"],
    "manufacturing": ["оператор производственной линии", "швея"],
    "trade": ["продавец"],
}

KEEP_DAYS = 3


async def fetch(client, region, text, limit):
    query = urllib.parse.urlencode({"text": text, "offset": 0, "limit": limit})
    response = await client.get(API.format(region=region, query=query))
    response.raise_for_status()
    data = response.json()
    return [item["vacancy"] for item in (data.get("results") or {}).get("vacancies", [])]


def clean(text):
    text = html.unescape(re.sub(r"<[^>]+>", " ", text or ""))
    return re.sub(r"[ \t]+", " ", text).strip()


def city_of(region_name):
    return re.sub(r"^Город\s+", "", region_name or "").strip()


def money(value):
    return value if isinstance(value, int) and value > 0 else None


def has(text, *words):
    return any(word in text for word in words)


async def save(db, vacancy, industry):
    company = vacancy.get("company") or {}
    title = clean(vacancy.get("job-name"))
    if not title or not vacancy.get("id") or company.get("hr-agency"):
        return "skipped"

    city = city_of((vacancy.get("region") or {}).get("name"))
    code = company.get("companycode") or company.get("ogrn") or company.get("inn")
    employer = await db.scalar(select(Employer).where(Employer.external_id == code)) if code else None
    if employer is None:
        employer = Employer(external_id=code)
        db.add(employer)
    employer.name = clean(company.get("name"))[:200] or "—"
    employer.inn = (company.get("inn") or "")[:12]
    employer.city = city[:100]
    employer.website = company.get("url") or ""
    employer.source = "trudvsem"
    await db.flush()

    duty = clean(vacancy.get("duty"))
    requirements = clean(vacancy.get("requirements"))
    description = duty + (f"\n\nТребования: {requirements}" if requirements and requirements != "-" else "")
    text = (description + " " + title).lower()
    addresses = (vacancy.get("addresses") or {}).get("address") or []
    salary_from, salary_to = money(vacancy.get("salary_min")), money(vacancy.get("salary_max"))
    if salary_from and salary_to and salary_to < salary_from:
        salary_to = None

    fields = {
        "employer_id": employer.id,
        "title": title[:200],
        "description": description[:6000] or title,
        "city": city[:100],
        "address": (addresses[0].get("location") or "")[:255] if addresses else "",
        "salary_from": salary_from,
        "salary_to": salary_to,
        "salary_period": "month",
        "schedule": clean(vacancy.get("schedule"))[:100],
        "housing_provided": has(text, "общежит", "проживани", "жильё", "жилье"),
        "meals_provided": has(text, "питани"),
        "helps_with_documents": bool((vacancy.get("workPlaceType") or {}).get("workPlaceForeign")) or has(text, "патент"),
        "external_url": (vacancy.get("vac_url") or "")[:500],
        "source": "trudvsem",
        "expires_at": utcnow() + timedelta(days=KEEP_DAYS),
    }
    job = await db.scalar(select(Job).where(Job.external_id == vacancy["id"]))
    if job is None:
        same = select(Job.id).where(Job.employer_id == employer.id, Job.title == fields["title"], Job.city == fields["city"],
                                    Job.salary_from.is_(salary_from) if salary_from is None else Job.salary_from == salary_from,
                                    Job.salary_to.is_(salary_to) if salary_to is None else Job.salary_to == salary_to)
        same_ids = (await db.scalars(same)).all()
        if same_ids:
            await db.execute(update(Job).where(Job.id.in_(same_ids)).values(expires_at=fields["expires_at"]))
            await db.commit()
            return "skipped"
        db.add(Job(external_id=vacancy["id"], industry=industry, is_active=True, **fields))
        await db.commit()
        return "created"
    for key, value in fields.items():
        setattr(job, key, value)
    await db.commit()
    return "updated"


async def import_jobs(db, regions=None, limit=20, pause=0.3, log=print):
    counts = {"created": 0, "updated": 0, "skipped": 0, "failed": 0}
    headers = {"User-Agent": "Muhojir job import"}
    async with httpx.AsyncClient(timeout=30, headers=headers) as client:
        for region in regions or DEFAULT_REGIONS:
            for industry, words in SEARCHES.items():
                for word in words:
                    await import_one(db, client, region, industry, word, limit, counts, log)
                    await asyncio.sleep(pause)
            log(f"{REGIONS.get(region, region)}: done")
    return counts


async def import_one(db, client, region, industry, word, limit, counts, log):
    try:
        vacancies = await fetch(client, region, word, limit)
    except (httpx.HTTPError, ValueError) as error:
        counts["failed"] += 1
        log(f"  {REGIONS.get(region, region)} / {word}: {error}")
        return
    for vacancy in vacancies:
        counts[await save(db, vacancy, industry)] += 1
