"""/api/documents/: document types and their guides, patent prices by region, migration centers, law news and
exam questions (everyone reads, editors change); and the user's own documents and payments (only their own)."""
from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, File, Form, Request, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import or_, select

from app.core.crud import add_content_routes, apply_ordering
from app.core.deps import DB, CurrentUser, admin_user, editor_user
from app.core.errors import ApiError, FieldError
from app.core.files import delete_private, private_path, save_private
from app.core.pagination import Paginate
from app.db.types import utcnow
from app.models import (
    DocumentType, ExamQuestion, GuideStep, LawNews, MigrationCenter, Payment, Region, UserDocument, add_months,
    law_news_document_types,
)
from app.schemas import documents as s

router = APIRouter(prefix="/api/documents", tags=["documents"])


def param(request, name):
    return request.query_params.get(name) if request else None


def int_param(request, name):
    value = param(request, name)
    if value in (None, ""):
        return None
    try:
        return int(value)
    except ValueError:
        raise FieldError(name, "Введите правильное число.")


def search(query, request, *columns):
    """?search=words in any of these columns, case does not matter (Cyrillic too)."""
    words = param(request, "search")
    return query.where(or_(*(c.ilike(f"%{words}%") for c in columns))) if words else query


def not_found(name, value):
    return f"Недопустимый первичный ключ \"{value}\" - объект не существует."


async def must_exist(db, model, value, field):
    if value is not None and await db.get(model, value) is None:
        raise FieldError(field, not_found(model.__name__, value))


# --- Document types: admins change them (the site's pages depend on their slugs) ---------------------------------

def document_types_query(request, user):
    query = select(DocumentType)
    if param(request, "slug"):
        query = query.where(DocumentType.slug == param(request, "slug"))
    query = search(query, request, DocumentType.title, DocumentType.description)
    return query.order_by(DocumentType.order, DocumentType.title)


add_content_routes(router, "document-types", model=DocumentType, to_json=s.document_type_json,
                   Create=s.DocumentTypeIn, Update=s.DocumentTypePatch, query=document_types_query, writer=admin_user)


# --- Guide steps ----------------------------------------------------------------------------------------------

def guide_steps_query(request, user):
    query = select(GuideStep)
    if (type_id := int_param(request, "document_type")) is not None:
        query = query.where(GuideStep.document_type_id == type_id)
    query = search(query, request, GuideStep.title, GuideStep.body, GuideStep.required_papers)
    return query.order_by(GuideStep.document_type_id, GuideStep.order)


async def check_step(db, step, data):
    await must_exist(db, DocumentType, step.document_type_id, "document_type")


add_content_routes(router, "guide-steps", model=GuideStep, to_json=s.guide_step_json, Create=s.GuideStepIn,
                   Update=s.GuideStepPatch, query=guide_steps_query, writer=editor_user, check=check_step)


# --- Regions (patent prices) -----------------------------------------------------------------------------------

def regions_query(request, user):
    query = select(Region)
    if (year := int_param(request, "price_year")) is not None:
        query = query.where(Region.price_year == year)
    if param(request, "min_price"):
        query = query.where(Region.patent_monthly_price >= Decimal(param(request, "min_price")))
    if param(request, "max_price"):
        query = query.where(Region.patent_monthly_price <= Decimal(param(request, "max_price")))
    query = search(query, request, Region.name)
    return query.order_by(Region.name)


add_content_routes(router, "regions", model=Region, to_json=s.region_json, Create=s.RegionIn, Update=s.RegionPatch,
                   query=regions_query, writer=editor_user)


# --- Migration centers -----------------------------------------------------------------------------------------

def centers_query(request, user):
    query = select(MigrationCenter)
    if (region := int_param(request, "region")) is not None:
        query = query.where(MigrationCenter.region_id == region)
    query = search(query, request, MigrationCenter.name, MigrationCenter.address)
    return query.order_by(MigrationCenter.order, MigrationCenter.name)


async def check_center(db, center, data):
    await must_exist(db, Region, center.region_id, "region")


add_content_routes(router, "centers", model=MigrationCenter, to_json=s.center_json, Create=s.CenterIn,
                   Update=s.CenterPatch, query=centers_query, writer=editor_user, check=check_center)


# --- Law news: guests see the published ones, editors all ------------------------------------------------------

def news_query(request, user):
    query = select(LawNews)
    if not (user and user.is_editor):
        query = query.where(LawNews.is_published.is_(True))
    if (type_id := int_param(request, "document_type")) is not None:
        query = query.where(LawNews.id.in_(
            select(law_news_document_types.c.law_news_id).where(law_news_document_types.c.document_type_id == type_id)
        ))
    query = search(query, request, LawNews.title, LawNews.summary, LawNews.body)
    return query.order_by(LawNews.published_at.desc().nulls_last(), LawNews.created_at.desc())


async def check_news(db, news, data):
    if data.document_types is not None:
        types = []
        for type_id in data.document_types:
            item = await db.get(DocumentType, type_id)
            if item is None:
                raise FieldError("document_types", not_found("DocumentType", type_id))
            types.append(item)
        await db.refresh(news, ["document_types"])
        news.document_types = types


def news_before_save(news, data, user, created):
    if created:
        news.created_by_id = user.id
    if news.is_published and not news.published_at:
        news.published_at = utcnow()


add_content_routes(router, "news", model=LawNews, to_json=s.news_json, Create=s.NewsIn, Update=s.NewsPatch,
                   query=news_query, writer=editor_user, check=check_news, before_save=news_before_save)


# --- Exam questions: guests see the active ones ----------------------------------------------------------------

def exam_query(request, user):
    query = select(ExamQuestion)
    if not (user and user.is_editor):
        query = query.where(ExamQuestion.is_active.is_(True))
    if param(request, "section"):
        query = query.where(ExamQuestion.section == param(request, "section"))
    query = search(query, request, ExamQuestion.question)
    return query.order_by(ExamQuestion.section, ExamQuestion.order, ExamQuestion.id)


async def check_question(db, question, data):
    options = question.options
    if not isinstance(options, list) or len(options) < 2 or not all(isinstance(o, str) and o for o in options):
        raise FieldError("options", "Give at least two answers.")
    if question.answer is not None and question.answer >= len(options):
        raise FieldError("answer", "The right answer must be one of the options.")


add_content_routes(router, "exam-questions", model=ExamQuestion, to_json=s.exam_question_json,
                   Create=s.ExamQuestionIn, Update=s.ExamQuestionPatch, query=exam_query, writer=editor_user,
                   check=check_question)


# --- My documents ----------------------------------------------------------------------------------------------

def my_documents(user):
    return select(UserDocument).where(UserDocument.user_id == user.id)


async def my_document(db, user, document_id):
    # populate_existing: always the saved row with its document type and region, also right after a change
    query = my_documents(user).where(UserDocument.id == document_id).execution_options(populate_existing=True)
    document = (await db.execute(query)).unique().scalar_one_or_none()
    if document is None:
        raise ApiError("No UserDocument matches the given query.", 404)
    return document


async def check_document(db, document):
    await must_exist(db, DocumentType, document.document_type_id, "document_type")
    await must_exist(db, Region, document.region_id, "region")
    if document.issued_at and document.expires_at and document.expires_at <= document.issued_at:
        raise FieldError("expires_at", "The end date must be after the issue date.")


@router.get("/my-documents/")
async def list_my_documents(request: Request, user: CurrentUser, db: DB, page: Paginate):
    query = my_documents(user)
    if (type_id := int_param(request, "document_type")) is not None:
        query = query.where(UserDocument.document_type_id == type_id)
    if (region := int_param(request, "region")) is not None:
        query = query.where(UserDocument.region_id == region)
    # Documents that end in this period: ?expires_after=2026-10-01&expires_before=2026-10-31
    if param(request, "expires_after"):
        query = query.where(UserDocument.expires_at >= date.fromisoformat(param(request, "expires_after")))
    if param(request, "expires_before"):
        query = query.where(UserDocument.expires_at <= date.fromisoformat(param(request, "expires_before")))
    if words := param(request, "search"):
        query = query.where(or_(
            UserDocument.number.ilike(f"%{words}%"), UserDocument.note.ilike(f"%{words}%"),
            UserDocument.document_type_id.in_(select(DocumentType.id).where(DocumentType.title.ilike(f"%{words}%"))),
        ))
    query = apply_ordering(request, query, {"expires_at": UserDocument.expires_at, "created_at": UserDocument.created_at},
                           [UserDocument.expires_at])
    return await page.respond(db, query, s.user_document_json)


@router.post("/my-documents/", status_code=201)
async def create_my_document(data: s.UserDocumentIn, user: CurrentUser, db: DB):
    document = UserDocument(user_id=user.id, **data.model_dump())
    await check_document(db, document)
    db.add(document)
    await db.commit()
    return s.user_document_json(await my_document(db, user, document.id))


@router.get("/my-documents/{document_id}/")
async def get_my_document(document_id: int, user: CurrentUser, db: DB):
    return s.user_document_json(await my_document(db, user, document_id))


async def change_document(document_id, data, user, db, partial):
    document = await my_document(db, user, document_id)
    for field, value in data.model_dump(exclude_unset=partial).items():
        if value is None and field in ("document_type_id", "expires_at", "remind_days_before"):
            continue
        setattr(document, field, value)
    await check_document(db, document)
    await db.commit()
    return s.user_document_json(await my_document(db, user, document_id))


@router.put("/my-documents/{document_id}/")
async def put_my_document(document_id: int, data: s.UserDocumentIn, user: CurrentUser, db: DB):
    return await change_document(document_id, data, user, db, False)


@router.patch("/my-documents/{document_id}/")
async def patch_my_document(document_id: int, data: s.UserDocumentPatch, user: CurrentUser, db: DB):
    return await change_document(document_id, data, user, db, True)


@router.delete("/my-documents/{document_id}/", status_code=204)
async def delete_my_document(document_id: int, user: CurrentUser, db: DB):
    document = await my_document(db, user, document_id)
    receipts = (await db.scalars(select(Payment.receipt).where(Payment.document_id == document.id))).all()
    photo = document.photo
    await db.delete(document)
    await db.commit()
    for name in [photo, *receipts]:
        await delete_private(name)
    return Response(status_code=204)


@router.get("/my-documents/{document_id}/photo/")
async def document_photo(document_id: int, user: CurrentUser, db: DB):
    """The photo of the document: only for its owner."""
    document = await my_document(db, user, document_id)
    path = private_path(document.photo)
    if path is None or not path.exists():
        raise ApiError("Страница не найдена.", 404)
    return FileResponse(path)


@router.post("/my-documents/{document_id}/photo/")
async def upload_document_photo(document_id: int, user: CurrentUser, db: DB, photo: Annotated[UploadFile, File()]):
    document = await my_document(db, user, document_id)
    name = await save_private(photo, "documents", "photo")
    old, document.photo = document.photo, name
    await db.commit()
    await delete_private(old)
    return s.user_document_json(await my_document(db, user, document_id))


@router.delete("/my-documents/{document_id}/photo/", status_code=204)
async def delete_document_photo(document_id: int, user: CurrentUser, db: DB):
    document = await my_document(db, user, document_id)
    old, document.photo = document.photo, ""
    await db.commit()
    await delete_private(old)
    return Response(status_code=204)


# --- Payments (the receipts archive) ---------------------------------------------------------------------------

def my_payments(user):
    return select(Payment).where(Payment.user_id == user.id)


async def my_payment(db, user, payment_id):
    query = my_payments(user).where(Payment.id == payment_id).execution_options(populate_existing=True)
    payment = (await db.execute(query)).unique().scalar_one_or_none()
    if payment is None:
        raise ApiError("No Payment matches the given query.", 404)
    return payment


@router.get("/payments/")
async def list_payments(request: Request, user: CurrentUser, db: DB, page: Paginate):
    query = my_payments(user)
    if (document := int_param(request, "document")) is not None:
        query = query.where(Payment.document_id == document)
    if param(request, "paid_after"):
        query = query.where(Payment.paid_at >= date.fromisoformat(param(request, "paid_after")))
    if param(request, "paid_before"):
        query = query.where(Payment.paid_at <= date.fromisoformat(param(request, "paid_before")))
    query = search(query, request, Payment.note)
    return await page.respond(db, query.order_by(Payment.paid_at.desc(), Payment.created_at.desc()), s.payment_json)


@router.post("/payments/", status_code=201)
async def create_payment(
    user: CurrentUser, db: DB,
    document: Annotated[int, Form()],
    amount: Annotated[Decimal, Form(ge=0, max_digits=10, decimal_places=2)],
    months: Annotated[int, Form(ge=1, le=12)] = 1,
    paid_at: Annotated[date | None, Form()] = None,
    note: Annotated[str, Form(max_length=255)] = "",
    receipt: Annotated[UploadFile | None, File()] = None,
):
    """A payment for one of my documents. Its end date moves forward by the months paid."""
    target = await db.get(UserDocument, document)
    if target is None:
        raise FieldError("document", not_found("UserDocument", document))
    if target.user_id != user.id:
        raise FieldError("document", "This is not your document.")
    name = await save_private(receipt, "receipts", "receipt") if receipt is not None and receipt.filename else ""
    payment = Payment(user_id=user.id, document_id=target.id, months=months, amount=amount,
                      paid_at=paid_at or date.today(), note=note.strip(), receipt=name)
    db.add(payment)
    target.expires_at = add_months(target.expires_at, months)
    await db.commit()
    return s.payment_json(await my_payment(db, user, payment.id))


@router.get("/payments/{payment_id}/")
async def get_payment(payment_id: int, user: CurrentUser, db: DB):
    return s.payment_json(await my_payment(db, user, payment_id))


@router.delete("/payments/{payment_id}/", status_code=204)
async def delete_payment(payment_id: int, user: CurrentUser, db: DB):
    """Deleting a payment does not move the document's end date back."""
    payment = await my_payment(db, user, payment_id)
    receipt = payment.receipt
    await db.delete(payment)
    await db.commit()
    await delete_private(receipt)
    return Response(status_code=204)


@router.get("/payments/{payment_id}/receipt/")
async def payment_receipt(payment_id: int, user: CurrentUser, db: DB):
    payment = await my_payment(db, user, payment_id)
    path = private_path(payment.receipt)
    if path is None or not path.exists():
        raise ApiError("Страница не найдена.", 404)
    return FileResponse(path)
