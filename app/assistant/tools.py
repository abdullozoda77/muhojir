"""Tools the assistant can call: open a page of the site, and look up patent prices, guides, vacancies and the
visitor's own documents. Every tool returns plain data; the model writes the answer."""
import json
from datetime import date
from urllib.parse import urlencode

from sqlalchemy import func, or_, select

from app.models import PLACE_CATEGORIES, Airport, DocumentType, GuideStep, Place, Region, UserDocument
from app.services import flights
from app.models.jobs import INDUSTRIES, Job
from app.routers.jobs import open_jobs

# The pages navigate may open, and their addresses in the React app.
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
}
DOCUMENT_SLUGS = ["patent", "registration", "migration-card", "insurance-dms", "medical"]
INDUSTRY_KEYS = list(INDUSTRIES)
MAX_JOBS = 5

TOOLS = [
    {
        "name": "navigate",
        "description": (
            "Opens a page of the site for the visitor. For jobs you may add filters (search words, city, industry, "
            "housing). For guides you may open the guide of one document. For places: a kind and a region. For "
            "tickets: from and to."
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
            "Uzbek cafes, halal shops, money transfers. Returns up to 5 with address and rating."
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
]


async def _navigate(db, args):
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
        # Russian word endings change ("Свердловской области" / "Свердловская область"): match word stems.
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
            "title": j.title, "company": j.employer.name, "city": j.city, "address": j.address,
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


async def run_tool(db, name, tool_input, user=None):
    """Runs a tool and returns (text for the model, is_error, path to open or None)."""
    tool_input = tool_input if isinstance(tool_input, dict) else {}
    if name == "navigate":
        result = await _navigate(db, tool_input)
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
    else:
        return f"Unknown tool {name}", True, None
    return json.dumps(result, ensure_ascii=False), "error" in result, result.get("opened")
