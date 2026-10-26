import math
from typing import Literal

from fastapi import APIRouter, Request, Response
from pydantic import Field
from sqlalchemy import and_, func, or_, select

from app.core.deps import DB, CurrentUser, OptionalUser
from app.core.errors import ApiError, FieldError
from app.core.pagination import Paginate
from app.models import PLACE_CATEGORIES, Place, PlaceReview
from app.routers.documents import param
from app.schemas.common import Form

router = APIRouter(prefix="/api/places", tags=["places"])

Category = Literal[PLACE_CATEGORIES]
MAP_LIMIT = 3000

ratings = (select(PlaceReview.place_id, func.avg(PlaceReview.rating).label("avg"), func.count().label("n"))
           .group_by(PlaceReview.place_id).subquery())


def place_json(place, avg=None, n=None, distance=None):
    return {
        "id": place.id, "category": place.category, "name": place.name, "region": place.region, "city": place.city,
        "address": place.address, "lat": place.lat, "lon": place.lon, "phone": place.phone, "website": place.website,
        "opening_hours": place.opening_hours, "description": place.description, "source": place.source,
        "is_approved": place.is_approved, "rating": round(float(avg), 1) if avg else None, "reviews_count": n or 0,
        "distance_km": round(math.sqrt(distance) * 111.2, 1) if distance is not None else None,
    }


def visible(query, user):
    if user and user.is_editor:
        return query
    if user:
        return query.where(or_(Place.is_approved.is_(True), Place.created_by_id == user.id))
    return query.where(Place.is_approved.is_(True))


def filtered(query, request):
    if category := param(request, "category"):
        query = query.where(Place.category.in_(category.split(",")))
    if region := param(request, "region"):
        query = query.where(Place.region == region)
    if city := param(request, "city"):
        query = query.where(Place.city.ilike(f"%{city}%"))
    if words := param(request, "search"):
        query = query.where(or_(Place.name.ilike(f"%{words}%"), Place.address.ilike(f"%{words}%")))
    if bbox := param(request, "bbox"):
        try:
            west, south, east, north = (float(x) for x in bbox.split(","))
        except ValueError:
            raise FieldError("bbox", "Use bbox=west,south,east,north")
        query = query.where(and_(Place.lon.between(west, east), Place.lat.between(south, north)))
    return query


def near(request):
    value = param(request, "near")
    if not value:
        return None
    try:
        lat, lon = (float(x) for x in value.split(","))
    except ValueError:
        raise FieldError("near", "Use near=latitude,longitude")
    return lat, lon


@router.get("/")
async def list_places(request: Request, db: DB, user: OptionalUser, page: Paginate):
    point = near(request)
    columns = [Place, ratings.c.avg, ratings.c.n]
    distance = None
    if point:
        lat, lon = point
        k = math.cos(math.radians(lat))
        distance = (Place.lat - lat) * (Place.lat - lat) + (Place.lon - lon) * k * (Place.lon - lon) * k
        columns.append(distance.label("distance"))
    query = filtered(visible(select(*columns).outerjoin(ratings, ratings.c.place_id == Place.id), user), request)
    ordering = param(request, "ordering")
    if point:
        query = query.where(Place.lat.is_not(None)).order_by(distance)
    elif ordering == "name":
        query = query.order_by(Place.name)
    else:
        query = query.order_by(ratings.c.n.desc().nulls_last(), ratings.c.avg.desc().nulls_last(), Place.name)
    return await page.respond(db, query, place_json)


@router.get("/map/")
async def map_points(request: Request, db: DB, user: OptionalUser):
    query = filtered(visible(select(Place.id, Place.category, Place.name, Place.lat, Place.lon), user), request)
    rows = (await db.execute(query.where(Place.lat.is_not(None)).limit(MAP_LIMIT))).all()
    return [{"id": r.id, "category": r.category, "name": r.name, "lat": r.lat, "lon": r.lon} for r in rows]


@router.get("/summary/")
async def summary(request: Request, db: DB, user: OptionalUser):
    base = visible(select(Place), user).subquery()
    region = param(request, "region")
    by_category = select(base.c.category, func.count()).group_by(base.c.category)
    if region:
        by_category = by_category.where(base.c.region == region)
    categories = {c: n for c, n in (await db.execute(by_category)).all()}
    regions = (await db.execute(select(base.c.region, func.count()).group_by(base.c.region).order_by(func.count().desc()))).all()
    return {"categories": {c: categories.get(c, 0) for c in PLACE_CATEGORIES},
            "regions": [{"name": r, "count": n} for r, n in regions]}


async def get_place(db, user, place_id):
    query = visible(select(Place, ratings.c.avg, ratings.c.n).outerjoin(ratings, ratings.c.place_id == Place.id), user)
    row = (await db.execute(query.where(Place.id == place_id).execution_options(populate_existing=True))).first()
    if row is None:
        raise ApiError("No Place matches the given query.", 404)
    return row


@router.get("/{place_id}/")
async def place_detail(place_id: int, db: DB, user: OptionalUser):
    place, avg, n = await get_place(db, user, place_id)
    data = place_json(place, avg, n)
    mine = await db.scalar(select(PlaceReview).where(PlaceReview.place_id == place.id, PlaceReview.author_id == user.id)) if user else None
    data["my_review"] = review_json(mine, user) if mine else None
    return data


class PlaceIn(Form):
    category: Category
    name: str = Field(min_length=2, max_length=200)
    region: str = Field(min_length=2, max_length=100)
    city: str = Field("", max_length=100)
    address: str = Field(min_length=3, max_length=255)
    lat: float | None = Field(None, ge=-90, le=90)
    lon: float | None = Field(None, ge=-180, le=180)
    phone: str = Field("", max_length=60)
    website: str = Field("", max_length=300)
    opening_hours: str = Field("", max_length=200)
    description: str = Field("", max_length=1000)


@router.post("/", status_code=201)
async def suggest_place(data: PlaceIn, db: DB, user: CurrentUser):
    place = Place(**data.model_dump(), source="editor" if user.is_editor else "user", is_approved=user.is_editor,
                  created_by_id=user.id)
    db.add(place)
    await db.commit()
    return place_json(place)


def review_json(review, viewer=None):
    name = (review.author.full_name or "").split() if review.author else []
    return {"id": review.id, "place": review.place_id, "author_name": name[0] if name else "Корбар",
            "is_mine": bool(viewer and review.author_id == viewer.id), "rating": review.rating, "text": review.text,
            "created_at": review.created_at}


class ReviewIn(Form):
    rating: int = Field(ge=1, le=5)
    text: str = Field("", max_length=2000)


@router.get("/{place_id}/reviews/")
async def place_reviews(place_id: int, db: DB, user: OptionalUser, page: Paginate):
    await get_place(db, user, place_id)
    query = select(PlaceReview).where(PlaceReview.place_id == place_id).order_by(PlaceReview.created_at.desc())
    return await page.respond(db, query, lambda r: review_json(r, user))


@router.put("/{place_id}/reviews/mine/")
async def write_review(place_id: int, data: ReviewIn, db: DB, user: CurrentUser):
    place, _, _ = await get_place(db, user, place_id)
    review = await db.scalar(select(PlaceReview).where(PlaceReview.place_id == place.id, PlaceReview.author_id == user.id))
    if review is None:
        review = PlaceReview(place_id=place.id, author_id=user.id)
        db.add(review)
    review.rating, review.text = data.rating, data.text
    await db.commit()
    await db.refresh(review, ["author"])
    return review_json(review, user)


@router.delete("/{place_id}/reviews/mine/", status_code=204)
async def delete_review(place_id: int, db: DB, user: CurrentUser):
    review = await db.scalar(select(PlaceReview).where(PlaceReview.place_id == place_id, PlaceReview.author_id == user.id))
    if review is None:
        raise ApiError("No PlaceReview matches the given query.", 404)
    await db.delete(review)
    await db.commit()
    return Response(status_code=204)
