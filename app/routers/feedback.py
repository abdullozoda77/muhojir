from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import Field
from sqlalchemy import select

from app.core.deps import DB, CurrentUser, EditorUser
from app.core.errors import ApiError, FieldError
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
            "status": f.status, "reply": f.reply, "replied_at": f.replied_at, "created_at": f.created_at}
    if viewer and viewer.is_editor:
        data.update({"name": f.user.full_name, "email": f.user.email, "page": f.page, "user": f.user_id})
    return data


@router.post("/", status_code=201, dependencies=[Depends(throttle("feedback"))])
async def send_feedback(data: FeedbackIn, db: DB, user: CurrentUser):
    feedback = Feedback(**data.model_dump(), user_id=user.id)
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)
    stars = f" ({data.rating}/5)" if data.rating else ""
    await notify_editors(db, f"Фикри нав: {feedback.kind_label}{stars}",
                         f"{owner_name(user)}: {data.message[:300]}", skip=user)
    return feedback_json(feedback, user)


@router.get("/mine/")
async def my_feedback(db: DB, user: CurrentUser):
    rows = await db.scalars(select(Feedback).where(Feedback.user_id == user.id).order_by(Feedback.created_at.desc()))
    return [feedback_json(f, user) for f in rows.unique()]


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
