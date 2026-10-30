from typing import Literal

import os

from fastapi import APIRouter, Depends, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse
from pydantic import Field, ValidationError
from sqlalchemy import select
from starlette.datastructures import UploadFile

from app.core.deps import DB, CurrentUser, EditorUser
from app.core.errors import ApiError, FieldError
from app.core.files import delete_private, private_path, save_private
from app.core.pagination import Paginate
from app.core.throttle import throttle
from app.models import FEEDBACK_KINDS, FEEDBACK_STATUSES, Feedback
from app.routers.documents import param
from app.schemas.common import Form
from app.schemas.market import owner_name
from app.services.feedback import send_reply
from app.services.notify import notify_editors

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

Kind = Literal[tuple(FEEDBACK_KINDS)]
Status = Literal[FEEDBACK_STATUSES]
PHOTOS = "feedback"
PHOTO_TYPES = {".jpg", ".jpeg", ".png", ".webp"}


class FeedbackIn(Form):
    kind: Kind = "idea"
    rating: int | None = Field(None, ge=1, le=5)
    message: str = Field(min_length=5, max_length=3000)
    page: str = Field("", max_length=200)


class FeedbackPatch(Form):
    status: Status | None = None
    reply: str | None = Field(None, max_length=3000)


def feedback_json(f, viewer=None):
    data = {"id": f.id, "kind": f.kind, "kind_label": f.kind_label, "rating": f.rating, "message": f.message,
            "status": f.status, "reply": f.reply, "replied_at": f.replied_at, "created_at": f.created_at,
            "photo": f"/api/feedback/{f.id}/photo/" if f.photo else None}
    if viewer and viewer.is_editor:
        data.update({"name": f.user.full_name, "email": f.user.email, "page": f.page, "user": f.user_id})
    return data


@router.post("/", status_code=201, dependencies=[Depends(throttle("feedback"))])
async def send_feedback(request: Request, db: DB, user: CurrentUser):
    photo = None
    if request.headers.get("content-type", "").startswith("multipart/form-data"):
        form = await request.form()
        fields = {k: v for k, v in form.items() if isinstance(v, str) and v != ""}
        photo = form.get("photo")
        photo = photo if isinstance(photo, UploadFile) and photo.filename else None
    else:
        try:
            fields = await request.json()
        except ValueError:
            fields = None
        if not isinstance(fields, dict):
            raise ApiError("Send JSON or a form.")
    try:
        data = FeedbackIn(**fields)
    except ValidationError as error:
        raise RequestValidationError(error.errors(include_url=False))
    saved = ""
    if photo is not None:
        if os.path.splitext(photo.filename)[1].lower() not in PHOTO_TYPES:
            raise FieldError("photo", "Send a photo: jpg, png or webp.")
        saved = await save_private(photo, PHOTOS, "photo")
    feedback = Feedback(**data.model_dump(), user_id=user.id, photo=saved)
    db.add(feedback)
    try:
        await db.commit()
    except Exception:
        await delete_private(saved)
        raise
    await db.refresh(feedback)
    stars = f" ({data.rating}/5)" if data.rating else ""
    await notify_editors(db, f"Фикри нав: {feedback.kind_label}{stars}",
                         f"{owner_name(user)}: {data.message[:300]}", skip=user)
    return feedback_json(feedback, user)


@router.get("/mine/")
async def my_feedback(db: DB, user: CurrentUser):
    rows = await db.scalars(select(Feedback).where(Feedback.user_id == user.id).order_by(Feedback.created_at.desc()))
    return [feedback_json(f, user) for f in rows.unique()]


@router.get("/{feedback_id}/photo/")
async def feedback_photo(feedback_id: int, db: DB, user: CurrentUser):
    feedback = await db.get(Feedback, feedback_id)
    if feedback is None or not (user.is_editor or feedback.user_id == user.id):
        raise ApiError("No Feedback matches the given query.", 404)
    path = private_path(feedback.photo)
    if path is None or not path.exists():
        raise ApiError("File not found.", 404)
    return FileResponse(path, headers={"Cache-Control": "private, no-store"})


@router.get("/")
async def list_feedback(request: Request, db: DB, user: EditorUser, page: Paginate):
    query = select(Feedback).order_by(Feedback.created_at.desc())
    if (status := param(request, "status")) in FEEDBACK_STATUSES:
        query = query.where(Feedback.status == status)
    if (kind := param(request, "kind")) in FEEDBACK_KINDS:
        query = query.where(Feedback.kind == kind)
    return await page.respond(db, query, lambda f: feedback_json(f, user))


@router.patch("/{feedback_id}/")
async def update_feedback(feedback_id: int, data: FeedbackPatch, db: DB, user: EditorUser):
    feedback = await db.get(Feedback, feedback_id)
    if feedback is None:
        raise ApiError("No Feedback matches the given query.", 404)
    if data.reply is not None and not data.reply.strip():
        raise FieldError("reply", "Write the answer.")
    if data.status:
        feedback.status = data.status
    if data.reply:
        feedback.reply = data.reply
        await send_reply(db, feedback)
    else:
        await db.commit()
    await db.refresh(feedback)
    return feedback_json(feedback, user)
