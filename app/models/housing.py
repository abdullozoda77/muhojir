from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, utcnow

HOUSING_KINDS = {
    "bed": "Ҷойи хоб",
    "room": "Ҳуҷра",
    "flat": "Хонаи пурра",
    "hostel": "Хостел",
}

HOUSING_FOR = {
    "any": "Ба ҳама",
    "men": "Танҳо мардон",
    "women": "Танҳо занон",
    "family": "Барои оила",
}

HOUSING_PERIODS = ("month", "day")

HOUSING_STATUSES = ("pending", "approved", "rejected")


class Housing(Base):

    __tablename__ = "housing"
    __table_args__ = (Index("ix_housing_status_city", "status", "city"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    source: Mapped[str] = mapped_column(String(20), default="user", index=True)
    source_name: Mapped[str] = mapped_column(String(120), default="")
    source_url: Mapped[str] = mapped_column(String(300), default="")
    external_id: Mapped[str | None] = mapped_column(String(120), unique=True, index=True)
    fingerprint: Mapped[str] = mapped_column(String(40), default="", index=True)
    kind: Mapped[str] = mapped_column(String(10), index=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    city: Mapped[str] = mapped_column(String(100))
    address: Mapped[str] = mapped_column(String(255), default="")
    metro: Mapped[str] = mapped_column(String(100), default="")
    price: Mapped[int] = mapped_column(Integer, index=True)
    period: Mapped[str] = mapped_column(String(10), default="month")
    rooms: Mapped[int | None] = mapped_column(Integer)
    places: Mapped[int | None] = mapped_column(Integer)
    for_whom: Mapped[str] = mapped_column(String(10), default="any")
    registration: Mapped[bool] = mapped_column(Boolean, default=False)
    utilities_included: Mapped[bool] = mapped_column(Boolean, default=False)
    no_deposit: Mapped[bool] = mapped_column(Boolean, default=False)
    phone: Mapped[str] = mapped_column(String(16), default="")
    whatsapp: Mapped[str] = mapped_column(String(16), default="")
    telegram: Mapped[str] = mapped_column(String(40), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String(10), default="pending", index=True)
    reject_reason: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    owner = relationship("User", lazy="joined")
    photos = relationship("HousingPhoto", lazy="selectin", order_by="HousingPhoto.id", cascade="all, delete-orphan",
                          passive_deletes=True)

    @property
    def kind_label(self):
        return HOUSING_KINDS.get(self.kind, self.kind)

    @property
    def for_whom_label(self):
        return HOUSING_FOR.get(self.for_whom, self.for_whom)

    def __str__(self):
        return self.title


class HousingPhoto(Base):

    __tablename__ = "housing_photos"

    id: Mapped[int] = mapped_column(primary_key=True)
    housing_id: Mapped[int] = mapped_column(ForeignKey("housing.id", ondelete="CASCADE"), index=True)
    file: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
