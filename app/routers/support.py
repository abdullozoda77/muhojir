from typing import Literal

from fastapi import APIRouter, Request, Response
from pydantic import Field
from sqlalchemy import or_, select

from app.core.crud import add_content_routes
from app.core.deps import DB, AdminUser, CurrentUser, editor_user
from app.core.errors import ApiError
from app.core.pagination import Paginate
from app.db.types import utcnow
from app.models import DocumentType, HelpContact, LegalQuestion, Region
from app.routers.documents import int_param, must_exist, param
from app.schemas.common import Form
from app.services.notify import notify
router = APIRouter(prefix="/api/help", tags=["help"])
Kind = Literal["info", "embassy", "hotline", "lawyer", "mvd_check", "other"]


class ContactIn(Form):
    kind: Kind = "other"
    title: str = Field(max_length=200)
    phone: str = Field("", max_length=30)
    website: str = Field("", max_length=200)
    description: str = ""
    region_id: int | None = Field(None, alias="region")
    order: int = Field(0, ge=0)
    is_active: bool = True


class ContactPatch(ContactIn):
    kind: Kind | None = None
    title: str | None = Field(None, max_length=200)
    is_active: bool | None = None


def contact_json(c):
    return {"id": c.id, "kind": c.kind, "title": c.title, "phone": c.phone, "website": c.website,
            "description": c.description, "region": c.region_id, "region_name": c.region.name if c.region else None,
            "order": c.order, "is_active": c.is_active}


def contacts_query(request, user):
    query = select(HelpContact)
    if not (user and user.is_editor):
        query = query.where(HelpContact.is_active.is_(True))
    if param(request, "kind"):
        query = query.where(HelpContact.kind == param(request, "kind"))
    if (region := int_param(request, "region")) is not None:
        query = query.where(HelpContact.region_id == region)
    if words := param(request, "search"):
        query = query.where(or_(HelpContact.title.ilike(f"%{words}%"), HelpContact.description.ilike(f"%{words}%"),
                                HelpContact.phone.ilike(f"%{words}%")))
    return query.order_by(HelpContact.order, HelpContact.title)


async def check_contact(db, contact, data):
    await must_exist(db, Region, contact.region_id, "region")


add_content_routes(router, "contacts", model=HelpContact, to_json=contact_json, Create=ContactIn, Update=ContactPatch,
                   query=contacts_query, writer=editor_user, check=check_contact)


class QuestionIn(Form):
    document_type_id: int | None = Field(None, alias="document_type")
    question: str = Field(min_length=1)


class AnswerIn(Form):

    answer: str | None = None
    status: Literal["new", "answered", "closed"] | None = None


def question_json(q):
    return {"id": q.id, "document_type": q.document_type_id,
            "document_type_title": q.document_type.title if q.document_type else None, "question": q.question,
            "status": q.status, "answer": q.answer, "answered_at": q.answered_at, "created_at": q.created_at}


def questions_query(user):
    query = select(LegalQuestion).execution_options(populate_existing=True)
    return query if user.is_admin else query.where(LegalQuestion.user_id == user.id)


async def get_question(db, user, question_id):
    question = (await db.execute(questions_query(user).where(LegalQuestion.id == question_id))).unique().scalar_one_or_none()
    if question is None:
        raise ApiError("No LegalQuestion matches the given query.", 404)
    return question


@router.get("/questions/")
async def list_questions(request: Request, db: DB, user: CurrentUser, page: Paginate):
    query = questions_query(user)
    if param(request, "status"):
        query = query.where(LegalQuestion.status == param(request, "status"))
    if (type_id := int_param(request, "document_type")) is not None:
        query = query.where(LegalQuestion.document_type_id == type_id)
    if words := param(request, "search"):
        query = query.where(or_(LegalQuestion.question.ilike(f"%{words}%"), LegalQuestion.answer.ilike(f"%{words}%")))
    return await page.respond(db, query.order_by(LegalQuestion.created_at.desc()), question_json)


@router.post("/questions/", status_code=201)
async def ask_question(data: QuestionIn, db: DB, user: CurrentUser):
    await must_exist(db, DocumentType, data.document_type_id, "document_type")
    question = LegalQuestion(user_id=user.id, **data.model_dump())
    db.add(question)
    await db.commit()
    return question_json(await get_question(db, user, question.id))


@router.get("/questions/{question_id}/")
async def question_detail(question_id: int, db: DB, user: CurrentUser):
    return question_json(await get_question(db, user, question_id))


@router.patch("/questions/{question_id}/")
async def change_question(question_id: int, data: QuestionIn, db: DB, user: CurrentUser):
    question = await get_question(db, user, question_id)
    if question.status != "new":
        raise ApiError("The question already has an answer and can not be changed.", 403)
    await must_exist(db, DocumentType, data.document_type_id, "document_type")
    question.question, question.document_type_id = data.question, data.document_type_id
    await db.commit()
    return question_json(await get_question(db, user, question_id))


@router.delete("/questions/{question_id}/", status_code=204)
async def delete_question(question_id: int, db: DB, user: CurrentUser):
    await db.delete(await get_question(db, user, question_id))
    await db.commit()
    return Response(status_code=204)


async def save_answer(db, question, answer, lawyer):
    question.answer, question.status = answer, "answered"
    question.answered_by_id, question.answered_at = lawyer.id, utcnow()
    await db.commit()
    from app.models import User

    worker = await db.get(User, question.user_id)
    await notify(db, worker, "Ҷавоби ҳуқуқшинос", f"Ба саволи шумо ҷавоб доданд:\n\n{answer}", kind="system")


@router.post("/questions/{question_id}/answer/")
async def answer_question(question_id: int, data: AnswerIn, db: DB, user: AdminUser):
    question = await get_question(db, user, question_id)
    if data.answer:
        await save_answer(db, question, data.answer, user)
    if data.status:
        question.status = data.status
        await db.commit()
    return question_json(await get_question(db, user, question_id))
