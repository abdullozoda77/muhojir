from typing import Literal

from pydantic import Field

from app.models.jobs import INDUSTRIES
from app.schemas.common import Form

Industry = Literal[tuple(INDUSTRIES)]


def employer_short_json(e):
    return {"id": e.id, "name": e.name, "city": e.city, "website": e.website, "is_verified": e.is_verified,
            "is_blacklisted": e.is_blacklisted, "source": e.source}


def employer_json(e):
    return {"id": e.id, "name": e.name, "inn": e.inn, "city": e.city, "description": e.description, "website": e.website,
            "source": e.source, "is_verified": e.is_verified, "verified_at": e.verified_at,
            "is_blacklisted": e.is_blacklisted, "blacklist_reason": e.blacklist_reason, "created_at": e.created_at}


def job_json(job, is_saved=False):
    return {
        "id": job.id, "employer": employer_short_json(job.employer), "title": job.title, "description": job.description,
        "industry": job.industry, "industry_label": job.industry_label, "city": job.city, "address": job.address,
        "salary_from": job.salary_from, "salary_to": job.salary_to, "salary_period": job.salary_period,
        "schedule": job.schedule, "housing_provided": job.housing_provided, "meals_provided": job.meals_provided,
        "helps_with_documents": job.helps_with_documents, "is_active": job.is_active, "expires_at": job.expires_at,
        "source": job.source, "external_url": job.external_url, "is_saved": bool(is_saved),
        "created_at": job.created_at, "updated_at": job.updated_at,
    }


def review_json(review, viewer=None):
    # Only the first name: workers are afraid of employers finding out who complained.
    name = (review.author.full_name or "").split() if review.author else []
    return {
        "id": review.id, "employer": review.employer_id, "author_name": name[0] if name else "Корбар",
        # Lets the site show edit/delete on the viewer's own review without revealing who wrote the others.
        "is_mine": bool(viewer and review.author_id == viewer.id), "rating": review.rating, "text": review.text,
        "salary_not_paid": review.salary_not_paid, "created_at": review.created_at,
    }


class ReviewIn(Form):
    employer: int
    rating: int = Field(ge=1, le=5)
    text: str = ""
    salary_not_paid: bool = False


class ReviewPatch(Form):
    employer: int | None = None
    rating: int | None = Field(None, ge=1, le=5)
    text: str | None = None
    salary_not_paid: bool | None = None


class AlertIn(Form):
    search: str = Field("", max_length=100)
    city: str = Field("", max_length=100)
    industry: Industry | Literal[""] = ""
    min_salary: int | None = Field(None, ge=0)
    housing_provided: bool = False
    is_active: bool = True


class AlertPatch(Form):
    search: str | None = Field(None, max_length=100)
    city: str | None = Field(None, max_length=100)
    industry: Industry | Literal[""] | None = None
    min_salary: int | None = Field(None, ge=0)
    housing_provided: bool | None = None
    is_active: bool | None = None


def alert_json(a):
    return {"id": a.id, "search": a.search, "city": a.city, "industry": a.industry, "industry_label": a.industry_label,
            "min_salary": a.min_salary, "housing_provided": a.housing_provided, "is_active": a.is_active,
            "created_at": a.created_at}
