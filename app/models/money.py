from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, utcnow

REMITTANCE_SERVICES = {
    "korona": "Золотая Корона",
    "unistream": "Юнистрим",
    "sber": "Сбербанк",
    "alif": "Алиф",
    "contact": "Контакт",
    "card": "Ба корт",
    "hand": "Бо даст / шиносҳо",
    "other": "Дигар",
}


class Remittance(Base):

    __tablename__ = "remittances"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    service: Mapped[str] = mapped_column(String(20), default="other")
    recipient: Mapped[str] = mapped_column(String(100), default="")
    sent_at: Mapped[date] = mapped_column(Date, default=date.today, index=True)
    note: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    user = relationship("User")

    @property
    def service_label(self):
        return REMITTANCE_SERVICES.get(self.service, self.service)

    def __str__(self):
        return f"{self.amount} ₽ · {self.service_label}"
