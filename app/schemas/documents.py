from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import Field

from app.schemas.common import Form


def money(value):
    return None if value is None else f"{Decimal(value):.2f}"


def day(value):
    return value.isoformat() if value else None


class DocumentTypeIn(Form):
    slug: str = Field(max_length=50, pattern=r"^[-a-zA-Z0-9_]+$")
    title: str = Field(max_length=150)
    description: str = ""
    default_validity_days: int | None = Field(None, ge=0)
    order: int = Field(0, ge=0)


class DocumentTypePatch(DocumentTypeIn):
    slug: str | None = Field(None, max_length=50, pattern=r"^[-a-zA-Z0-9_]+$")
    title: str | None = Field(None, max_length=150)


def document_type_json(t):
    return {"id": t.id, "slug": t.slug, "title": t.title, "description": t.description,
            "default_validity_days": t.default_validity_days, "order": t.order}


class GuideStepIn(Form):
    document_type_id: int = Field(alias="document_type")
    order: int = Field(ge=0)
    title: str = Field(max_length=200)
    body: str
    required_papers: str = ""
    cost_note: str = Field("", max_length=200)
    deadline_note: str = Field("", max_length=200)
    official_url: str = Field("", max_length=200)
    where: str = Field("", max_length=255)
    example: str = ""


class GuideStepPatch(GuideStepIn):
    document_type_id: int | None = Field(None, alias="document_type")
    order: int | None = Field(None, ge=0)
    title: str | None = Field(None, max_length=200)
    body: str | None = None


def guide_step_json(s):
    return {"id": s.id, "document_type": s.document_type_id, "order": s.order, "title": s.title, "body": s.body,
            "required_papers": s.required_papers, "cost_note": s.cost_note, "deadline_note": s.deadline_note,
            "official_url": s.official_url, "where": s.where, "example": s.example}


class RegionIn(Form):
    name: str = Field(max_length=100)
    patent_monthly_price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    price_year: int = Field(ge=2000, le=2100)


class RegionPatch(RegionIn):
    name: str | None = Field(None, max_length=100)
    patent_monthly_price: Decimal | None = Field(None, ge=0, max_digits=10, decimal_places=2)
    price_year: int | None = Field(None, ge=2000, le=2100)


def region_json(r):
    return {"id": r.id, "name": r.name, "patent_monthly_price": money(r.patent_monthly_price), "price_year": r.price_year}


class CenterIn(Form):
    region_id: int | None = Field(None, alias="region")
    name: str = Field(max_length=200)
    address: str = Field(max_length=255)
    working_hours: str = Field("", max_length=100)
    phone: str = Field("", max_length=30)
    website: str = Field("", max_length=200)
    order: int = Field(0, ge=0)


class CenterPatch(CenterIn):
    name: str | None = Field(None, max_length=200)
    address: str | None = Field(None, max_length=255)


def center_json(c):
    return {"id": c.id, "region": c.region_id, "region_name": c.region.name if c.region else None, "name": c.name,
            "address": c.address, "working_hours": c.working_hours, "phone": c.phone, "website": c.website, "order": c.order}


class NewsIn(Form):
    title: str = Field(max_length=255)
    summary: str = Field(max_length=500)
    body: str
    source_url: str = Field("", max_length=200)
    document_types: list[int] = []
    is_published: bool = False
    published_at: datetime | None = None


class NewsPatch(NewsIn):
    title: str | None = Field(None, max_length=255)
    summary: str | None = Field(None, max_length=500)
    body: str | None = None
    document_types: list[int] | None = None
    is_published: bool | None = None


def news_json(n):
    return {"id": n.id, "title": n.title, "summary": n.summary, "body": n.body, "source_url": n.source_url,
            "document_types": sorted(t.id for t in n.document_types), "is_published": n.is_published,
            "published_at": n.published_at, "created_at": n.created_at}


class ExamQuestionIn(Form):
    section: Literal["language", "history", "law"]
    question: str = Field(max_length=500)
    listen_text: str = ""
    options: list[str]
    answer: int = Field(ge=0)
    explanation: str = ""
    is_active: bool = True
    order: int = Field(0, ge=0)


class ExamQuestionPatch(ExamQuestionIn):
    section: Literal["language", "history", "law"] | None = None
    question: str | None = Field(None, max_length=500)
    options: list[str] | None = None
    answer: int | None = Field(None, ge=0)
    is_active: bool | None = None


def exam_question_json(q):
    return {"id": q.id, "section": q.section, "question": q.question, "listen_text": q.listen_text, "options": q.options,
            "answer": q.answer, "explanation": q.explanation, "is_active": q.is_active, "order": q.order}


class UserDocumentIn(Form):
    document_type_id: int = Field(alias="document_type")
    region_id: int | None = Field(None, alias="region")
    number: str = Field("", max_length=50)
    issued_at: date | None = None
    expires_at: date
    note: str = Field("", max_length=255)
    remind_days_before: Literal[30, 14, 7, 3, 1] = 7


class UserDocumentPatch(UserDocumentIn):
    document_type_id: int | None = Field(None, alias="document_type")
    expires_at: date | None = None
    remind_days_before: Literal[30, 14, 7, 3, 1] | None = None


def user_document_json(d):
    return {
        "id": d.id, "document_type": d.document_type_id, "document_type_title": d.document_type.title,
        "region": d.region_id, "region_name": d.region.name if d.region else None, "number": d.number,
        "issued_at": day(d.issued_at), "expires_at": day(d.expires_at), "note": d.note,
        "remind_days_before": d.remind_days_before, "has_photo": bool(d.photo), "days_left": d.days_left,
        "status": d.status, "created_at": d.created_at, "updated_at": d.updated_at,
    }


def payment_json(p):
    return {
        "id": p.id, "document": p.document_id, "document_title": p.document.document_type.title,
        "document_expires_at": day(p.document.expires_at), "months": p.months, "amount": money(p.amount),
        "paid_at": day(p.paid_at), "has_receipt": bool(p.receipt), "note": p.note, "created_at": p.created_at,
    }
