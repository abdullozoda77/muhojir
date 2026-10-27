from sqlalchemy import select

from app.core.files import delete_image
from app.models import Product, User
from app.services.notify import notify

LOGOS = "shops"
PHOTOS = "products"


def status_message(shop):
    if shop.status == "approved":
        return "Мағозаи шумо тасдиқ шуд", f"Мағозаи «{shop.name}» санҷида шуд ва акнун дар саҳифаи «Мағозаҳо» ба ҳама намоён аст."
    reason = f"\n\nСабаб: {shop.reject_reason}" if shop.reject_reason else ""
    return "Мағозаи шумо рад шуд", f"Мағозаи «{shop.name}» қабул нашуд.{reason}\n\nМаълумотро ислоҳ кунед — пас аз тағйир боз санҷида мешавад."


async def tell_owner(db, shop):
    if shop.status not in ("approved", "rejected"):
        return
    owner = await db.get(User, shop.owner_id)
    if owner is not None:
        title, message = status_message(shop)
        await notify(db, owner, title, message, kind="system")


async def shop_files(db, shop):
    photos = (await db.scalars(select(Product.photo).where(Product.shop_id == shop.id, Product.photo != ""))).all()
    return [(shop.logo, LOGOS), *((photo, PHOTOS) for photo in photos)]


async def delete_files(files):
    for name, folder in files:
        await delete_image(name, folder)
