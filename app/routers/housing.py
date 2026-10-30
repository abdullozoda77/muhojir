from typing import Annotated

from fastapi import APIRouter, Depends, File, Request, Response, UploadFile
from sqlalchemy import func, or_, select

from app.core.crud import apply_ordering
from app.core.deps import DB, CurrentUser, EditorUser, OptionalUser
from app.core.errors import ApiError, FieldError
from app.core.files import delete_image, save_image
from app.core.pagination import Paginate
from app.core.throttle import throttle
from app.models import HOUSING_FOR, HOUSING_KINDS, HOUSING_PERIODS, Housing, HousingPhoto, User
from app.routers.documents import int_param, param
from app.routers.jobs import bool_param
from app.schemas.housing import HousingIn, HousingPatch, housing_json
from app.schemas.market import NO_CONTACT, ModerateIn
from app.services.notify import notify, notify_editors

router = APIRouter(prefix="/api/housing", tags=["housing"])

PHOTOS = "housing"
MAX_WAITING = 5
MAX_PHOTOS = 8
NO_RIGHTS = "У вас недостаточно прав для выполнения данного действия."
NOT_FOUND = "No Housing matches the given query."


def as_json(user):
    return lambda h: housing_json(h, user)


def housing_filters(query, request):
    if words := param(request, "search"):
        like = f"%{words}%"
        query = query.where(or_(Housing.title.ilike(like), Housing.description.ilike(like),
                                Housing.address.ilike(like), Housing.metro.ilike(like)))
    if city := param(request, "city"):
        query = query.where(Housing.city.ilike(f"%{city}%"))
    if (kind := param(request, "kind")) in HOUSING_KINDS:
        query = query.where(Housing.kind == kind)
    if (who := param(request, "for_whom")) in HOUSING_FOR:
        query = query.where(Housing.for_whom.in_({who, "any"}))
    if (period := param(request, "period")) in HOUSING_PERIODS:
        query = query.where(Housing.period == period)
    if (min_price := int_param(request, "min_price")) is not None:
        query = query.where(Housing.price >= min_price)
    if (max_price := int_param(request, "max_price")) is not None:
        query = query.where(Housing.price <= max_price)
    for flag in ("registration", "utilities_included", "no_deposit"):
        if bool_param(request, flag):
            query = query.where(getattr(Housing, flag).is_(True))
    if bool_param(request, "with_photos"):
        query = query.where(Housing.id.in_(select(HousingPhoto.housing_id)))
    return query


@router.get("/")
async def list_housing(request: Request, db: DB, user: OptionalUser, page: Paginate):
    query = select(Housing)
    if bool_param(request, "mine"):
        query = query.where(Housing.owner_id == (user.id if user else -1))
    elif user and user.is_editor and param(request, "status"):
        query = query.where(Housing.status == param(request, "status"))
    else:
        query = query.where(Housing.status == "approved", Housing.is_active.is_(True))
    query = housing_filters(query, request)
    query = apply_ordering(request, query, {"price": Housing.price, "created_at": Housing.created_at},
                           [Housing.created_at.desc(), Housing.id.desc()])
    return await page.respond(db, query, as_json(user))


@router.get("/summary/")
async def summary(db: DB):
    shown = select(Housing).where(Housing.status == "approved", Housing.is_active.is_(True)).subquery()
    kinds = dict((await db.execute(select(shown.c.kind, func.count()).group_by(shown.c.kind))).all())
    cities = (await db.execute(select(shown.c.city, func.count()).group_by(shown.c.city)
                               .order_by(func.count().desc()).limit(20))).all()
    return {"total": sum(kinds.values()), "kinds": {k: kinds.get(k, 0) for k in HOUSING_KINDS},
            "cities": [{"name": c, "count": n} for c, n in cities]}


async def get_housing(db, user, housing_id):
    housing = await db.get(Housing, housing_id, populate_existing=True)
    if housing is None:
        raise ApiError(NOT_FOUND, 404)
    public = housing.status == "approved" and housing.is_active
    if not public and not (user and (user.is_editor or housing.owner_id == user.id)):
        raise ApiError(NOT_FOUND, 404)
    return housing


async def own_housing(db, user, housing_id):
    housing = await get_housing(db, user, housing_id)
    if housing.owner_id != user.id and not user.is_editor:
        raise ApiError(NO_RIGHTS, 403)
    return housing


async def answer(db, user, housing_id):
    return housing_json(await get_housing(db, user, housing_id), user)


async def ask_editors(db, housing, user, title):
    await notify_editors(db, title, f"«{housing.title}» ({housing.city}, {housing.price} ₽). Эълонро санҷед.", skip=user)


async def tell_owner(db, housing):
    owner = await db.get(User, housing.owner_id)
    if owner is None:
        return
    if housing.status == "approved":
        title = "Эълони манзил тасдиқ шуд"
        text = f"«{housing.title}» санҷида шуд ва акнун дар саҳифаи «Манзил» ба ҳама намоён аст."
    else:
        title = "Эълони манзил рад шуд"
        text = f"«{housing.title}» қабул нашуд.\n\nСабаб: {housing.reject_reason}\n\nЭълонро ислоҳ кунед — он боз ба санҷиш меравад."
    await notify(db, owner, title, text, kind="system")


@router.get("/{housing_id}/")
async def housing_detail(housing_id: int, db: DB, user: OptionalUser):
    return await answer(db, user, housing_id)


@router.post("/", status_code=201, dependencies=[Depends(throttle("housing"))])
async def create_housing(data: HousingIn, db: DB, user: CurrentUser):
    if not user.is_editor:
        waiting = await db.scalar(select(func.count()).select_from(Housing).where(
            Housing.owner_id == user.id, Housing.status == "pending"))
        if waiting >= MAX_WAITING:
            raise ApiError({"detail": [f"You already have {MAX_WAITING} listings waiting for checking."]})
    housing = Housing(**data.model_dump(), owner_id=user.id, status="approved" if user.is_editor else "pending")
    db.add(housing)
    await db.commit()
    if housing.status == "pending":
        await ask_editors(db, housing, user, "Эълони нави манзил барои санҷиш")
    return await answer(db, user, housing.id)


@router.patch("/{housing_id}/")
async def update_housing(housing_id: int, data: HousingPatch, db: DB, user: CurrentUser):
    housing = await own_housing(db, user, housing_id)
    changes = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None or k in ("rooms", "places")}
    for field, value in changes.items():
        setattr(housing, field, value)
    if not (housing.phone or housing.whatsapp or housing.telegram):
        raise ApiError({"non_field_errors": [NO_CONTACT]})
    recheck = not user.is_editor and housing.status != "pending" and bool(set(changes) - {"is_active"})
    if recheck:
        housing.status, housing.reject_reason = "pending", ""
    await db.commit()
    if recheck:
        await ask_editors(db, housing, user, "Эълони манзил тағйир ёфт")
    return await answer(db, user, housing_id)


@router.delete("/{housing_id}/", status_code=204)
async def delete_housing(housing_id: int, db: DB, user: CurrentUser):
    housing = await own_housing(db, user, housing_id)
    files = [p.file for p in housing.photos]
    await db.delete(housing)
    await db.commit()
    for name in files:
        await delete_image(name, PHOTOS)
    return Response(status_code=204)


@router.post("/{housing_id}/moderate/")
async def moderate_housing(housing_id: int, data: ModerateIn, db: DB, user: EditorUser):
    housing = await get_housing(db, user, housing_id)
    if data.status == "rejected" and not data.reason:
        raise FieldError("reason", "Write why the listing is rejected.")
    housing.status, housing.reject_reason = data.status, data.reason if data.status == "rejected" else ""
    await db.commit()
    await tell_owner(db, housing)
    return await answer(db, user, housing_id)


@router.post("/{housing_id}/photos/", status_code=201)
async def add_photo(housing_id: int, db: DB, user: CurrentUser, photo: Annotated[UploadFile, File()]):
    housing = await own_housing(db, user, housing_id)
    if len(housing.photos) >= MAX_PHOTOS:
        raise ApiError({"detail": [f"At most {MAX_PHOTOS} photos."]})
    db.add(HousingPhoto(housing_id=housing.id, file=await save_image(photo, PHOTOS, "photo", max_mb=5)))
    await db.commit()
    return await answer(db, user, housing_id)


@router.delete("/{housing_id}/photos/{photo_id}/")
async def delete_photo(housing_id: int, photo_id: int, db: DB, user: CurrentUser):
    housing = await own_housing(db, user, housing_id)
    photo = next((p for p in housing.photos if p.id == photo_id), None)
    if photo is None:
        raise ApiError("No HousingPhoto matches the given query.", 404)
    name = photo.file
    await db.delete(photo)
    await db.commit()
    await delete_image(name, PHOTOS)
    return await answer(db, user, housing_id)
