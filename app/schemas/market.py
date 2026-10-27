import re
from typing import Literal

from pydantic import Field, field_validator, model_validator

from app.models.market import PRODUCT_UNITS, SHOP_CATEGORIES, SHOP_ORIGINS
from app.schemas.common import Form, normalize_phone

Category = Literal[tuple(SHOP_CATEGORIES)]
Origin = Literal[tuple(SHOP_ORIGINS)]
Unit = Literal[PRODUCT_UNITS]

NO_CONTACT = "Give at least one contact: phone, WhatsApp or Telegram."
BAD_TELEGRAM = "Write the Telegram username, e.g. @dukoni_mo."


def media(name):
    return f"/media/{name}" if name else None


def owner_name(user):
    name = (user.full_name or "").split() if user else []
    return name[0] if name else "Корбар"


def shop_json(shop, avg=None, n=None, products=None, viewer=None):
    data = {
        "id": shop.id, "name": shop.name, "category": shop.category, "category_label": shop.category_label,
        "origin": shop.origin, "origin_label": shop.origin_label, "description": shop.description,
        "city": shop.city, "address": shop.address, "lat": shop.lat, "lon": shop.lon, "phone": shop.phone,
        "whatsapp": shop.whatsapp, "telegram": shop.telegram, "opening_hours": shop.opening_hours,
        "delivery": shop.delivery, "logo": media(shop.logo), "status": shop.status,
        "owner_name": owner_name(shop.owner), "is_mine": bool(viewer and shop.owner_id == viewer.id),
        "rating": round(float(avg), 1) if avg else None, "reviews_count": n or 0, "products_count": products or 0,
        "created_at": shop.created_at, "updated_at": shop.updated_at,
    }
    if viewer and (viewer.id == shop.owner_id or viewer.is_editor):
        data["reject_reason"] = shop.reject_reason
    return data


def shop_short_json(shop):
    return {"id": shop.id, "name": shop.name, "city": shop.city, "origin": shop.origin, "logo": media(shop.logo),
            "delivery": shop.delivery, "phone": shop.phone, "whatsapp": shop.whatsapp, "telegram": shop.telegram}


def product_json(product, with_shop=False):
    data = {
        "id": product.id, "shop_id": product.shop_id, "name": product.name, "description": product.description,
        "price": product.price, "unit": product.unit, "photo": media(product.photo), "in_stock": product.in_stock,
        "created_at": product.created_at, "updated_at": product.updated_at,
    }
    if with_shop:
        data["shop"] = shop_short_json(product.shop)
    return data


def review_json(review, viewer=None):
    return {"id": review.id, "shop": review.shop_id, "author_name": owner_name(review.author),
            "is_mine": bool(viewer and review.author_id == viewer.id), "rating": review.rating, "text": review.text,
            "created_at": review.created_at}


def clean_phone(value):
    return normalize_phone(value) if value else ""


def clean_telegram(value):
    value = re.sub(r"^(https?://)?(t\.me/|telegram\.me/)", "", (value or "").strip()).lstrip("@")
    if value and not re.fullmatch(r"[A-Za-z0-9_]{5,32}", value):
        raise ValueError(BAD_TELEGRAM)
    return value


class ShopFields(Form):

    @field_validator("phone", "whatsapp", check_fields=False)
    @classmethod
    def phone_format(cls, value):
        return None if value is None else clean_phone(value)

    @field_validator("telegram", check_fields=False)
    @classmethod
    def telegram_format(cls, value):
        return None if value is None else clean_telegram(value)


class ShopIn(ShopFields):
    name: str = Field(min_length=2, max_length=120)
    category: Category
    origin: Origin = "tj"
    description: str = Field("", max_length=2000)
    city: str = Field(min_length=2, max_length=100)
    address: str = Field("", max_length=255)
    lat: float | None = Field(None, ge=-90, le=90)
    lon: float | None = Field(None, ge=-180, le=180)
    phone: str = ""
    whatsapp: str = ""
    telegram: str = ""
    opening_hours: str = Field("", max_length=120)
    delivery: bool = False

    @model_validator(mode="after")
    def has_contact(self):
        if not (self.phone or self.whatsapp or self.telegram):
            raise ValueError(NO_CONTACT)
        return self


class ShopPatch(ShopFields):
    name: str | None = Field(None, min_length=2, max_length=120)
    category: Category | None = None
    origin: Origin | None = None
    description: str | None = Field(None, max_length=2000)
    city: str | None = Field(None, min_length=2, max_length=100)
    address: str | None = Field(None, max_length=255)
    lat: float | None = Field(None, ge=-90, le=90)
    lon: float | None = Field(None, ge=-180, le=180)
    phone: str | None = None
    whatsapp: str | None = None
    telegram: str | None = None
    opening_hours: str | None = Field(None, max_length=120)
    delivery: bool | None = None


class ModerateIn(Form):
    status: Literal["approved", "rejected"]
    reason: str = Field("", max_length=1000)


class ProductIn(Form):
    name: str = Field(min_length=2, max_length=120)
    description: str = Field("", max_length=1000)
    price: int = Field(ge=0, le=10_000_000)
    unit: Unit = "dona"
    in_stock: bool = True


class ProductPatch(Form):
    name: str | None = Field(None, min_length=2, max_length=120)
    description: str | None = Field(None, max_length=1000)
    price: int | None = Field(None, ge=0, le=10_000_000)
    unit: Unit | None = None
    in_stock: bool | None = None


class ReviewIn(Form):
    rating: int = Field(ge=1, le=5)
    text: str = Field("", max_length=2000)
