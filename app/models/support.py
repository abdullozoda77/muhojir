from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, utcnow


class HelpContact(Base):
    """Where a migrant can get help: official sites to read about the patent, the embassy, a hotline, a lawyer,
    or the official MVD check page. Editors add them (with real, checked links)."""

    __tablename__ = "help_contacts"

    KINDS = ("info", "embassy", "hotline", "lawyer", "mvd_check", "other")

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(20), default="other")
    title: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str] = mapped_column(String(30), default="")
    website: Mapped[str] = mapped_column(String(200), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    region_id: Mapped[int | None] = mapped_column(ForeignKey("regions.id", ondelete="SET NULL"))
    order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    region = relationship("Region", lazy="joined")

    def __str__(self):
        return self.title


class LegalQuestion(Base):
    """A worker's question to a lawyer. An admin writes the answer; the worker gets a notification."""

    __tablename__ = "legal_questions"

    STATUSES = ("new", "answered", "closed")

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    document_type_id: Mapped[int | None] = mapped_column(ForeignKey("document_types.id", ondelete="SET NULL"))
    question: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(10), default="new")
    answer: Mapped[str] = mapped_column(Text, default="")
    answered_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    answered_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    user = relationship("User", foreign_keys=[user_id])
    document_type = relationship("DocumentType", lazy="joined")

    def __str__(self):
        return self.question[:60]
