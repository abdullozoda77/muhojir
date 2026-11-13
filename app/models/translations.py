from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, utcnow

LANGUAGES = {"tg": "Тоҷикӣ", "ru": "Русӣ", "en": "English", "zh": "中文"}

DOC_TYPES = {
    "passport": "Шиноснома",
    "birth": "Шаҳодатномаи таваллуд",
    "marriage": "Шаҳодатномаи ақди никоҳ",
    "diploma": "Диплом ё аттестат",
    "license": "Шаҳодатномаи ронандагӣ",
    "contract": "Шартнома",
    "medical": "Маълумотномаи тиббӣ",
    "other": "Ҳуҷҷати дигар",
}

TRANSLATION_KINDS = ("ai", "order")
ORDER_STATUSES = ("new", "priced", "working", "done", "cancelled")


class Translation(Base):

    __tablename__ = "translations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(10), default="ai", index=True)
    source_lang: Mapped[str] = mapped_column(String(5), default="auto")
    target_lang: Mapped[str] = mapped_column(String(5))
    doc_type: Mapped[str] = mapped_column(String(20), default="other")
    file: Mapped[str] = mapped_column(String(100), default="")
    file_name: Mapped[str] = mapped_column(String(200), default="")
    source_text: Mapped[str] = mapped_column(Text, default="")
    result_text: Mapped[str] = mapped_column(Text, default="")
    notarized: Mapped[bool] = mapped_column(Boolean, default=False)
    phone: Mapped[str] = mapped_column(String(30), default="")
    note: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(10), default="new", index=True)
    price: Mapped[int | None] = mapped_column(Integer)
    editor_note: Mapped[str] = mapped_column(Text, default="")
    result_file: Mapped[str] = mapped_column(String(100), default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    user = relationship("User", lazy="joined")

    @property
    def result_upload(self):
        return None

    @property
    def doc_type_label(self):
        return DOC_TYPES.get(self.doc_type, self.doc_type)

    @property
    def direction(self):
        source = LANGUAGES.get(self.source_lang, "Худкор")
        return f"{source} → {LANGUAGES.get(self.target_lang, self.target_lang)}"

    def __str__(self):
        return f"#{self.id} {self.doc_type_label} ({self.direction})"
