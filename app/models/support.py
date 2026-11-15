from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, utcnow


class HelpContact(Base):

    __tablename__ = "help_contacts"

    KINDS = ("info", "embassy", "hotline", "lawyer", "mvd_check", "other")

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(20), default="other")
    title: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str] = mapped_column(String(30), default="")
    website: Mapped[str] = mapped_column(String(200), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    title_ru: Mapped[str] = mapped_column(String(200), default="")
    description_ru: Mapped[str] = mapped_column(Text, default="")
    region_id: Mapped[int | None] = mapped_column(ForeignKey("regions.id", ondelete="SET NULL"))
    needs: Mapped[str] = mapped_column(Text, default="", server_default="")
    needs_ru: Mapped[str] = mapped_column(Text, default="", server_default="")
    if_bad: Mapped[str] = mapped_column(Text, default="", server_default="")
    if_bad_ru: Mapped[str] = mapped_column(Text, default="", server_default="")
    documents: Mapped[str] = mapped_column(String(100), default="", server_default="")
    repeat_days: Mapped[int | None] = mapped_column(Integer)
    order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    region = relationship("Region", lazy="joined")

    def __str__(self):
        return self.title


class CheckResult(Base):

    __tablename__ = "check_results"
    __table_args__ = (UniqueConstraint("user_id", "contact_id", name="one_result_per_check"),)

    RESULTS = ("ok", "problem")

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    contact_id: Mapped[int] = mapped_column(ForeignKey("help_contacts.id", ondelete="CASCADE"))
    result: Mapped[str] = mapped_column(String(10))
    checked_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    contact: Mapped[HelpContact] = relationship()
