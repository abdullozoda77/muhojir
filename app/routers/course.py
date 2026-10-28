import random
import secrets
from datetime import timedelta

from fastapi import APIRouter
from pydantic import Field
from sqlalchemy import select

from app.core.deps import DB, CurrentUser, OptionalUser
from app.core.errors import ApiError, FieldError
from app.db.types import utcnow
from app.models import Certificate, ExamAttempt, LessonProgress
from app.schemas.common import Form
from app.services import course
from app.services.notify import notify

router = APIRouter(prefix="/api/course", tags=["course"])

NO_LEVEL = "Level not found."
NO_LESSON = "Lesson not found."
LESSONS_FIRST = "Finish all lessons of this level first."
ALREADY_PASSED = "You already have the certificate for this level."
WAIT = "You can try the exam again later."
FINISHED = "This exam is already finished."


class LessonDone(Form):
    score: int = Field(ge=0, le=100)


class ExamStart(Form):
    full_name: str = Field(min_length=3, max_length=150)


class ExamAnswers(Form):
    answers: list[int | None] = Field(max_length=course.EXAM_SIZE)


def level_info(data):
    return {"level": data["level"], "title": data["title"], "title_ru": data.get("title_ru", ""),
            "cefr": data.get("cefr", ""), "text": data.get("text", "")}


def certificate_json(c):
    data = course.level(c.level) or {"title": "", "title_ru": ""}
    return {"code": c.code, "number": c.number, "full_name": c.full_name, "level": c.level,
            "level_title": data["title"], "level_title_ru": data.get("title_ru", ""), "percent": c.percent,
            "issued_at": c.issued_at.isoformat(), "is_revoked": c.is_revoked}


def must_level(number):
    data = course.level(number)
    if not data:
        raise ApiError(NO_LEVEL, 404)
    return data


async def progress_of(db, user, level=None):
    if not user:
        return {}
    query = select(LessonProgress).where(LessonProgress.user_id == user.id)
    if level:
        query = query.where(LessonProgress.level == level)
    return {(p.level, p.number): p for p in (await db.scalars(query)).all()}


async def certificates_of(db, user):
    if not user:
        return {}
    rows = (await db.scalars(select(Certificate).where(Certificate.user_id == user.id))).all()
    return {c.level: c for c in rows}


async def last_attempt(db, user, level):
    return await db.scalar(select(ExamAttempt).where(ExamAttempt.user_id == user.id, ExamAttempt.level == level)
                           .order_by(ExamAttempt.started_at.desc()).limit(1))


def wait_until(attempt):
    if attempt and attempt.passed is False and attempt.finished_at:
        moment = attempt.finished_at + timedelta(minutes=course.RETRY_MINUTES)
        if moment > utcnow():
            return moment
    return None


def is_open(attempt):
    return attempt and attempt.finished_at is None and attempt.ends_at > utcnow()


def exam_json(attempt):
    questions = []
    for item in attempt.questions:
        q = course.exam_question(attempt.level, item["i"])
        questions.append({"q": q["q"], "ru": q.get("ru", ""), "listen": q.get("listen", ""),
                          "options": [q["options"][k] for k in item["order"]]})
    return {"id": attempt.id, "level": attempt.level, "full_name": attempt.full_name, "questions": questions,
            "ends_at": attempt.ends_at.isoformat(), "minutes": course.EXAM_MINUTES, "pass_percent": course.PASS_PERCENT}


def shuffled(data, index):
    order = list(range(len(data["exam"][index]["options"])))
    random.shuffle(order)
    return {"i": index, "order": order}


@router.get("/")
async def overview(db: DB, user: OptionalUser):
    done = await progress_of(db, user)
    certificates = await certificates_of(db, user)
    result = []
    for data in course.levels():
        n = data["level"]
        lessons = [{"number": i, "title": item["title"], "goal": item.get("goal", ""),
                    "score": done[(n, i)].score if (n, i) in done else None}
                   for i, item in enumerate(data["lessons"], start=1)]
        finished = sum(1 for item in lessons if item["score"] is not None)
        exam = {"lessons_done": finished, "lessons_total": len(lessons), "ready": finished >= len(lessons),
                "certificate": certificate_json(certificates[n]) if n in certificates else None,
                "wait_until": None, "open": False}
        if user and exam["ready"] and not exam["certificate"]:
            attempt = await last_attempt(db, user, n)
            moment = wait_until(attempt)
            exam["wait_until"] = moment.isoformat() if moment else None
            exam["open"] = bool(is_open(attempt))
        result.append({**level_info(data), "lessons": lessons, "exam": exam})
    return {"levels": result, "exam_size": course.EXAM_SIZE, "exam_minutes": course.EXAM_MINUTES,
            "pass_percent": course.PASS_PERCENT, "lesson_pass": course.LESSON_PASS}


@router.get("/levels/{level}/lessons/{number}/")
async def lesson_detail(level: int, number: int, db: DB, user: OptionalUser):
    data = must_level(level)
    item = course.lesson(level, number)
    if not item:
        raise ApiError(NO_LESSON, 404)
    done = (await progress_of(db, user, level)).get((level, number))
    return {**item, "level": level, "number": number, "level_title": data["title"],
            "lessons_total": len(data["lessons"]), "score": done.score if done else None,
            "lesson_pass": course.LESSON_PASS}


@router.post("/levels/{level}/lessons/{number}/complete/")
async def lesson_complete(level: int, number: int, body: LessonDone, db: DB, user: CurrentUser):
    must_level(level)
    if not course.lesson(level, number):
        raise ApiError(NO_LESSON, 404)
    if body.score < course.LESSON_PASS:
        raise FieldError("score", f"At least {course.LESSON_PASS}% is needed to finish the lesson.")
    done = (await progress_of(db, user, level)).get((level, number))
    if done:
        done.score = max(done.score, body.score)
        done.completed_at = utcnow()
    else:
        done = LessonProgress(user_id=user.id, level=level, number=number, score=body.score)
        db.add(done)
    await db.commit()
    return {"level": level, "number": number, "score": done.score}


@router.post("/levels/{level}/exam/", status_code=201)
async def exam_start(level: int, body: ExamStart, db: DB, user: CurrentUser):
    data = must_level(level)
    if level in await certificates_of(db, user):
        raise ApiError(ALREADY_PASSED)
    done = await progress_of(db, user, level)
    if len(done) < len(data["lessons"]):
        raise ApiError(LESSONS_FIRST)
    attempt = await last_attempt(db, user, level)
    if is_open(attempt):
        return exam_json(attempt)
    if moment := wait_until(attempt):
        raise ApiError(WAIT, 429, wait_until=moment.isoformat())
    pool = range(len(data["exam"]))
    attempt = ExamAttempt(user_id=user.id, level=level, full_name=" ".join(body.full_name.split()),
                          questions=[shuffled(data, i) for i in random.sample(pool, min(course.EXAM_SIZE, len(pool)))],
                          ends_at=utcnow() + timedelta(minutes=course.EXAM_MINUTES))
    db.add(attempt)
    await db.commit()
    return exam_json(attempt)


@router.get("/exams/{attempt_id}/")
async def exam_detail(attempt_id: int, db: DB, user: CurrentUser):
    attempt = await db.get(ExamAttempt, attempt_id)
    if not attempt or attempt.user_id != user.id:
        raise ApiError(NO_LEVEL, 404)
    if not is_open(attempt):
        raise ApiError(FINISHED)
    return exam_json(attempt)


async def issue(db, user, attempt, percent):
    certificate = Certificate(code=secrets.token_hex(6), user_id=user.id, attempt_id=attempt.id, level=attempt.level,
                              full_name=attempt.full_name, percent=percent, number="")
    db.add(certificate)
    await db.flush()
    certificate.number = f"MJ-RU{attempt.level}-{certificate.issued_at:%Y}-{certificate.id:05d}"
    await db.commit()
    title = course.level(attempt.level)["title"]
    await notify(db, user, "Сертификати нав!",
                 f"Табрик! Шумо имтиҳони сатҳи {attempt.level} «{title}»-ро бо натиҷаи {percent}% супоридед. "
                 f"Сертификат № {certificate.number} дар саҳифаи «Курси забони русӣ» аст.")
    return certificate


@router.post("/exams/{attempt_id}/submit/")
async def exam_submit(attempt_id: int, body: ExamAnswers, db: DB, user: CurrentUser):
    attempt = await db.get(ExamAttempt, attempt_id)
    if not attempt or attempt.user_id != user.id:
        raise ApiError(NO_LEVEL, 404)
    if attempt.finished_at:
        raise ApiError(FINISHED)
    late = utcnow() > attempt.ends_at + timedelta(seconds=course.GRACE_SECONDS)
    answers = (list(body.answers) + [None] * len(attempt.questions))[:len(attempt.questions)]
    review, right = [], 0
    for item, answer in zip(attempt.questions, answers):
        q = course.exam_question(attempt.level, item["i"])
        order = item["order"]
        ok = not late and answer is not None and 0 <= answer < len(order) and order[answer] == q["answer"]
        right += ok
        review.append({"q": q["q"], "ru": q.get("ru", ""), "options": [q["options"][k] for k in order],
                       "answer": order.index(q["answer"]), "picked": answer, "right": ok})
    total = len(attempt.questions)
    percent = round(right * 100 / total) if total else 0
    attempt.answers, attempt.score, attempt.finished_at = answers, right, utcnow()
    attempt.passed = percent >= course.PASS_PERCENT
    await db.commit()
    certificate = None
    if attempt.passed and attempt.level not in await certificates_of(db, user):
        certificate = await issue(db, user, attempt, percent)
    return {"right": right, "total": total, "percent": percent, "passed": attempt.passed, "late": late,
            "review": review, "certificate": certificate_json(certificate) if certificate else None,
            "wait_until": (moment.isoformat() if (moment := wait_until(attempt)) else None)}


@router.get("/certificates/")
async def my_certificates(db: DB, user: CurrentUser):
    rows = (await db.scalars(select(Certificate).where(Certificate.user_id == user.id)
                             .order_by(Certificate.level))).all()
    return [certificate_json(c) for c in rows]


@router.get("/certificates/{code}/")
async def certificate_detail(code: str, db: DB):
    certificate = await db.scalar(select(Certificate).where(Certificate.code == code))
    if not certificate:
        raise ApiError("Certificate not found.", 404)
    return certificate_json(certificate)
