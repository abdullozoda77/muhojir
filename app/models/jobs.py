from datetime import datetime, timedelta

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, utcnow

INDUSTRIES = {
    "construction": "Сохтмон",
    "warehouse": "Анбор",
    "delivery": "Расонидан",
    "taxi": "Таксӣ ва ронандагӣ",
    "trade": "Савдо",
    "food": "Ошхона ва қаҳвахона",
    "cleaning": "Тозакунӣ",
    "agriculture": "Кишоварзӣ",
    "manufacturing": "Истеҳсолот",
    "other": "Дигар",
}

SOURCES = ("trudvsem",)


def default_job_expiry():
    return utcnow() + timedelta(days=30)


class Employer(Base):

    __tablename__ = "employers"

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(20), default="trudvsem")
    external_id: Mapped[str | None] = mapped_column(String(40), unique=True)
    website: Mapped[str] = mapped_column(String(200), default="")
    name: Mapped[str] = mapped_column(String(200))
    inn: Mapped[str] = mapped_column(String(12), default="")
    city: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text, default="")
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verified_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    is_blacklisted: Mapped[bool] = mapped_column(Boolean, default=False)
    blacklist_reason: Mapped[str] = mapped_column(Text, default="")
    reports_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    def __str__(self):
        return self.name


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (Index("ix_jobs_city_industry", "city", "industry"),)

    PERIODS = ("month", "day", "hour")

    id: Mapped[int] = mapped_column(primary_key=True)
    employer_id: Mapped[int] = mapped_column(ForeignKey("employers.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    industry: Mapped[str] = mapped_column(String(20))
    city: Mapped[str] = mapped_column(String(100))
    address: Mapped[str] = mapped_column(String(255), default="")
    salary_from: Mapped[int | None] = mapped_column(Integer)
    salary_to: Mapped[int | None] = mapped_column(Integer)
    salary_period: Mapped[str] = mapped_column(String(10), default="month")
    schedule: Mapped[str] = mapped_column(String(100), default="")
    housing_provided: Mapped[bool] = mapped_column(Boolean, default=False)
    meals_provided: Mapped[bool] = mapped_column(Boolean, default=False)
    helps_with_documents: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime, default=default_job_expiry)
    source: Mapped[str] = mapped_column(String(20), default="trudvsem", index=True)
    external_id: Mapped[str | None] = mapped_column(String(60), unique=True)
    external_url: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    employer: Mapped[Employer] = relationship(lazy="joined")

    @property
    def industry_label(self):
        return INDUSTRIES.get(self.industry, self.industry)

    def __str__(self):
        return self.title


class EmployerReview(Base):

    __tablename__ = "employer_reviews"
    __table_args__ = (UniqueConstraint("employer_id", "author_id", name="one_review_per_employer"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    employer_id: Mapped[int] = mapped_column(ForeignKey("employers.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    rating: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text, default="")
    salary_not_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    employer: Mapped[Employer] = relationship()
    author = relationship("User", lazy="joined")


class BlacklistReport(Base):

    __tablename__ = "blacklist_reports"
    __table_args__ = (UniqueConstraint("employer_id", "author_id", name="one_report_per_employer"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    employer_id: Mapped[int] = mapped_column(ForeignKey("employers.id", ondelete="CASCADE"), index=True)
    job_id: Mapped[int | None] = mapped_column(ForeignKey("jobs.id", ondelete="SET NULL"))
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)

    employer: Mapped[Employer] = relationship()
    job: Mapped[Job | None] = relationship(lazy="joined")
    author = relationship("User", lazy="joined")

    def __str__(self):
        return self.reason[:60]


class SavedJob(Base):

    __tablename__ = "saved_jobs"
    __table_args__ = (UniqueConstraint("user_id", "job_id", name="one_save_per_job"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    user = relationship("User")
    job: Mapped[Job] = relationship()


class JobAlert(Base):

    __tablename__ = "job_alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    search: Mapped[str] = mapped_column(String(100), default="")
    city: Mapped[str] = mapped_column(String(100), default="")
    industry: Mapped[str] = mapped_column(String(20), default="")
    min_salary: Mapped[int | None] = mapped_column(Integer)
    housing_provided: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    user = relationship("User", lazy="joined")

    @property
    def industry_label(self):
        return INDUSTRIES.get(self.industry, "")
