import re
from datetime import datetime
from urllib.parse import urlsplit

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, utcnow

SCAM_KINDS = {
    "phone": "Рақами телефон",
    "telegram": "Telegram",
    "website": "Сайт",
    "card": "Корти бонкӣ",
    "office": "Идора ё шахс",
    "other": "Дигар",
}

SCAM_SCHEMES = {
    "patent": "Патент ва ҳуҷҷатҳо",
    "job": "Кор",
    "housing": "Манзил",
    "tickets": "Чипта",
    "money": "Интиқоли пул ва қарз",
    "ban": "«Бекор кардани манъ»",
    "other": "Дигар",
}

SCAM_STATUSES = ("pending", "approved", "rejected")


def scam_key(kind, value):
    text = (value or "").strip().lower()
    if kind == "phone":
        digits = re.sub(r"\D", "", text)
        if len(digits) == 11 and digits[0] == "8":
            digits = "7" + digits[1:]
        return digits
    if kind == "card":
        return re.sub(r"\D", "", text)
    if kind == "telegram":
        text = re.sub(r"^(https?://)?(www\.)?(t\.me|telegram\.me)/", "", text)
        return text.lstrip("@").split("/")[0].split("?")[0]
    if kind == "website":
        host = urlsplit(text if "://" in text else f"http://{text}").hostname or text
        return host.removeprefix("www.")
    return re.sub(r"\s+", " ", text)


def search_keys(query):
    text = (query or "").strip()
    keys = {scam_key(kind, text) for kind in SCAM_KINDS}
    return {key for key in keys if len(key) >= 4}


class ScamReport(Base):

    __tablename__ = "scam_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(10))
    value: Mapped[str] = mapped_column(String(200))
    key: Mapped[str] = mapped_column(String(200), index=True)
    scheme: Mapped[str] = mapped_column(String(10), default="other")
    description: Mapped[str] = mapped_column(Text)
    city: Mapped[str] = mapped_column(String(100), default="")
    lost_amount: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(10), default="pending", index=True)
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    user = relationship("User", lazy="joined")

    @property
    def kind_label(self):
        return SCAM_KINDS.get(self.kind, self.kind)

    @property
    def scheme_label(self):
        return SCAM_SCHEMES.get(self.scheme, self.scheme)

    def __str__(self):
        return f"{self.kind_label}: {self.value}"
