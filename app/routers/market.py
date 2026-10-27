from typing import Annotated

from fastapi import APIRouter, File, Form, Request, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, or_, select

from app.core.crud import apply_ordering
from app.core.deps import DB, CurrentUser, EditorUser, OptionalUser
from app.core.errors import ApiError, FieldError
from app.core.files import delete_image, delete_private, private_path, save_image, save_private
from app.core.pagination import Paginate
from app.models import REQUIRED_PROOFS, SHOP_CATEGORIES, Product, Shop, ShopProof, ShopReview
from app.routers.documents import int_param, param
from app.routers.jobs import bool_param
from app.schemas import market as s
from app.services.market import LOGOS, PHOTOS, PROOFS, delete_files, shop_files, tell_owner

router = APIRouter(prefix="/api/market", tags=["market"])

MAX_SHOPS = 3
MAX_PRODUCTS = 300
MAX_PROOFS = 8
NEED_PROOFS = "Add a photo of the place and a photo of the goods first."
NEED_LOCATION = "Mark where the shop is on the map."
NO_RIGHTS = "У вас недостаточно прав для выполнения данного действия."

ratings = (select(ShopReview.shop_id, func.avg(ShopReview.rating).label("avg"), func.count().label("n"))
           .group_by(ShopReview.shop_id).subquery())
stock = select(Product.shop_id, func.count().label("n")).group_by(Product.shop_id).subquery()


def shops_query():
    return (select(Shop, ratings.c.avg, ratings.c.n, stock.c.n)
            .outerjoin(ratings, ratings.c.shop_id == Shop.id).outerjoin(stock, stock.c.shop_id == Shop.id))


def visible(query, user):
    if user and user.is_editor:
        return query
    if user:
        return query.where(or_(Shop.status == "approved", Shop.owner_id == user.id))
    return query.where(Shop.status == "approved")


def shop_filters(query, request, search=True):
    if search and (words := param(request, "search")):
        query = query.where(or_(Shop.name.ilike(f"%{words}%"), Shop.description.ilike(f"%{words}%"),
                                Shop.id.in_(select(Product.shop_id).where(Product.name.ilike(f"%{words}%")))))
    if city := param(request, "city"):
        query = query.where(Shop.city.ilike(f"%{city}%"))
    if (category := param(request, "category")) and category in SHOP_CATEGORIES:
        query = query.where(Shop.category == category)
    if bool_param(request, "delivery"):
        query = query.where(Shop.delivery.is_(True))
    return query


def as_json(user):
    return lambda shop, avg=None, n=None, products=None: s.shop_json(shop, avg, n, products, user)


@router.get("/shops/")
async def list_shops(request: Request, db: DB, user: OptionalUser, page: Paginate):
    query = shops_query()
    if bool_param(request, "mine"):
        query = query.where(Shop.owner_id == (user.id if user else -1))
    elif user and user.is_editor and param(request, "status"):
        query = query.where(Shop.status == param(request, "status"))
    else:
        query = query.where(Shop.status == "approved")
    query = shop_filters(query, request)
    query = apply_ordering(request, query, {"created_at": Shop.created_at, "name": Shop.name, "rating": ratings.c.avg},
                           [ratings.c.n.desc().nulls_last(), stock.c.n.desc().nulls_last(), Shop.created_at.desc()])
    return await page.respond(db, query, as_json(user))


@router.get("/shops/summary/")
async def summary(db: DB):
    approved = select(Shop).where(Shop.status == "approved").subquery()
    categories = dict((await db.execute(select(approved.c.category, func.count()).group_by(approved.c.category))).all())
    cities = (await db.execute(select(approved.c.city, func.count()).group_by(approved.c.city)
                               .order_by(func.count().desc()).limit(30))).all()
    products = await db.scalar(select(func.count()).select_from(Product).where(
        Product.shop_id.in_(select(approved.c.id))))
    return {"shops": sum(categories.values()), "products": products,
            "categories": {c: categories.get(c, 0) for c in SHOP_CATEGORIES},
            "cities": [{"name": c, "count": n} for c, n in cities]}


async def get_shop_row(db, user, shop_id):
    query = visible(shops_query(), user).where(Shop.id == shop_id).execution_options(populate_existing=True)
    row = (await db.execute(query)).unique().first()
    if row is None:
        raise ApiError("No Shop matches the given query.", 404)
    return row


async def own_shop(db, user, shop_id):
    shop = (await get_shop_row(db, user, shop_id))[0]
    if shop.owner_id != user.id and not user.is_editor:
        raise ApiError(NO_RIGHTS, 403)
    return shop


async def shop_answer(db, user, shop_id):
    return as_json(user)(*await get_shop_row(db, user, shop_id))


@router.get("/shops/{shop_id}/")
async def shop_detail(shop_id: int, db: DB, user: OptionalUser):
    data = await shop_answer(db, user, shop_id)
    mine = await db.scalar(select(ShopReview).where(ShopReview.shop_id == shop_id, ShopReview.author_id == user.id)) if user else None
    data["my_review"] = s.review_json(mine, user) if mine else None
    return data


@router.post("/shops/", status_code=201)
async def create_shop(data: s.ShopIn, db: DB, user: CurrentUser):
    if not user.is_editor:
        count = await db.scalar(select(func.count()).select_from(Shop).where(Shop.owner_id == user.id))
        if count >= MAX_SHOPS:
            raise ApiError({"detail": [f"You can have at most {MAX_SHOPS} shops."]})
    shop = Shop(**data.model_dump(), owner_id=user.id, status="approved" if user.is_editor else "draft")
    db.add(shop)
    await db.commit()
    return await shop_answer(db, user, shop.id)


@router.patch("/shops/{shop_id}/")
async def update_shop(shop_id: int, data: s.ShopPatch, db: DB, user: CurrentUser):
    shop = await own_shop(db, user, shop_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None or field in ("lat", "lon"):
            setattr(shop, field, value)
    if not (shop.phone or shop.whatsapp or shop.telegram):
        raise ApiError({"non_field_errors": [s.NO_CONTACT]})
    await db.commit()
    return await shop_answer(db, user, shop_id)


@router.delete("/shops/{shop_id}/", status_code=204)
async def delete_shop(shop_id: int, db: DB, user: CurrentUser):
    shop = await own_shop(db, user, shop_id)
    files = await shop_files(db, shop)
    await db.delete(shop)
    await db.commit()
    await delete_files(files)
    return Response(status_code=204)


@router.post("/shops/{shop_id}/moderate/")
async def moderate_shop(shop_id: int, data: s.ModerateIn, db: DB, user: EditorUser):
    shop = (await get_shop_row(db, user, shop_id))[0]
    if shop.status == "draft":
        raise ApiError({"detail": ["The owner has not sent this shop for checking yet."]})
    if data.status == "rejected" and not data.reason:
        raise FieldError("reason", "Write why the shop is rejected.")
    shop.status, shop.reject_reason = data.status, data.reason if data.status == "rejected" else ""
    await db.commit()
    await tell_owner(db, shop)
    return await shop_answer(db, user, shop_id)


async def proof_kinds(db, shop_id):
    return set((await db.scalars(select(ShopProof.kind).where(ShopProof.shop_id == shop_id))).all())


@router.get("/shops/{shop_id}/proofs/")
async def list_proofs(shop_id: int, db: DB, user: CurrentUser):
    shop = await own_shop(db, user, shop_id)
    proofs = await db.scalars(select(ShopProof).where(ShopProof.shop_id == shop.id).order_by(ShopProof.id))
    return [s.proof_json(p) for p in proofs]


@router.post("/shops/{shop_id}/proofs/", status_code=201)
async def add_proof(shop_id: int, db: DB, user: CurrentUser, kind: Annotated[s.ProofKind, Form()],
                    file: Annotated[UploadFile, File()]):
    shop = await own_shop(db, user, shop_id)
    if await db.scalar(select(func.count()).select_from(ShopProof).where(ShopProof.shop_id == shop.id)) >= MAX_PROOFS:
        raise ApiError({"detail": [f"At most {MAX_PROOFS} files."]})
    proof = ShopProof(shop_id=shop.id, kind=kind, file=await save_private(file, PROOFS, "file"))
    db.add(proof)
    await db.commit()
    return s.proof_json(proof)


async def get_proof(db, user, shop_id, proof_id):
    shop = await own_shop(db, user, shop_id)
    proof = await db.scalar(select(ShopProof).where(ShopProof.id == proof_id, ShopProof.shop_id == shop.id))
    if proof is None:
        raise ApiError("No ShopProof matches the given query.", 404)
    return proof


@router.get("/shops/{shop_id}/proofs/{proof_id}/")
async def proof_file(shop_id: int, proof_id: int, db: DB, user: CurrentUser):
    path = private_path((await get_proof(db, user, shop_id, proof_id)).file)
    if path is None or not path.exists():
        raise ApiError("File not found.", 404)
    return FileResponse(path, headers={"Cache-Control": "private, no-store"})


@router.delete("/shops/{shop_id}/proofs/{proof_id}/", status_code=204)
async def delete_proof(shop_id: int, proof_id: int, db: DB, user: CurrentUser):
    proof = await get_proof(db, user, shop_id, proof_id)
    name = proof.file
    await db.delete(proof)
    await db.commit()
    await delete_private(name)
    return Response(status_code=204)


@router.post("/shops/{shop_id}/submit/")
async def submit_shop(shop_id: int, db: DB, user: CurrentUser):
    shop = await own_shop(db, user, shop_id)
    if shop.status not in ("draft", "rejected"):
        raise ApiError({"detail": ["The shop is already sent for checking."]})
    if not set(REQUIRED_PROOFS) <= await proof_kinds(db, shop.id):
        raise ApiError({"proofs": [NEED_PROOFS]})
    if shop.lat is None or shop.lon is None:
        raise ApiError({"location": [NEED_LOCATION]})
    shop.status = "pending"
    await db.commit()
    return await shop_answer(db, user, shop_id)


@router.post("/shops/{shop_id}/logo/")
async def upload_logo(shop_id: int, db: DB, user: CurrentUser, logo: Annotated[UploadFile, File()]):
    shop = await own_shop(db, user, shop_id)
    old, shop.logo = shop.logo, await save_image(logo, LOGOS, "logo")
    await db.commit()
    await delete_image(old, LOGOS)
    return await shop_answer(db, user, shop_id)


@router.delete("/shops/{shop_id}/logo/")
async def remove_logo(shop_id: int, db: DB, user: CurrentUser):
    shop = await own_shop(db, user, shop_id)
    old, shop.logo = shop.logo, ""
    await db.commit()
    await delete_image(old, LOGOS)
    return await shop_answer(db, user, shop_id)


def product_filters(query, request):
    if words := param(request, "search"):
        query = query.where(or_(Product.name.ilike(f"%{words}%"), Product.description.ilike(f"%{words}%")))
    if (max_price := int_param(request, "max_price")) is not None:
        query = query.where(Product.price <= max_price)
    in_stock = bool_param(request, "in_stock")
    if in_stock is not None:
        query = query.where(Product.in_stock.is_(in_stock))
    return apply_ordering(request, query, {"price": Product.price, "created_at": Product.created_at, "name": Product.name},
                          [Product.in_stock.desc(), Product.created_at.desc(), Product.id.desc()])


@router.get("/shops/{shop_id}/products/")
async def shop_products(shop_id: int, request: Request, db: DB, user: OptionalUser, page: Paginate):
    await get_shop_row(db, user, shop_id)
    query = product_filters(select(Product).where(Product.shop_id == shop_id), request)
    return await page.respond(db, query, s.product_json)


@router.post("/shops/{shop_id}/products/", status_code=201)
async def create_product(shop_id: int, data: s.ProductIn, db: DB, user: CurrentUser):
    shop = await own_shop(db, user, shop_id)
    if await db.scalar(select(func.count()).select_from(Product).where(Product.shop_id == shop.id)) >= MAX_PRODUCTS:
        raise ApiError({"detail": [f"A shop can have at most {MAX_PRODUCTS} products."]})
    product = Product(**data.model_dump(), shop_id=shop.id)
    db.add(product)
    await db.commit()
    return s.product_json(await get_product(db, user, product.id))


@router.get("/products/")
async def list_products(request: Request, db: DB, page: Paginate):
    shops = shop_filters(select(Shop.id).where(Shop.status == "approved"), request, search=False)
    query = product_filters(select(Product).where(Product.shop_id.in_(shops)), request)
    return await page.respond(db, query, lambda p: s.product_json(p, with_shop=True))


async def get_product(db, user, product_id):
    query = select(Product).where(Product.id == product_id).execution_options(populate_existing=True)
    product = (await db.execute(query)).unique().scalar_one_or_none()
    if product is not None:
        shop = product.shop
        if shop.status == "approved" or (user and (user.is_editor or shop.owner_id == user.id)):
            return product
    raise ApiError("No Product matches the given query.", 404)


async def own_product(db, user, product_id):
    product = await get_product(db, user, product_id)
    if product.shop.owner_id != user.id and not user.is_editor:
        raise ApiError(NO_RIGHTS, 403)
    return product


@router.get("/products/{product_id}/")
async def product_detail(product_id: int, db: DB, user: OptionalUser):
    return s.product_json(await get_product(db, user, product_id), with_shop=True)


@router.patch("/products/{product_id}/")
async def update_product(product_id: int, data: s.ProductPatch, db: DB, user: CurrentUser):
    product = await own_product(db, user, product_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(product, field, value)
    await db.commit()
    return s.product_json(await get_product(db, user, product_id))


@router.delete("/products/{product_id}/", status_code=204)
async def delete_product(product_id: int, db: DB, user: CurrentUser):
    product = await own_product(db, user, product_id)
    photo = product.photo
    await db.delete(product)
    await db.commit()
    await delete_image(photo, PHOTOS)
    return Response(status_code=204)


@router.post("/products/{product_id}/photo/")
async def upload_photo(product_id: int, db: DB, user: CurrentUser, photo: Annotated[UploadFile, File()]):
    product = await own_product(db, user, product_id)
    old, product.photo = product.photo, await save_image(photo, PHOTOS, "photo")
    await db.commit()
    await delete_image(old, PHOTOS)
    return s.product_json(await get_product(db, user, product_id))


@router.delete("/products/{product_id}/photo/")
async def remove_photo(product_id: int, db: DB, user: CurrentUser):
    product = await own_product(db, user, product_id)
    old, product.photo = product.photo, ""
    await db.commit()
    await delete_image(old, PHOTOS)
    return s.product_json(await get_product(db, user, product_id))


@router.get("/shops/{shop_id}/reviews/")
async def shop_reviews(shop_id: int, db: DB, user: OptionalUser, page: Paginate):
    await get_shop_row(db, user, shop_id)
    query = select(ShopReview).where(ShopReview.shop_id == shop_id).order_by(ShopReview.created_at.desc(), ShopReview.id.desc())
    return await page.respond(db, query, lambda r: s.review_json(r, user))


@router.put("/shops/{shop_id}/reviews/mine/")
async def write_review(shop_id: int, data: s.ReviewIn, db: DB, user: CurrentUser):
    shop = (await get_shop_row(db, user, shop_id))[0]
    if shop.owner_id == user.id:
        raise ApiError({"detail": ["You cannot review your own shop."]})
    if shop.status != "approved":
        raise ApiError("No Shop matches the given query.", 404)
    review = await db.scalar(select(ShopReview).where(ShopReview.shop_id == shop.id, ShopReview.author_id == user.id))
    if review is None:
        review = ShopReview(shop_id=shop.id, author_id=user.id)
        db.add(review)
    review.rating, review.text = data.rating, data.text
    await db.commit()
    await db.refresh(review, ["author"])
    return s.review_json(review, user)


@router.delete("/shops/{shop_id}/reviews/mine/", status_code=204)
async def delete_review(shop_id: int, db: DB, user: CurrentUser):
    review = await db.scalar(select(ShopReview).where(ShopReview.shop_id == shop_id, ShopReview.author_id == user.id))
    if review is None:
        raise ApiError("No ShopReview matches the given query.", 404)
    await db.delete(review)
    await db.commit()
    return Response(status_code=204)


@router.delete("/reviews/{review_id}/", status_code=204)
async def remove_review(review_id: int, db: DB, user: EditorUser):
    review = await db.get(ShopReview, review_id)
    if review is None:
        raise ApiError("No ShopReview matches the given query.", 404)
    await db.delete(review)
    await db.commit()
    return Response(status_code=204)
