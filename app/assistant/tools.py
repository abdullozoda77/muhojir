import json
from datetime import date
from urllib.parse import urlencode

from sqlalchemy import func, or_, select

from app.models import PLACE_CATEGORIES, Airport, Certificate, DocumentType, GuideStep, LawNews, Place, Region, UserDocument
from app.models.housing import HOUSING_FOR, HOUSING_KINDS, Housing
from app.models.market import SHOP_CATEGORIES, Product, Shop
from app.services import course, flights, rates, stats
from app.models.jobs import INDUSTRIES, Employer, Job
from app.routers.jobs import open_jobs

PAGES = {
    "home": "/",
    "documents": "/documents",
    "payments": "/payments",
    "jobs": "/jobs",
    "saved_jobs": "/saved-jobs",
    "calculator": "/calculator",
    "guides": "/guides",
    "news": "/guides#news",
    "checks": "/checks",
    "exam": "/exam",
    "help": "/help",
    "notifications": "/notifications",
    "profile": "/profile",
    "login": "/login",
    "tickets": "/tickets",
    "places": "/places",
    "housing": "/housing",
    "shops": "/shops",
    "my_shops": "/shops/my",
    "blacklist": "/blacklist",
    "rate": "/rate",
    "feedback": "/feedback",
    "course": "/course",
    "course_stats": "/course/stats",
    "lesson": "/course",
    "course_exam": "/course",
    "my_certificate": "/course",
    "certificate_sample": "/certificates/sample",
    "my_housing": "/housing?tab=mine",
    "job": "/jobs",
    "housing_ad": "/housing",
    "shop": "/shops",
    "employer": "/blacklist",
    "news_item": "/guides#news",
}
ITEM_PAGES = {
    "job": "/jobs/{}",
    "housing_ad": "/housing/{}",
    "shop": "/shops/{}",
    "employer": "/employers/{}",
    "news_item": "/news/{}",
}
DOCUMENT_SLUGS = ["patent", "registration", "migration-card", "insurance-dms", "medical"]
INDUSTRY_KEYS = list(INDUSTRIES)
MAX_JOBS = 5

TOOLS = [
    {
        "name": "navigate",
        "description": (
            "Opens a page of the site for the visitor. For jobs you may add filters (search words, city, industry, "
            "housing). For guides: the guide of one document. For places: a kind and a region. For tickets: from and "
            "to. For housing: words (metro, district), city, kind, max price, registration. For shops: words, city, "
            "category. For lesson: level and lesson number (use my_course to know the next lesson); course_exam: level. "
            "To open one found item use job, housing_ad, shop, employer or news_item with item_id from a search tool. "
            "my_certificate opens the visitor's course certificate, my_housing their own housing ads."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "page": {"type": "string", "enum": list(PAGES), "description": "Which page to open."},
                "job_search": {"type": "string", "description": "jobs only: profession or key words, in Russian, e.g. курьер."},
                "job_city": {"type": "string", "description": "jobs only: city in Russian, e.g. Москва."},
                "job_industry": {"type": "string", "enum": INDUSTRY_KEYS, "description": "jobs only: industry."},
                "job_housing": {"type": "boolean", "description": "jobs only: only jobs that give housing."},
                "guide_document": {"type": "string", "enum": DOCUMENT_SLUGS, "description": "guides only: which document."},
                "places_category": {"type": "string", "enum": list(PLACE_CATEGORIES), "description": "places only: kind of place."},
                "places_region": {"type": "string", "description": "places only: region in Russian, e.g. Москва."},
                "tickets_from": {"type": "string", "description": "tickets only: IATA code of the airport or city, e.g. DYU, MOW."},
                "tickets_to": {"type": "string", "description": "tickets only: IATA code, e.g. LBD, LED."},
                "housing_search": {"type": "string", "description": "housing only: metro, district or words, e.g. Люблино."},
                "housing_city": {"type": "string", "description": "housing only: city in Russian, e.g. Москва."},
                "housing_kind": {"type": "string", "enum": list(HOUSING_KINDS), "description": "housing only: bed, room, flat or hostel."},
                "housing_max_price": {"type": "integer", "description": "housing only: highest price in rubles."},
                "housing_registration": {"type": "boolean", "description": "housing only: only places that give registration."},
                "shops_search": {"type": "string", "description": "shops only: shop or product name."},
                "shops_city": {"type": "string", "description": "shops only: city in Russian."},
                "shops_category": {"type": "string", "enum": list(SHOP_CATEGORIES), "description": "shops only: category."},
                "course_level": {"type": "integer", "description": "lesson only: level 1-7."},
                "course_lesson": {"type": "integer", "description": "lesson only: lesson 1-10 of the level."},
                "item_id": {"type": "integer", "description": "job, housing_ad, shop, employer, news_item: the id from a search tool."},
            },
            "required": ["page"],
            "additionalProperties": False,
        },
    },
    {
        "name": "patent_price",
        "description": "The monthly patent price for 2026 in a region (or city) of Russia, e.g. Москва, Санкт-Петербург, Свердловская.",
        "input_schema": {
            "type": "object",
            "properties": {"region": {"type": "string", "description": "Region or city name in Russian."}},
            "required": ["region"],
            "additionalProperties": False,
        },
    },
    {
        "name": "guide_steps",
        "description": "The official step-by-step guide for a document: steps, where to go, what to bring, costs and deadlines.",
        "input_schema": {
            "type": "object",
            "properties": {"document": {"type": "string", "enum": DOCUMENT_SLUGS}},
            "required": ["document"],
            "additionalProperties": False,
        },
    },
    {
        "name": "find_jobs",
        "description": f"Searches the real vacancies on the site. Returns up to {MAX_JOBS} with salary, city and address.",
        "input_schema": {
            "type": "object",
            "properties": {
                "search": {"type": "string", "description": "Profession or key words in Russian."},
                "city": {"type": "string", "description": "City in Russian."},
                "industry": {"type": "string", "enum": INDUSTRY_KEYS},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "find_places",
        "description": (
            "Searches the directory of useful places in Russia: migration centers, clinics for the migrants' "
            "medical exam, notaries, translation bureaus, the embassy/consulates of Tajikistan, mosques, Tajik and "
            "Uzbek cafes, halal shops, money transfers, hostels, markets, photo for documents. Returns up to 5 "
            "with address and rating."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "category": {"type": "string", "enum": list(PLACE_CATEGORIES)},
                "region": {"type": "string", "description": "Region in Russian, e.g. Москва, Московская область, Санкт-Петербург."},
                "search": {"type": "string", "description": "Words of the name or street."},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "airports",
        "description": "The airports of Tajikistan and Russia that the tickets page knows, with their IATA codes.",
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "flight_prices",
        "description": (
            "The cheapest one-way air tickets between Tajikistan and Russia (either way) for a month, from "
            "Aviasales. Use IATA codes (DYU Dushanbe, LBD Khujand, KQT Bokhtar, TJU Kulob; MOW Moscow, LED "
            "St Petersburg, SVX Yekaterinburg...). Prices change fast: always say they are approximate."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "origin": {"type": "string"}, "destination": {"type": "string"},
                "month": {"type": "string", "description": "YYYY-MM; empty = the nearest dates."},
            },
            "required": ["origin", "destination"],
            "additionalProperties": False,
        },
    },
    {
        "name": "my_documents",
        "description": "The visitor's own documents on the site with their end dates (only when they are logged in).",
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "find_housing",
        "description": (
            "Searches approved housing ads (beds, rooms, flats, hostels for migrants). Returns up to 5 cheapest-first or "
            "newest with price, period, city, metro, for whom, registration, utilities, deposit and contacts."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "search": {"type": "string", "description": "Metro, district or words, in Russian."},
                "city": {"type": "string", "description": "City in Russian."},
                "kind": {"type": "string", "enum": list(HOUSING_KINDS)},
                "for_whom": {"type": "string", "enum": list(HOUSING_FOR)},
                "max_price": {"type": "integer", "description": "Highest price in rubles."},
                "registration": {"type": "boolean", "description": "Only places that give registration."},
                "cheapest": {"type": "boolean", "description": "Sort by price instead of newest."},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "find_shops",
        "description": (
            "Searches approved Tajik shops in Russia (groceries, halal meat, bread, sweets, cafes, clothes, household) "
            "by shop or product name, city and category. Returns up to 5 with address, phone, delivery and matching products."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "search": {"type": "string", "description": "Shop or product name, e.g. курага, лепёшка."},
                "city": {"type": "string", "description": "City in Russian."},
                "category": {"type": "string", "enum": list(SHOP_CATEGORIES)},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "exchange_rate",
        "description": (
            "The official ruble to somoni rate today (National Bank of Tajikistan and Bank of Russia). Optionally converts "
            "an amount: rub_to_tjs or tjs_to_rub."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "amount": {"type": "number", "description": "Amount to convert."},
                "direction": {"type": "string", "enum": ["rub_to_tjs", "tjs_to_rub"]},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "check_employer",
        "description": "Checks if a company is on the site's blacklist of employers or has workers' reports.",
        "input_schema": {
            "type": "object",
            "properties": {"name": {"type": "string", "description": "Company name or INN."}},
            "required": ["name"],
            "additionalProperties": False,
        },
    },
    {
        "name": "my_course",
        "description": (
            "The visitor's Russian course progress: lessons done, average score, days in a row, levels passed, the next "
            "lesson (level, number, title) and the last lessons. Only when logged in."
        ),
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "my_activity",
        "description": "The visitor's activity on the site: days with Muhojir, totals per section, days in a row, recent actions.",
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "latest_news",
        "description": "The latest law news for migrants on the site (title, date, id), optionally filtered by words.",
        "input_schema": {
            "type": "object",
            "properties": {"search": {"type": "string", "description": "Words in Russian or Tajik, e.g. патент."}},
            "additionalProperties": False,
        },
    },
]


async def _navigate(db, args, user=None):
    page = args.get("page")
    if page not in PAGES:
        return {"error": f"page must be one of: {', '.join(PAGES)}"}
    path = PAGES[page]
    if page == "jobs":
        query = {
            "search": (args.get("job_search") or "").strip(),
            "city": (args.get("job_city") or "").strip(),
            "industry": args.get("job_industry") if args.get("job_industry") in INDUSTRY_KEYS else "",
            "housing_provided": "true" if args.get("job_housing") else "",
        }
        query = {k: v for k, v in query.items() if v}
        if query:
            path += "?" + urlencode(query)
    elif page == "places":
        query = {"category": args.get("places_category") if args.get("places_category") in PLACE_CATEGORIES else "",
                 "region": (args.get("places_region") or "").strip()}
        query = {k: v for k, v in query.items() if v}
        if query:
            path += "?" + urlencode(query)
    elif page == "tickets":
        query = {"from": (args.get("tickets_from") or "").strip().upper(), "to": (args.get("tickets_to") or "").strip().upper()}
        query = {k: v for k, v in query.items() if len(v) == 3}
        if query:
            path += "?" + urlencode(query)
    elif page == "housing":
        price = args.get("housing_max_price")
        query = {"search": (args.get("housing_search") or "").strip(), "city": (args.get("housing_city") or "").strip(),
                 "kind": args.get("housing_kind") if args.get("housing_kind") in HOUSING_KINDS else "",
                 "max_price": str(int(price)) if isinstance(price, (int, float)) and price > 0 else "",
                 "registration": "true" if args.get("housing_registration") else ""}
        query = {k: v for k, v in query.items() if v}
        if query:
            path += "?" + urlencode(query)
    elif page == "shops":
        query = {"search": (args.get("shops_search") or "").strip(), "city": (args.get("shops_city") or "").strip(),
                 "category": args.get("shops_category") if args.get("shops_category") in SHOP_CATEGORIES else ""}
        query = {k: v for k, v in query.items() if v}
        if query:
            path += "?" + urlencode(query)
    elif page == "lesson":
        level, number = args.get("course_level"), args.get("course_lesson")
        if isinstance(level, int) and isinstance(number, int) and course.lesson(level, number):
            path = f"/course/{level}/{number}"
    elif page == "course_exam":
        level = args.get("course_level")
        if isinstance(level, int) and course.level(level):
            path = f"/course/{level}/exam"
    elif page == "my_certificate":
        if user is None:
            return {"error": "the visitor is not logged in"}
        code = await db.scalar(select(Certificate.code).where(Certificate.user_id == user.id).limit(1))
        if not code:
            return {"error": "the visitor has no certificate yet; it is given after the level 7 exam"}
        path = f"/certificates/{code}"
    elif page in ITEM_PAGES:
        item_id = args.get("item_id")
        if not isinstance(item_id, int) or item_id <= 0:
            return {"error": f"{page} needs item_id from a search tool"}
        path = ITEM_PAGES[page].format(item_id)
    elif page == "guides" and args.get("guide_document"):
        type_id = await db.scalar(select(DocumentType.id).where(DocumentType.slug == args["guide_document"]))
        if type_id:
            path += f"?type={type_id}"
    return {"opened": path}


async def _patent_price(db, args):
    name = (args.get("region") or "").strip()
    if not name:
        return {"error": "give a region name"}
    regions = (await db.scalars(select(Region).where(Region.name.ilike(f"%{name}%")).limit(5))).all()
    if not regions:
        stems = [w[: max(3, len(w) - 3)] for w in name.replace("-", " ").split() if len(w) > 3]
        if stems:
            query = select(Region)
            for stem in stems:
                query = query.where(Region.name.ilike(f"%{stem}%"))
            regions = (await db.scalars(query.limit(5))).all()
    if not regions:
        return {"error": f"no region found for «{name}»"}
    return {"regions": [{"name": r.name, "monthly_rub": int(r.patent_monthly_price), "year": r.price_year} for r in regions]}


async def _guide_steps(db, args):
    doc = await db.scalar(select(DocumentType).where(DocumentType.slug == args.get("document")))
    if doc is None:
        return {"error": "unknown document"}
    steps = (await db.scalars(select(GuideStep).where(GuideStep.document_type_id == doc.id).order_by(GuideStep.order))).all()
    return {
        "document": doc.title,
        "description": doc.description,
        "steps": [
            {
                "step": s.order, "title": s.title, "what_to_do": s.body, "where": s.where,
                "bring": [line for line in s.required_papers.splitlines() if line.strip()],
                "cost": s.cost_note, "deadline": s.deadline_note,
            }
            for s in steps
        ],
    }


async def _find_jobs(db, args):
    query = open_jobs(select(Job))
    if args.get("search"):
        words = args["search"].strip()
        query = query.where(or_(Job.title.ilike(f"%{words}%"), Job.description.ilike(f"%{words}%")))
    if args.get("city"):
        query = query.where(Job.city.ilike(f"%{args['city'].strip()}%"))
    if args.get("industry") in INDUSTRY_KEYS:
        query = query.where(Job.industry == args["industry"])
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    jobs = (await db.scalars(query.order_by(Job.created_at.desc()).limit(MAX_JOBS))).unique().all()
    found = [
        {
            "id": j.id, "employer_id": j.employer_id, "title": j.title, "company": j.employer.name, "city": j.city, "address": j.address,
            "salary_from": j.salary_from, "salary_to": j.salary_to, "housing": j.housing_provided, "meals": j.meals_provided,
        }
        for j in jobs
    ]
    return {"total": total, "jobs": found}


async def _find_places(db, args):
    query = select(Place).where(Place.is_approved.is_(True))
    if args.get("category") in PLACE_CATEGORIES:
        query = query.where(Place.category == args["category"])
    if args.get("region"):
        region = args["region"].strip()
        query = query.where(or_(Place.region.ilike(f"%{region[:6]}%"), Place.city.ilike(f"%{region[:6]}%")))
    if args.get("search"):
        words = args["search"].strip()
        query = query.where(or_(Place.name.ilike(f"%{words}%"), Place.address.ilike(f"%{words}%")))
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    places = (await db.scalars(query.order_by(Place.address.desc(), Place.name).limit(MAX_JOBS))).all()
    return {"total": total, "places": [
        {"name": p.name, "category": p.category, "region": p.region, "address": p.address, "phone": p.phone,
         "opening_hours": p.opening_hours} for p in places]}


async def _airports(db):
    rows = (await db.scalars(select(Airport).where(Airport.is_active.is_(True)).order_by(Airport.country.desc(), Airport.order))).all()
    return {"airports": [{"code": a.code, "city_code": a.city_code, "city": a.city, "name": a.name, "country": a.country} for a in rows]}


async def _flight_prices(db, args):
    origin, destination = (args.get("origin") or "").upper(), (args.get("destination") or "").upper()
    countries = set((await db.scalars(select(Airport.country).where(
        or_(Airport.code.in_([origin, destination]), Airport.city_code.in_([origin, destination]))))).all())
    if countries != {"TJ", "RU"}:
        return {"error": "tickets are only between Tajikistan and Russia; use IATA codes like DYU and MOW"}
    if not flights.enabled():
        return {"note": "live prices are not set up on this site; the tickets page opens the search on aviasales.ru",
                "search_url": flights.search_url(origin, destination)}
    try:
        found = await flights.prices(origin, destination, args.get("month") or None)
    except flights.FlightsUnavailable:
        return {"error": "ticket prices are not available right now"}
    return {"currency": "RUB", "tickets": [
        {"date": t["departure_at"][:10], "price": t["price"], "airline": t["airline_name"], "transfers": t["transfers"]}
        for t in found["results"][:5]]}


async def _my_documents(db, user):
    if user is None:
        return {"error": "the visitor is not logged in; they can log in to add documents"}
    today = date.today()
    docs = (await db.scalars(select(UserDocument).where(UserDocument.user_id == user.id).order_by(UserDocument.expires_at))).unique().all()
    return {
        "documents": [
            {"type": d.document_type.title, "ends": d.expires_at.strftime("%d.%m.%Y"), "days_left": (d.expires_at - today).days}
            for d in docs
        ]
    }


async def _find_housing(db, args):
    query = select(Housing).where(Housing.status == "approved", Housing.is_active.is_(True))
    if words := (args.get("search") or "").strip():
        like = f"%{words}%"
        query = query.where(or_(Housing.title.ilike(like), Housing.metro.ilike(like), Housing.address.ilike(like),
                                Housing.description.ilike(like)))
    if city := (args.get("city") or "").strip():
        query = query.where(Housing.city.ilike(f"%{city}%"))
    if args.get("kind") in HOUSING_KINDS:
        query = query.where(Housing.kind == args["kind"])
    if args.get("for_whom") in HOUSING_FOR:
        query = query.where(Housing.for_whom.in_({args["for_whom"], "any"}))
    if isinstance(args.get("max_price"), (int, float)) and args["max_price"] > 0:
        query = query.where(Housing.price <= int(args["max_price"]))
    if args.get("registration"):
        query = query.where(Housing.registration.is_(True))
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    order = Housing.price if args.get("cheapest") else Housing.created_at.desc()
    rows = (await db.scalars(query.order_by(order).limit(MAX_JOBS))).unique().all()
    return {"total": total, "housing": [
        {"id": h.id, "title": h.title, "kind": h.kind, "price_rub": h.price, "per": h.period, "city": h.city, "metro": h.metro,
         "address": h.address, "for_whom": h.for_whom, "registration": h.registration,
         "utilities_included": h.utilities_included, "no_deposit": h.no_deposit, "phone": h.phone,
         "source": h.source} for h in rows]}


async def _find_shops(db, args):
    query = select(Shop).where(Shop.status == "approved")
    words = (args.get("search") or "").strip()
    if words:
        query = query.where(or_(Shop.name.ilike(f"%{words}%"), Shop.description.ilike(f"%{words}%"),
                                Shop.id.in_(select(Product.shop_id).where(Product.name.ilike(f"%{words}%")))))
    if city := (args.get("city") or "").strip():
        query = query.where(Shop.city.ilike(f"%{city}%"))
    if args.get("category") in SHOP_CATEGORIES:
        query = query.where(Shop.category == args["category"])
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    shops = (await db.scalars(query.order_by(Shop.created_at.desc()).limit(MAX_JOBS))).unique().all()
    found = []
    for shop in shops:
        products = []
        if words:
            products = (await db.execute(select(Product.name, Product.price).where(
                Product.shop_id == shop.id, Product.name.ilike(f"%{words}%")).limit(3))).all()
        found.append({"id": shop.id, "name": shop.name, "category": shop.category, "city": shop.city, "address": shop.address,
                      "phone": shop.phone, "delivery": shop.delivery, "opening_hours": shop.opening_hours,
                      "products": [{"name": n, "price_rub": float(p) if p is not None else None} for n, p in products]})
    return {"total": total, "shops": found}


async def _exchange_rate(db, args):
    try:
        await rates.ensure_fresh(db)
    except Exception:
        pass
    latest = await rates.latest(db)
    if not latest:
        return {"error": "the rate is not available right now"}
    result = {source: {"tjs_for_1_rub": round(r["value"], 4), "date": r["day"].strftime("%d.%m.%Y")}
              for source, r in latest.items()}
    rate = (latest.get("nbt") or next(iter(latest.values())))["value"]
    amount = args.get("amount")
    if isinstance(amount, (int, float)) and amount > 0:
        if args.get("direction") == "tjs_to_rub":
            result["converted"] = {"tjs": amount, "rub": round(amount / rate, 2)}
        else:
            result["converted"] = {"rub": amount, "tjs": round(amount * rate, 2)}
    result["note"] = "nbt = National Bank of Tajikistan, cbr = Bank of Russia; transfer services use their own rate"
    return result


async def _check_employer(db, args):
    name = (args.get("name") or "").strip()
    if len(name) < 2:
        return {"error": "give a company name"}
    rows = (await db.scalars(select(Employer).where(or_(Employer.name.ilike(f"%{name}%"), Employer.inn == name))
                             .order_by(Employer.is_blacklisted.desc(), Employer.reports_count.desc()).limit(5))).all()
    return {"found": [{"id": e.id, "name": e.name, "city": e.city, "inn": e.inn, "blacklisted": e.is_blacklisted,
                       "reason": e.blacklist_reason, "reports": e.reports_count, "verified": e.is_verified}
                      for e in rows]}


async def _my_course(db, user):
    if user is None:
        return {"error": "the visitor is not logged in"}
    data = await stats.course_stats(db, user)
    nxt = None
    for level in data["levels"]:
        if level["passed"]:
            continue
        if level["done"] < level["total"]:
            number = level["done"] + 1
            nxt = {"level": level["level"], "lesson": number,
                   "title": (course.lesson(level["level"], number) or {}).get("title", "")}
        else:
            nxt = {"level": level["level"], "exam": True}
        break
    return {"lessons_done": data["lessons_done"], "lessons_total": data["lessons_total"],
            "levels_passed": data["levels_passed"], "average_score": data["average_score"],
            "days_in_a_row": data["streak"], "this_week": data["this_week"], "certificate": bool(data["certificate"]),
            "next": nxt, "last_lessons": [{"level": r["level"], "lesson": r["number"], "title": r["title"],
                                            "score": r["score"]} for r in data["recent"][:3]]}


async def _my_activity(db, user):
    if user is None:
        return {"error": "the visitor is not logged in"}
    data = await stats.activity(db, user)
    return {"days_with_muhojir": data["member_days"], "total_actions": data["total"],
            "totals": {k: v for k, v in data["totals"].items() if v}, "days_in_a_row": data["streak"],
            "active_days_last_half_year": data["active_days"], "paid_rub": data["paid"],
            "recent": [{"kind": r["kind"], "title": r["title"], "date": r["at"][:10]} for r in data["recent"][:5]]}


async def _latest_news(db, args):
    query = select(LawNews).where(LawNews.is_published.is_(True))
    if words := (args.get("search") or "").strip():
        query = query.where(or_(LawNews.title.ilike(f"%{words}%"), LawNews.body.ilike(f"%{words}%")))
    rows = (await db.scalars(query.order_by(LawNews.published_at.desc()).limit(MAX_JOBS))).all()
    return {"news": [{"id": n.id, "title": n.title, "date": n.published_at.strftime("%d.%m.%Y") if n.published_at else ""}
                     for n in rows]}


async def run_tool(db, name, tool_input, user=None):
    tool_input = tool_input if isinstance(tool_input, dict) else {}
    if name == "navigate":
        result = await _navigate(db, tool_input, user)
    elif name == "patent_price":
        result = await _patent_price(db, tool_input)
    elif name == "guide_steps":
        result = await _guide_steps(db, tool_input)
    elif name == "find_jobs":
        result = await _find_jobs(db, tool_input)
    elif name == "find_places":
        result = await _find_places(db, tool_input)
    elif name == "airports":
        result = await _airports(db)
    elif name == "flight_prices":
        result = await _flight_prices(db, tool_input)
    elif name == "my_documents":
        result = await _my_documents(db, user)
    elif name == "find_housing":
        result = await _find_housing(db, tool_input)
    elif name == "find_shops":
        result = await _find_shops(db, tool_input)
    elif name == "exchange_rate":
        result = await _exchange_rate(db, tool_input)
    elif name == "check_employer":
        result = await _check_employer(db, tool_input)
    elif name == "my_course":
        result = await _my_course(db, user)
    elif name == "my_activity":
        result = await _my_activity(db, user)
    elif name == "latest_news":
        result = await _latest_news(db, tool_input)
    else:
        return f"Unknown tool {name}", True, None
    return json.dumps(result, ensure_ascii=False), "error" in result, result.get("opened")
