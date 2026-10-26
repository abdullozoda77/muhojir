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

# Where a job ad comes from. All jobs are imported from «Работа России» (trudvsem.ru, the state job portal
# whose ads are open data); people apply on the source site (Job.external_url).
SOURCES = ("trudvsem",)


def default_job_expiry():
    return utcnow() + timedelta(days=30)


class Employer(Base):
    """The company of imported job ads, found again by its code on the source site (external_id).
    Admins verify real companies and put the ones that don't pay wages on the blacklist."""

    __tablename__ = "employers"

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(20), default="trudvsem")
    external_id: Mapped[str | None] = mapped_column(String(40), unique=True)
    website: Mapped[str] = mapped_column(String(200), default="")
    name: Mapped[str] = mapped_column(String(200))
    inn: Mapped[str] = mapped_column(String(12), default="")  # Russian tax number, checked by admins when verifying
    city: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text, default="")
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verified_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    is_blacklisted: Mapped[bool] = mapped_column(Boolean, default=False)
    blacklist_reason: Mapped[str] = mapped_column(Text, default="")
    # How many workers put the company on the blacklist themselves (BlacklistReport), kept here for the job lists.
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
    salary_from: Mapped[int | None] = mapped_column(Integer)  # rubles
    salary_to: Mapped[int | None] = mapped_column(Integer)
    salary_period: Mapped[str] = mapped_column(String(10), default="month")
    schedule: Mapped[str] = mapped_column(String(100), default="")  # e.g. "6/1, 10 hours"
    housing_provided: Mapped[bool] = mapped_column(Boolean, default=False)
    meals_provided: Mapped[bool] = mapped_column(Boolean, default=False)
    helps_with_documents: Mapped[bool] = mapped_column(Boolean, default=False)  # helps to get the patent
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime, default=default_job_expiry)
    # Where the ad came from, its id there, and the page where people apply.
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
    """A worker's review of an employer. salary_not_paid marks complaints that feed the blacklist."""

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
    """A worker puts a job's company on the blacklist, with the reason. Everyone sees the reports at once; the jobs
    stay visible with a warning. Admins check them and may blacklist the company for real (Employer.is_blacklisted
    hides its jobs) or delete a false report."""

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
    """A job the user saved to look at later."""

    __tablename__ = "saved_jobs"
    __table_args__ = (UniqueConstraint("user_id", "job_id", name="one_save_per_job"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    user = relationship("User")
    job: Mapped[Job] = relationship()


class JobAlert(Base):
    """"Tell me about new jobs like these": the filters of the jobs page, kept. After each import the user gets
    one notification with the new jobs that match (see services/alerts.py). Empty fields mean "any"."""

    __tablename__ = "job_alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    search: Mapped[str] = mapped_column(String(100), default="")
    city: Mapped[str] = mapped_column(String(100), default="")
    industry: Mapped[str] = mapped_column(String(20), default="")
    min_salary: Mapped[int | None] = mapped_column(Integer)
    housing_provided: Mapped[bool] = mapped_column(Boolean, default=False)  # only jobs with housing
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    user = relationship("User", lazy="joined")

    @property
    def industry_label(self):
        return INDUSTRIES.get(self.industry, "")
