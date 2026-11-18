from datetime import date, datetime

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, utcnow

PARCEL_KINDS = {
    "carry": "Мебарам",
    "send": "Мефиристам",
}

TJ_CITIES = (
    "Душанбе", "Хуҷанд", "Бохтар", "Кӯлоб", "Истаравшан", "Турсунзода", "Панҷакент", "Хоруғ", "Ваҳдат", "Ҳисор",
    "Конибодом", "Исфара", "Норак", "Данғара", "Ғарм", "Шаҳритус", "Ёвон", "Вахш", "Рашт", "Бӯстон",
)


class Parcel(Base):

    __tablename__ = "parcels"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(10), index=True)
    from_city: Mapped[str] = mapped_column(String(100), index=True)
    to_city: Mapped[str] = mapped_column(String(100), index=True)
    travel_date: Mapped[date] = mapped_column(Date, index=True)
    weight_kg: Mapped[int | None] = mapped_column(Integer)
    price_per_kg: Mapped[int | None] = mapped_column(Integer)
    description: Mapped[str] = mapped_column(Text, default="")
    phone: Mapped[str] = mapped_column(String(16), default="")
    whatsapp: Mapped[str] = mapped_column(String(16), default="")
    telegram: Mapped[str] = mapped_column(String(40), default="")
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)

    user = relationship("User", lazy="joined")

    @property
    def kind_label(self):
        return PARCEL_KINDS.get(self.kind, self.kind)

    def __str__(self):
        return f"{self.kind_label}: {self.from_city} → {self.to_city}, {self.travel_date}"
