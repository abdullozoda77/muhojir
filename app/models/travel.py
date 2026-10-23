from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, utcnow

# Airlines that fly between Tajikistan and Russia, and other common ones in ticket searches (IATA code -> name).
AIRLINES = {
    "SZ": "Somon Air", "7J": "Tajik Air", "SU": "Аэрофлот", "FV": "Россия", "U6": "Уральские авиалинии",
    "S7": "S7 Airlines", "DP": "Победа", "UT": "ЮТэйр", "WZ": "Red Wings", "N4": "Nordwind", "ZF": "Azur Air",
    "5N": "Smartavia", "YC": "Ямал", "A4": "Азимут", "IO": "ИрАэро", "HY": "Uzbekistan Airways",
    "KC": "Air Astana", "TK": "Turkish Airlines",
}


class Airport(Base):
    """An airport in Tajikistan (TJ) or Russia (RU). city_code groups the airports of one city (Moscow: MOW),
    so a search can be "any airport of Moscow"."""

    __tablename__ = "airports"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(3), unique=True)  # IATA, e.g. DYU
    city_code: Mapped[str] = mapped_column(String(3), index=True)  # IATA city, e.g. MOW
    city: Mapped[str] = mapped_column(String(100))  # in Russian
    city_tg: Mapped[str] = mapped_column(String(100), default="")  # in Tajik
    name: Mapped[str] = mapped_column(String(150))
    country: Mapped[str] = mapped_column(String(2), index=True)  # TJ or RU
    order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    def __str__(self):
        return f"{self.city} ({self.code})"


class FlightWatch(Base):
    """"Tell me when a ticket on this route gets cheaper than max_price": checked every day (services/flights.py).
    month is "2026-11"; after that month the watch switches itself off."""

    __tablename__ = "flight_watches"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    origin: Mapped[str] = mapped_column(String(3))
    destination: Mapped[str] = mapped_column(String(3))
    month: Mapped[str] = mapped_column(String(7))
    max_price: Mapped[int] = mapped_column(Integer)  # rubles
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_price: Mapped[int | None] = mapped_column(Integer)  # the cheapest price we told the user about
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    user = relationship("User", lazy="joined")

    def __str__(self):
        return f"{self.origin}→{self.destination} {self.month} ≤ {self.max_price}"
