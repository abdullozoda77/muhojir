import calendar
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON, Boolean, Column, Date, ForeignKey, Integer, Numeric, String, Table, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import REMINDER_DAYS
from app.db.base import Base
from app.db.types import UTCDateTime, utcnow


def add_months(day, months):
    month_index = day.month - 1 + months
    year, month = day.year + month_index // 12, month_index % 12 + 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


class DocumentType(Base):

    __tablename__ = "document_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(50), unique=True)
    title: Mapped[str] = mapped_column(String(150))
    description: Mapped[str] = mapped_column(Text, default="")
    default_validity_days: Mapped[int | None] = mapped_column(Integer)
    order: Mapped[int] = mapped_column(Integer, default=0)

    steps: Mapped[list["GuideStep"]] = relationship(back_populates="document_type", cascade="all, delete-orphan", order_by="GuideStep.order")

    def __str__(self):
        return self.title


class GuideStep(Base):

    __tablename__ = "guide_steps"
    __table_args__ = (UniqueConstraint("document_type_id", "order", name="unique_step_order"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    document_type_id: Mapped[int] = mapped_column(ForeignKey("document_types.id", ondelete="CASCADE"), index=True)
    order: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    required_papers: Mapped[str] = mapped_column(Text, default="")
    cost_note: Mapped[str] = mapped_column(String(200), default="")
    deadline_note: Mapped[str] = mapped_column(String(200), default="")
    official_url: Mapped[str] = mapped_column(String(200), default="")
    where: Mapped[str] = mapped_column(String(255), default="")
    example: Mapped[str] = mapped_column(Text, default="")

    document_type: Mapped[DocumentType] = relationship(back_populates="steps")

    def __str__(self):
        return f"{self.order}. {self.title}"


class Region(Base):

    __tablename__ = "regions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    patent_monthly_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    price_year: Mapped[int] = mapped_column(Integer)

    def __str__(self):
        return self.name


class UserDocument(Base):

    __tablename__ = "user_documents"

    REMIND_CHOICES = (30, 14, 7, 3, 1)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    document_type_id: Mapped[int] = mapped_column(ForeignKey("document_types.id", ondelete="RESTRICT"))
    region_id: Mapped[int | None] = mapped_column(ForeignKey("regions.id", ondelete="SET NULL"))
    number: Mapped[str] = mapped_column(String(50), default="")
    issued_at: Mapped[date | None] = mapped_column(Date)
    expires_at: Mapped[date] = mapped_column(Date, index=True)
    note: Mapped[str] = mapped_column(String(255), default="")
    remind_days_before: Mapped[int] = mapped_column(Integer, default=7)
    photo: Mapped[str] = mapped_column(String(100), default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    user = relationship("User")
    document_type: Mapped[DocumentType] = relationship(lazy="joined")
    region: Mapped[Region | None] = relationship(lazy="joined")

    @property
    def days_left(self):
        return (self.expires_at - date.today()).days

    @property
    def status(self):
        days = self.days_left
        if days < 0:
            return "expired"
        if days <= max(REMINDER_DAYS):
            return "expiring"
        return "valid"

    def __str__(self):
        return f"{self.document_type} — {self.expires_at}"


class Payment(Base):

    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("user_documents.id", ondelete="CASCADE"), index=True)
    months: Mapped[int] = mapped_column(Integer, default=1)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    paid_at: Mapped[date] = mapped_column(Date, default=date.today)
    receipt: Mapped[str] = mapped_column(String(100), default="")
    note: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    user = relationship("User")
    document: Mapped[UserDocument] = relationship(lazy="joined")

    def __str__(self):
        return f"{self.amount} ₽ ({self.months} mo.)"


class MigrationCenter(Base):

    __tablename__ = "migration_centers"

    id: Mapped[int] = mapped_column(primary_key=True)
    region_id: Mapped[int | None] = mapped_column(ForeignKey("regions.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(200))
    address: Mapped[str] = mapped_column(String(255))
    working_hours: Mapped[str] = mapped_column(String(100), default="")
    phone: Mapped[str] = mapped_column(String(30), default="")
    website: Mapped[str] = mapped_column(String(200), default="")
    order: Mapped[int] = mapped_column(Integer, default=0)

    region: Mapped[Region | None] = relationship(lazy="joined")

    def __str__(self):
        return self.name


class ReminderLog(Base):

    __tablename__ = "reminder_logs"
    __table_args__ = (UniqueConstraint("user_document_id", "expires_at", "days_before", name="unique_reminder"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_document_id: Mapped[int] = mapped_column(ForeignKey("user_documents.id", ondelete="CASCADE"))
    expires_at: Mapped[date] = mapped_column(Date)
    days_before: Mapped[int] = mapped_column(Integer)
    sent_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    user_document = relationship("UserDocument")


law_news_document_types = Table(
    "law_news_document_types",
    Base.metadata,
    Column("law_news_id", ForeignKey("law_news.id", ondelete="CASCADE"), primary_key=True),
    Column("document_type_id", ForeignKey("document_types.id", ondelete="CASCADE"), primary_key=True),
)


class LawNews(Base):

    __tablename__ = "law_news"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    summary: Mapped[str] = mapped_column(String(500))
    body: Mapped[str] = mapped_column(Text)
    source_url: Mapped[str] = mapped_column(String(200), default="")
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    published_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    document_types: Mapped[list[DocumentType]] = relationship(secondary=law_news_document_types, lazy="selectin")

    def __str__(self):
        return self.title


class ExamQuestion(Base):

    __tablename__ = "exam_questions"

    SECTIONS = ("language", "history", "law")

    id: Mapped[int] = mapped_column(primary_key=True)
    section: Mapped[str] = mapped_column(String(20))
    question: Mapped[str] = mapped_column(String(500))
    listen_text: Mapped[str] = mapped_column(Text, default="")
    options: Mapped[list] = mapped_column(JSON)
    answer: Mapped[int] = mapped_column(Integer)
    explanation: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    order: Mapped[int] = mapped_column(Integer, default=0)

    def __str__(self):
        return self.question[:60]
