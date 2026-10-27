from datetime import datetime

from sqlalchemy import Boolean, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, utcnow

SHOP_CATEGORIES = {
    "grocery": "Озуқаворӣ",
    "meat": "Гӯшти ҳалол",
    "bakery": "Нон ва самбӯса",
    "sweets": "Меваи хушк ва ширинӣ",
    "cafe": "Ошхона ва таом",
    "clothes": "Либос ва матоъ",
    "home": "Зарфу асбоби рӯзгор",
    "other": "Дигар",
}

SHOP_ORIGINS = {
    "tj": "Тоҷикӣ",
    "uz": "Ӯзбекӣ",
    "mixed": "Тоҷикӣ ва ӯзбекӣ",
}

SHOP_STATUSES = ("pending", "approved", "rejected")

PRODUCT_UNITS = ("dona", "kg", "litr", "bandcha", "qutti", "portion")


class Shop(Base):

    __tablename__ = "shops"
    __table_args__ = (Index("ix_shops_status_city", "status", "city"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(20), index=True)
    origin: Mapped[str] = mapped_column(String(10), default="tj")
    description: Mapped[str] = mapped_column(Text, default="")
    city: Mapped[str] = mapped_column(String(100))
    address: Mapped[str] = mapped_column(String(255), default="")
    lat: Mapped[float | None] = mapped_column(Float)
    lon: Mapped[float | None] = mapped_column(Float)
    phone: Mapped[str] = mapped_column(String(16), default="")
    whatsapp: Mapped[str] = mapped_column(String(16), default="")
    telegram: Mapped[str] = mapped_column(String(40), default="")
    opening_hours: Mapped[str] = mapped_column(String(120), default="")
    delivery: Mapped[bool] = mapped_column(Boolean, default=False)
    logo: Mapped[str] = mapped_column(String(100), default="")
    status: Mapped[str] = mapped_column(String(10), default="pending", index=True)
    reject_reason: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    owner = relationship("User", lazy="joined")

    @property
    def category_label(self):
        return SHOP_CATEGORIES.get(self.category, self.category)

    @property
    def origin_label(self):
        return SHOP_ORIGINS.get(self.origin, self.origin)

    def __str__(self):
        return self.name


class Product(Base):

    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    shop_id: Mapped[int] = mapped_column(ForeignKey("shops.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    price: Mapped[int] = mapped_column(Integer)
    unit: Mapped[str] = mapped_column(String(10), default="dona")
    photo: Mapped[str] = mapped_column(String(100), default="")
    in_stock: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    shop: Mapped[Shop] = relationship(lazy="joined")

    def __str__(self):
        return self.name


class ShopReview(Base):

    __tablename__ = "shop_reviews"
    __table_args__ = (UniqueConstraint("shop_id", "author_id", name="one_review_per_shop"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    shop_id: Mapped[int] = mapped_column(ForeignKey("shops.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    rating: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    shop: Mapped[Shop] = relationship()
    author = relationship("User", lazy="joined")
