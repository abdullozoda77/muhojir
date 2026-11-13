from typing import Annotated, Literal

import anyio
from fastapi import APIRouter, Depends, File, Form, Request, Response, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from pydantic import Field
from sqlalchemy import select

from app.assistant.providers import AssistantError, active_provider
from app.core.deps import DB, CurrentUser, EditorUser
from app.core.errors import ApiError, FieldError
from app.core.files import MAX_FILE_MB, delete_private, image_ext, private_path, save_private
from app.core.pagination import Paginate
from app.core.throttle import throttle
from app.models import DOC_TYPES, LANGUAGES, ORDER_STATUSES, Translation
from app.routers.documents import param
from app.schemas.common import Form as JsonForm
from app.schemas.market import owner_name
from app.services import translate as ai
from app.services.notify import notify, notify_editors

router = APIRouter(prefix="/api/translations", tags=["translations"])

Lang = Literal[tuple(LANGUAGES)]
SourceLang = Literal[("auto", *LANGUAGES)]
DocType = Literal[tuple(DOC_TYPES)]
Status = Literal[ORDER_STATUSES]
FILES = "translations"
MAX_TEXT = 10_000
CANCELLABLE = ("new", "priced")

STATUS_MESSAGES = {
    "priced": "Нархи тарҷума: {price} ₽. Барои тасдиқ бо шумо тамос мегирем.",
    "working": "Тарҷумон ба кор шурӯъ кард.",
    "done": "Тарҷума тайёр аст — онро дар саҳифаи «Тарҷумаи ҳуҷҷатҳо» гиред.",
    "cancelled": "Фармоиши тарҷума бекор шуд.",
}


class OrderPatch(JsonForm):
    status: Status | None = None
    price: int | None = Field(None, ge=0, le=1_000_000)
    editor_note: str | None = Field(None, max_length=2000)


def translation_json(t, viewer=None):
    data = {
        "id": t.id, "kind": t.kind, "source_lang": t.source_lang, "target_lang": t.target_lang, "direction": t.direction,
        "doc_type": t.doc_type, "doc_type_label": t.doc_type_label, "file_name": t.file_name,
        "source_text": t.source_text, "result_text": t.result_text, "notarized": t.notarized, "phone": t.phone,
        "note": t.note, "status": t.status, "price": t.price, "editor_note": t.editor_note,
        "file": f"/api/translations/{t.id}/file/" if t.file else None,
        "result": f"/api/translations/{t.id}/result/" if t.result_file else None,
        "created_at": t.created_at, "updated_at": t.updated_at,
    }
    if viewer is not None and viewer.is_editor:
        data.update({"name": owner_name(t.user), "email": t.user.email, "user": t.user_id})
    return data


async def read_upload(file, field):
    data = await file.read(MAX_FILE_MB * 1024 * 1024 + 1)
    if not data:
        raise FieldError(field, "Загруженный файл пуст.")
    if len(data) > MAX_FILE_MB * 1024 * 1024:
        raise FieldError(field, f"The file is too big. The limit is {MAX_FILE_MB} MB.")
    if data.startswith(b"%PDF"):
        return data, "application/pdf"
    image = image_ext(data)
    if image is None:
        raise FieldError(field, "Send a photo (jpg, png, webp) or a PDF.")
    return data, {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}[image]


async def own_translation(db, user, translation_id):
    translation = await db.get(Translation, translation_id)
    if translation is None or not (translation.user_id == user.id or user.is_editor):
        raise ApiError("No Translation matches the given query.", 404)
    return translation


async def send_file(name):
    path = private_path(name)
    if path is None or not await anyio.Path(path).exists():
        raise ApiError("File not found.", 404)
    return FileResponse(path, headers={"Cache-Control": "private, no-store"})


async def tell_owner(db, translation):
    template = STATUS_MESSAGES.get(translation.status)
    if template:
        message = template.format(price=translation.price or 0)
        if translation.editor_note:
            message += f"\n\n{translation.editor_note}"
        await notify(db, translation.user, f"Тарҷумаи ҳуҷҷат: {translation.doc_type_label}", message)


@router.get("/options/")
async def options():
    return {
        "languages": [{"code": code, "name": name} for code, name in LANGUAGES.items()],
        "doc_types": [{"code": code, "name": name} for code, name in DOC_TYPES.items()],
        "ai_enabled": active_provider() is not None,
        "max_file_mb": MAX_FILE_MB,
        "max_text": MAX_TEXT,
    }


@router.post("/ai/", status_code=201, dependencies=[Depends(throttle("translate"))])
async def translate_now(
    db: DB, user: CurrentUser,
    target_lang: Annotated[Lang, Form()],
    source_lang: Annotated[SourceLang, Form()] = "auto",
    text: Annotated[str, Form(max_length=MAX_TEXT)] = "",
    file: Annotated[UploadFile | None, File()] = None,
):
    text = text.strip()
    has_file = file is not None and bool(file.filename)
    if not text and not has_file:
        raise FieldError("text", "Write the text or add a photo of the document.")
    if source_lang == target_lang:
        raise FieldError("target_lang", "Choose a different language to translate into.")
    data, mime = await read_upload(file, "file") if has_file else (None, "")
    try:
        result = await ai.translate(source_lang, target_lang, text, data, mime)
    except AssistantError as error:
        return JSONResponse({"code": error.code, "detail": error.detail}, status_code=error.http_status)
    translation = Translation(user_id=user.id, kind="ai", source_lang=source_lang, target_lang=target_lang,
                              file_name=(file.filename or "")[:200] if has_file else "", source_text=text,
                              result_text=result, status="done")
    db.add(translation)
    await db.commit()
    await db.refresh(translation)
    return translation_json(translation)


@router.post("/orders/", status_code=201, dependencies=[Depends(throttle("translation_order"))])
async def order_translation(
    db: DB, user: CurrentUser,
    source_lang: Annotated[Lang, Form()],
    target_lang: Annotated[Lang, Form()],
    file: Annotated[UploadFile, File()],
    doc_type: Annotated[DocType, Form()] = "other",
    notarized: Annotated[bool, Form()] = False,
    phone: Annotated[str, Form(max_length=30)] = "",
    note: Annotated[str, Form(max_length=2000)] = "",
):
    if source_lang == target_lang:
        raise FieldError("target_lang", "Choose a different language to translate into.")
    phone = phone.strip() or (user.phone or "")
    if len(phone) < 5:
        raise FieldError("phone", "Write a phone number so the translator can reach you.")
    saved = await save_private(file, FILES, "file")
    translation = Translation(user_id=user.id, kind="order", source_lang=source_lang, target_lang=target_lang,
                              doc_type=doc_type, file=saved, file_name=(file.filename or "")[:200], notarized=notarized,
                              phone=phone, note=note.strip(), status="new")
    db.add(translation)
    try:
        await db.commit()
    except Exception:
        await delete_private(saved)
        raise
    await db.refresh(translation)
    notary = ", бо тасдиқи нотариус" if notarized else ""
    await notify_editors(db, f"Фармоиши тарҷума: {translation.doc_type_label}",
                         f"{owner_name(user)} ({phone}): {translation.direction}{notary}. {translation.note[:300]}",
                         skip=user)
    return translation_json(translation, user)


@router.get("/mine/")
async def my_translations(db: DB, user: CurrentUser):
    rows = await db.scalars(select(Translation).where(Translation.user_id == user.id)
                            .order_by(Translation.created_at.desc()).limit(100))
    return [translation_json(t) for t in rows.unique()]


@router.get("/orders/")
async def list_orders(request: Request, db: DB, user: EditorUser, page: Paginate):
    query = select(Translation).where(Translation.kind == "order").order_by(Translation.created_at.desc())
    if (status := param(request, "status")) in ORDER_STATUSES:
        query = query.where(Translation.status == status)
    return await page.respond(db, query, lambda t: translation_json(t, user))


@router.get("/{translation_id}/")
async def get_translation(translation_id: int, db: DB, user: CurrentUser):
    return translation_json(await own_translation(db, user, translation_id), user)


@router.get("/{translation_id}/file/")
async def translation_file(translation_id: int, db: DB, user: CurrentUser):
    return await send_file((await own_translation(db, user, translation_id)).file)


@router.get("/{translation_id}/result/")
async def translation_result(translation_id: int, db: DB, user: CurrentUser):
    return await send_file((await own_translation(db, user, translation_id)).result_file)


@router.post("/{translation_id}/cancel/")
async def cancel_order(translation_id: int, db: DB, user: CurrentUser):
    translation = await own_translation(db, user, translation_id)
    if translation.user_id != user.id or translation.kind != "order":
        raise ApiError("No Translation matches the given query.", 404)
    if translation.status not in CANCELLABLE:
        raise ApiError("The translator is already working on it; this order cannot be cancelled.")
    translation.status = "cancelled"
    await db.commit()
    await notify_editors(db, f"Фармоиши тарҷума бекор шуд: #{translation.id}",
                         f"{owner_name(user)}: {translation.doc_type_label}, {translation.direction}", skip=user)
    return translation_json(translation, user)


@router.delete("/{translation_id}/", status_code=204)
async def delete_translation(translation_id: int, db: DB, user: CurrentUser):
    translation = await own_translation(db, user, translation_id)
    if translation.user_id != user.id:
        raise ApiError("No Translation matches the given query.", 404)
    if translation.kind == "order" and translation.status not in ("done", "cancelled"):
        raise ApiError("Cancel the order first.")
    files = [translation.file, translation.result_file]
    await db.delete(translation)
    await db.commit()
    for name in files:
        await delete_private(name)
    return Response(status_code=204)


@router.patch("/{translation_id}/")
async def update_order(translation_id: int, data: OrderPatch, db: DB, user: EditorUser):
    translation = await db.get(Translation, translation_id)
    if translation is None or translation.kind != "order":
        raise ApiError("No Translation matches the given query.", 404)
    if data.status == "priced" and data.price is None and translation.price is None:
        raise FieldError("price", "Write the price.")
    if data.status == "done" and not translation.result_file:
        raise FieldError("status", "Upload the translated file first.")
    old_status = translation.status
    if data.price is not None:
        translation.price = data.price
    if data.editor_note is not None:
        translation.editor_note = data.editor_note.strip()
    if data.status:
        translation.status = data.status
    await db.commit()
    await db.refresh(translation)
    if translation.status != old_status:
        await tell_owner(db, translation)
    return translation_json(translation, user)


@router.post("/{translation_id}/result/")
async def upload_result(translation_id: int, db: DB, user: EditorUser, file: Annotated[UploadFile, File()]):
    translation = await db.get(Translation, translation_id)
    if translation is None or translation.kind != "order":
        raise ApiError("No Translation matches the given query.", 404)
    old_file = translation.result_file
    translation.result_file = await save_private(file, FILES, "file")
    translation.status = "done"
    await db.commit()
    await db.refresh(translation)
    if old_file:
        await delete_private(old_file)
    await tell_owner(db, translation)
    return translation_json(translation, user)
