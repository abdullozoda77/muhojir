from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, utcnow

AIRLINES = {
    "SZ": "Somon Air", "7J": "Tajik Air", "SU": "Аэрофлот", "FV": "Россия", "U6": "Уральские авиалинии",
    "S7": "S7 Airlines", "DP": "Победа", "UT": "ЮТэйр", "WZ": "Red Wings", "N4": "Nordwind", "ZF": "Azur Air",
    "5N": "Smartavia", "YC": "Ямал", "A4": "Азимут", "IO": "ИрАэро", "HY": "Uzbekistan Airways",
    "KC": "Air Astana", "TK": "Turkish Airlines",
}


class Airport(Base):

    __tablename__ = "airports"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(3), unique=True)
    city_code: Mapped[str] = mapped_column(String(3), index=True)
    city: Mapped[str] = mapped_column(String(100))
    city_tg: Mapped[str] = mapped_column(String(100), default="")
    name: Mapped[str] = mapped_column(String(150))
    country: Mapped[str] = mapped_column(String(2), index=True)
    order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    def __str__(self):
        return f"{self.city} ({self.code})"


class FlightWatch(Base):

    __tablename__ = "flight_watches"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    origin: Mapped[str] = mapped_column(String(3))
    destination: Mapped[str] = mapped_column(String(3))
    month: Mapped[str] = mapped_column(String(7))
    max_price: Mapped[int] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_price: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    user = relationship("User", lazy="joined")

    def __str__(self):
        return f"{self.origin}→{self.destination} {self.month} ≤ {self.max_price}"
