from datetime import date, datetime

from sqlalchemy import Date, Float, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.types import UTCDateTime, utcnow

RATE_SOURCES = {"nbt": "Бонки миллии Тоҷикистон", "cbr": "Банки марказии Русия"}


class ExchangeRate(Base):

    __tablename__ = "exchange_rates"
    __table_args__ = (UniqueConstraint("source", "day", name="one_rate_per_source_day"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(10))
    day: Mapped[date] = mapped_column(Date, index=True)
    value: Mapped[float] = mapped_column(Float)
    fetched_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    def __str__(self):
        return f"{self.source} {self.day}: 1 ₽ = {self.value} TJS"
