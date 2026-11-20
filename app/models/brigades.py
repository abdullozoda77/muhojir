from datetime import date, datetime

from sqlalchemy import Boolean, Date, ForeignKey, Integer, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, utcnow

BRIGADE_TRADES = {
    "repair": "Таъмири хона",
    "build": "Сохтмон",
    "tile": "Кафелгузорӣ",
    "plumbing": "Сантехника",
    "electric": "Барқ (электрик)",
    "welding": "Кафшеркорӣ",
    "roof": "Бом",
    "facade": "Фасад ва девор",
    "paint": "Рангубор ва гаҷкорӣ",
    "cleaning": "Тозакунӣ",
    "movers": "Боркашонӣ",
    "garden": "Ҳавлӣ ва боғ",
    "other": "Дигар",
}

BRIGADE_MEMBER_STATUSES = {"pending": "Интизор", "accepted": "Аъзо"}

BRIGADE_ORDER_STATUSES = {
    "new": "Нав",
    "accepted": "Қабул шуд",
    "declined": "Рад шуд",
    "done": "Иҷро шуд",
}


class Brigade(Base):

    __tablename__ = "brigades"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    trade: Mapped[str] = mapped_column(String(20), index=True)
    city: Mapped[str] = mapped_column(String(100), index=True)
    size: Mapped[int] = mapped_column(Integer, default=2)
    experience_years: Mapped[int | None] = mapped_column(Integer)
    price_note: Mapped[str] = mapped_column(String(120), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    phone: Mapped[str] = mapped_column(String(16), default="")
    whatsapp: Mapped[str] = mapped_column(String(16), default="")
    telegram: Mapped[str] = mapped_column(String(40), default="")
    is_free: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)

    user = relationship("User", lazy="joined")

    @property
    def trade_label(self):
        return BRIGADE_TRADES.get(self.trade, self.trade)

    def __str__(self):
        return f"{self.name} ({self.city})"


class BrigadeMember(Base):

    __tablename__ = "brigade_members"
    __table_args__ = (UniqueConstraint("brigade_id", "user_id", name="uq_brigade_member"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    brigade_id: Mapped[int] = mapped_column(ForeignKey("brigades.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    skill: Mapped[str] = mapped_column(String(80), default="")
    status: Mapped[str] = mapped_column(String(10), default="pending", index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    user = relationship("User", lazy="joined")
    brigade = relationship("Brigade", lazy="joined")

    def __str__(self):
        return f"{self.user} → {self.brigade}"


class BrigadeOrder(Base):

    __tablename__ = "brigade_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    brigade_id: Mapped[int] = mapped_column(ForeignKey("brigades.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    city: Mapped[str] = mapped_column(String(100), default="")
    description: Mapped[str] = mapped_column(Text)
    start_date: Mapped[date | None] = mapped_column(Date)
    workers: Mapped[int | None] = mapped_column(Integer)
    budget: Mapped[int | None] = mapped_column(Integer)
    phone: Mapped[str] = mapped_column(String(16), default="")
    status: Mapped[str] = mapped_column(String(10), default="new", index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)

    user = relationship("User", lazy="joined")
    brigade = relationship("Brigade", lazy="joined")

    @property
    def status_label(self):
        return BRIGADE_ORDER_STATUSES.get(self.status, self.status)

    def __str__(self):
        return f"#{self.id} → {self.brigade}"


class BrigadeReview(Base):

    __tablename__ = "brigade_reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    brigade_id: Mapped[int] = mapped_column(ForeignKey("brigades.id", ondelete="CASCADE"), index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("brigade_orders.id", ondelete="CASCADE"), unique=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    rating: Mapped[int] = mapped_column(SmallInteger)
    text: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)

    user = relationship("User", lazy="joined")
    brigade = relationship("Brigade", lazy="joined")

    def __str__(self):
        return f"{self.rating}★ {self.brigade}"
