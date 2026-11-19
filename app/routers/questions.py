from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import Field
from sqlalchemy import delete, func, or_, select

from app.core.deps import DB, CurrentUser, EditorUser, OptionalUser
from app.core.errors import ApiError
from app.core.pagination import Paginate
from app.core.throttle import throttle
from app.db.types import utcnow
from app.models import QUESTION_TOPICS, Answer, AnswerLike, Question
from app.routers.documents import param
from app.schemas.common import Form
from app.schemas.market import owner_name
from app.services.notify import notify

router = APIRouter(prefix="/api/questions", tags=["questions"])

Topic = Literal[tuple(QUESTION_TOPICS)]
NOT_FOUND = "No Question matches the given query."


class QuestionIn(Form):
    topic: Topic = "other"
    title: str = Field(min_length=10, max_length=150)
    body: str = Field("", max_length=3000)
    city: str = Field("", max_length=100)


class AnswerIn(Form):
    body: str = Field(min_length=5, max_length=3000)


class HidePatch(Form):
    is_hidden: bool


def can_manage(item, viewer):
    return bool(viewer and (viewer.is_editor or viewer.id == item.user_id))


def question_json(q, viewer=None):
    data = {
        "id": q.id, "topic": q.topic, "topic_label": q.topic_label, "title": q.title, "body": q.body, "city": q.city,
        "name": owner_name(q.user), "answers_count": q.answers_count, "solved": q.best_answer_id is not None,
        "created_at": q.created_at, "active_at": q.active_at,
        "mine": bool(viewer and viewer.id == q.user_id), "can_delete": can_manage(q, viewer),
    }
    if viewer and viewer.is_editor:
        data["is_hidden"] = q.is_hidden
    return data


def answer_json(a, question, viewer=None, liked=False):
    return {
        "id": a.id, "body": a.body, "name": owner_name(a.user), "likes": a.likes, "liked": liked,
        "best": question.best_answer_id == a.id, "created_at": a.created_at,
        "mine": bool(viewer and viewer.id == a.user_id), "can_delete": can_manage(a, viewer),
        "by_asker": a.user_id == question.user_id,
    }


async def visible_question(db, question_id, viewer):
    question = await db.get(Question, question_id)
    if question is None or (question.is_hidden and not (viewer and viewer.is_editor)):
        raise ApiError(NOT_FOUND, 404)
    return question


async def visible_answer(db, answer_id, viewer):
    answer = await db.get(Answer, answer_id)
    if answer is None or answer.is_hidden or answer.question.is_hidden:
        raise ApiError("No Answer matches the given query.", 404)
    return answer


async def recount(db, question):
    question.answers_count = await db.scalar(select(func.count()).select_from(Answer).where(
        Answer.question_id == question.id, Answer.is_hidden.is_(False))) or 0


@router.get("/")
async def list_questions(request: Request, db: DB, page: Paginate, viewer: OptionalUser):
    query = select(Question).where(Question.is_hidden.is_(False))
    if (topic := param(request, "topic")) in QUESTION_TOPICS:
        query = query.where(Question.topic == topic)
    if search := (param(request, "search") or "").strip():
        like = f"%{search}%"
        in_answers = select(Answer.question_id).where(Answer.body.ilike(like), Answer.is_hidden.is_(False))
        query = query.where(or_(Question.title.ilike(like), Question.body.ilike(like), Question.city.ilike(like),
                                Question.id.in_(in_answers)))
    show = param(request, "show")
    if show == "unanswered":
        query = query.where(Question.answers_count == 0)
    elif show == "solved":
        query = query.where(Question.best_answer_id.is_not(None))
    elif show == "mine":
        if viewer is None:
            raise ApiError("Учетные данные не были предоставлены.", 401)
        query = query.where(Question.user_id == viewer.id)
    order = Question.created_at.desc() if param(request, "ordering") == "new" else Question.active_at.desc()
    return await page.respond(db, query.order_by(order, Question.id.desc()), lambda q: question_json(q, viewer))


@router.get("/summary/")
async def questions_summary(db: DB):
    shown = select(Question).where(Question.is_hidden.is_(False)).subquery()
    topics = dict((await db.execute(select(shown.c.topic, func.count()).group_by(shown.c.topic))).all())
    unanswered = await db.scalar(select(func.count()).select_from(shown).where(shown.c.answers_count == 0))
    return {"total": sum(topics.values()), "unanswered": unanswered or 0,
            "topics": {k: topics.get(k, 0) for k in QUESTION_TOPICS}}


@router.post("/", status_code=201, dependencies=[Depends(throttle("question"))])
async def ask(data: QuestionIn, db: DB, user: CurrentUser):
    question = Question(**data.model_dump(), user_id=user.id)
    db.add(question)
    await db.commit()
    await db.refresh(question)
    return question_json(question, user)


@router.get("/{question_id}/")
async def question_detail(question_id: int, db: DB, viewer: OptionalUser):
    question = await visible_question(db, question_id, viewer)
    answers = select(Answer).where(Answer.question_id == question.id)
    if not (viewer and viewer.is_editor):
        answers = answers.where(Answer.is_hidden.is_(False))
    rows = (await db.scalars(answers.order_by(Answer.likes.desc(), Answer.created_at))).unique().all()
    rows.sort(key=lambda a: a.id != question.best_answer_id)
    liked = set()
    if viewer and rows:
        liked = set((await db.scalars(select(AnswerLike.answer_id).where(
            AnswerLike.user_id == viewer.id, AnswerLike.answer_id.in_([a.id for a in rows])))).all())
    data = question_json(question, viewer)
    data["answers"] = []
    for a in rows:
        item = answer_json(a, question, viewer, a.id in liked)
        if viewer and viewer.is_editor:
            item["is_hidden"] = a.is_hidden
        data["answers"].append(item)
    data["can_choose_best"] = can_manage(question, viewer)
    return data


@router.patch("/{question_id}/")
async def hide_question(question_id: int, data: HidePatch, db: DB, user: EditorUser):
    question = await db.get(Question, question_id)
    if question is None:
        raise ApiError(NOT_FOUND, 404)
    question.is_hidden = data.is_hidden
    await db.commit()
    await db.refresh(question)
    return question_json(question, user)


@router.delete("/{question_id}/", status_code=204)
async def delete_question(question_id: int, db: DB, user: CurrentUser):
    question = await db.get(Question, question_id)
    if question is None or not can_manage(question, user):
        raise ApiError(NOT_FOUND, 404)
    await db.delete(question)
    await db.commit()


@router.post("/{question_id}/answers/", status_code=201, dependencies=[Depends(throttle("answer"))])
async def answer_question(question_id: int, data: AnswerIn, db: DB, user: CurrentUser):
    question = await visible_question(db, question_id, None)
    if question.user_id == user.id:
        raise ApiError("You cannot answer your own question.", 400)
    answer = Answer(question_id=question.id, user_id=user.id, body=data.body)
    db.add(answer)
    await db.flush()
    await recount(db, question)
    question.active_at = utcnow()
    await db.commit()
    await db.refresh(answer)
    await notify(db, question.user, "Ба саволи шумо ҷавоб доданд",
                 f"«{question.title}»\n{owner_name(user)}: {answer.body[:300]}", url=f"/questions/{question.id}")
    return answer_json(answer, question, user)


@router.patch("/answers/{answer_id}/")
async def hide_answer(answer_id: int, data: HidePatch, db: DB, user: EditorUser):
    answer = await db.get(Answer, answer_id)
    if answer is None:
        raise ApiError("No Answer matches the given query.", 404)
    answer.is_hidden = data.is_hidden
    question = answer.question
    if data.is_hidden and question.best_answer_id == answer.id:
        question.best_answer_id = None
    await recount(db, question)
    await db.commit()
    return {"id": answer.id, "is_hidden": answer.is_hidden}


@router.delete("/answers/{answer_id}/", status_code=204)
async def delete_answer(answer_id: int, db: DB, user: CurrentUser):
    answer = await db.get(Answer, answer_id)
    if answer is None or not can_manage(answer, user):
        raise ApiError("No Answer matches the given query.", 404)
    question = answer.question
    if question.best_answer_id == answer.id:
        question.best_answer_id = None
    await db.delete(answer)
    await db.flush()
    await recount(db, question)
    await db.commit()


@router.post("/answers/{answer_id}/like/")
async def like_answer(answer_id: int, db: DB, user: CurrentUser):
    answer = await visible_answer(db, answer_id, user)
    if answer.user_id == user.id:
        raise ApiError("You cannot like your own answer.", 400)
    found = await db.scalar(select(AnswerLike.id).where(AnswerLike.answer_id == answer.id, AnswerLike.user_id == user.id))
    if found:
        await db.execute(delete(AnswerLike).where(AnswerLike.id == found))
    else:
        db.add(AnswerLike(answer_id=answer.id, user_id=user.id))
    await db.flush()
    answer.likes = await db.scalar(select(func.count()).select_from(AnswerLike).where(AnswerLike.answer_id == answer.id)) or 0
    await db.commit()
    return {"id": answer.id, "likes": answer.likes, "liked": not found}


@router.post("/answers/{answer_id}/best/")
async def choose_best(answer_id: int, db: DB, user: CurrentUser):
    answer = await visible_answer(db, answer_id, user)
    question = answer.question
    if not can_manage(question, user):
        raise ApiError("Only the person who asked can choose the best answer.", 403)
    chosen = question.best_answer_id != answer.id
    question.best_answer_id = answer.id if chosen else None
    await db.commit()
    if chosen and answer.user_id != user.id:
        await notify(db, answer.user, "Ҷавоби шумо беҳтарин интихоб шуд",
                     f"«{question.title}» — ташаккур барои кӯмак ба ҳамватанон!")
    return {"id": question.id, "best_answer_id": question.best_answer_id}
