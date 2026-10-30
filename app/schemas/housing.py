from typing import Literal

from pydantic import Field, model_validator

from app.models.housing import HOUSING_FOR, HOUSING_KINDS, HOUSING_PERIODS
from app.schemas.market import NO_CONTACT, ShopFields, media, owner_name

Kind = Literal[tuple(HOUSING_KINDS)]
ForWhom = Literal[tuple(HOUSING_FOR)]
Period = Literal[HOUSING_PERIODS]


class HousingIn(ShopFields):
    kind: Kind
    title: str = Field(min_length=5, max_length=120)
    description: str = Field("", max_length=3000)
    city: str = Field(min_length=2, max_length=100)
    address: str = Field("", max_length=255)
    metro: str = Field("", max_length=100)
    price: int = Field(ge=0, le=10_000_000)
    period: Period = "month"
    rooms: int | None = Field(None, ge=1, le=20)
    places: int | None = Field(None, ge=1, le=50)
    for_whom: ForWhom = "any"
    registration: bool = False
    utilities_included: bool = False
    no_deposit: bool = False
    phone: str = ""
    whatsapp: str = ""
    telegram: str = ""

    @model_validator(mode="after")
    def has_contact(self):
        if not (self.phone or self.whatsapp or self.telegram):
            raise ValueError(NO_CONTACT)
        return self


class HousingPatch(ShopFields):
    kind: Kind | None = None
    title: str | None = Field(None, min_length=5, max_length=120)
    description: str | None = Field(None, max_length=3000)
    city: str | None = Field(None, min_length=2, max_length=100)
    address: str | None = Field(None, max_length=255)
    metro: str | None = Field(None, max_length=100)
    price: int | None = Field(None, ge=0, le=10_000_000)
    period: Period | None = None
    rooms: int | None = Field(None, ge=1, le=20)
    places: int | None = Field(None, ge=1, le=50)
    for_whom: ForWhom | None = None
    registration: bool | None = None
    utilities_included: bool | None = None
    no_deposit: bool | None = None
    phone: str | None = None
    whatsapp: str | None = None
    telegram: str | None = None
    is_active: bool | None = None


def housing_json(h, viewer=None):
    data = {
        "id": h.id, "kind": h.kind, "kind_label": h.kind_label, "title": h.title, "description": h.description,
        "city": h.city, "address": h.address, "metro": h.metro, "price": h.price, "period": h.period,
        "rooms": h.rooms, "places": h.places, "for_whom": h.for_whom, "for_whom_label": h.for_whom_label,
        "registration": h.registration, "utilities_included": h.utilities_included, "no_deposit": h.no_deposit,
        "phone": h.phone, "whatsapp": h.whatsapp, "telegram": h.telegram, "is_active": h.is_active,
        "photos": [{"id": p.id, "url": media(p.file)} for p in h.photos], "status": h.status,
        "owner_name": owner_name(h.owner), "is_mine": bool(viewer and h.owner_id == viewer.id),
        "created_at": h.created_at, "updated_at": h.updated_at,
    }
    if viewer and (viewer.id == h.owner_id or viewer.is_editor):
        data["reject_reason"] = h.reject_reason
    return data
