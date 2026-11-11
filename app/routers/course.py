import random
import secrets
from datetime import timedelta

from fastapi import APIRouter, Request
from pydantic import Field
from sqlalchemy import select

from app.core.deps import DB, CurrentUser, OptionalUser
from app.core.errors import ApiError, FieldError
from app.db.types import utcnow
from app.models import Certificate, CoursePlace, ExamAttempt, LessonProgress
from app.schemas.common import Form
from app.services import course, stats
from app.services.notify import notify

NO_LEVEL = "Level not found."
NO_LESSON = "Lesson not found."
LESSONS_FIRST = "Finish all lessons of this level first."
ALREADY_PASSED = "You already passed this level."
WAIT = "You can try the exam again later."
FINISHED = "This exam is already finished."
LOCKED = "Finish the previous lesson first."


class LessonDone(Form):
    score: int = Field(ge=0, le=100)


class PlaceIn(Form):
    level: int = Field(ge=1)
    number: int = Field(ge=1)
    index: int = Field(default=0, ge=0)
    right: int = Field(default=0, ge=0)


class ExamStart(Form):
    full_name: str = Field(min_length=3, max_length=150)


class ExamAnswers(Form):
    answers: list[int | None] = Field(max_length=max(c.exam_size for c in course.COURSES.values()))


def lang_of(request):
    return "ru" if request.headers.get("accept-language", "").lower().startswith("ru") else "tg"


def level_info(kind, data, lang):
    return {"level": data["level"], "title": data["title"], "title_ru": data.get("title_ru", ""),
            "cefr": data.get("cefr", ""), "text": kind.tr(data.get("text", ""), lang)}


def certificate_json(c):
    kind = course.COURSES.get(c.course, course.RU)
    return {"code": c.code, "number": c.number, "full_name": c.full_name, "course": kind.key,
            "levels": kind.total_levels, "lessons": kind.total_levels * kind.lessons_per_level,
            "percent": c.percent, "issued_at": c.issued_at.isoformat(), "is_revoked": c.is_revoked}


def percent_of(attempt):
    return round(attempt.score * 100 / len(attempt.questions)) if attempt.questions else 0


def wait_until(attempt):
    if not attempt:
        return None
    if attempt.passed is False and attempt.finished_at:
        moment = attempt.finished_at + timedelta(minutes=course.RETRY_MINUTES)
    elif attempt.finished_at is None and attempt.ends_at <= utcnow():
        moment = attempt.ends_at + timedelta(minutes=course.RETRY_MINUTES)
    else:
        return None
    return moment if moment > utcnow() else None


def is_open(attempt):
    return attempt and attempt.finished_at is None and attempt.ends_at > utcnow()


def is_unlocked(level, number, done, passed):
    if number == 1:
        return level == 1 or level - 1 in passed
    return (level, number - 1) in done


def build(kind, prefix, tag):
    router = APIRouter(prefix=prefix, tags=[tag])

    def must_level(number):
        data = kind.level(number)
        if not data:
            raise ApiError(NO_LEVEL, 404)
        return data

    async def progress_of(db, user, level=None):
        if not user:
            return {}
        query = select(LessonProgress).where(LessonProgress.user_id == user.id, LessonProgress.course == kind.key)
        if level:
            query = query.where(LessonProgress.level == level)
        return {(p.level, p.number): p for p in (await db.scalars(query)).all()}

    async def passed_levels(db, user):
        if not user:
            return {}
        rows = (await db.scalars(select(ExamAttempt).where(ExamAttempt.user_id == user.id,
                                                           ExamAttempt.course == kind.key,
                                                           ExamAttempt.passed.is_(True)))).all()
        best = {}
        for attempt in rows:
            best[attempt.level] = max(best.get(attempt.level, 0), percent_of(attempt))
        return best

    async def certificate_of(db, user):
        if not user:
            return None
        return await db.scalar(select(Certificate).where(Certificate.user_id == user.id,
                                                         Certificate.course == kind.key).limit(1))

    async def last_attempt(db, user, level):
        return await db.scalar(select(ExamAttempt).where(ExamAttempt.user_id == user.id,
                                                         ExamAttempt.course == kind.key, ExamAttempt.level == level)
                               .order_by(ExamAttempt.started_at.desc()).limit(1))

    async def place_of(db, user):
        if not user:
            return None
        return await db.scalar(select(CoursePlace).where(CoursePlace.user_id == user.id,
                                                         CoursePlace.course == kind.key))

    def place_json(place, done, lang="tg"):
        item = kind.lesson(place.level, place.number) if place else None
        if not item:
            return None
        return {"level": place.level, "number": place.number, "title": kind.tr(item["title"], lang), "index": place.index,
                "total": len(item["exercises"]), "finished": (place.level, place.number) in done}

    async def must_unlocked(db, user, level, number):
        if not is_unlocked(level, number, await progress_of(db, user), await passed_levels(db, user)):
            raise ApiError(LOCKED, 403, code="locked")

    def exam_json(attempt, lang):
        questions = []
        for item in attempt.questions:
            q = kind.exam_question(attempt.level, item["i"])
            questions.append({"q": kind.tr(q["q"], lang), "ru": q.get("ru", ""), "sign": q.get("sign", ""),
                              "options": [kind.tr(q["options"][k], lang) for k in item["order"]]})
        return {"id": attempt.id, "level": attempt.level, "full_name": attempt.full_name, "questions": questions,
                "ends_at": attempt.ends_at.isoformat(), "minutes": kind.exam_minutes,
                "pass_percent": kind.pass_percent}

    def shuffled(level, index):
        order = list(range(len(kind.exam_question(level, index)["options"])))
        random.shuffle(order)
        return {"i": index, "order": order}

    @router.get("/")
    async def overview(request: Request, db: DB, user: OptionalUser):
        lang = lang_of(request)
        done = await progress_of(db, user)
        passed = await passed_levels(db, user)
        certificate = await certificate_of(db, user)
        place = await place_of(db, user)
        result = []
        for data in kind.levels():
            n = data["level"]
            lessons = [{"number": i, "title": kind.tr(item["title"], lang), "goal": kind.tr(item.get("goal", ""), lang),
                        "score": done[(n, i)].score if (n, i) in done else None,
                        "unlocked": is_unlocked(n, i, done, passed)}
                       for i, item in enumerate(data["lessons"], start=1)]
            finished = sum(1 for item in lessons if item["score"] is not None)
            exam = {"lessons_done": finished, "lessons_total": len(lessons), "ready": finished >= len(lessons),
                    "passed": n in passed, "percent": passed.get(n), "final": n == kind.total_levels,
                    "wait_until": None, "open": False}
            if user and exam["ready"] and not exam["passed"]:
                attempt = await last_attempt(db, user, n)
                moment = wait_until(attempt)
                exam["wait_until"] = moment.isoformat() if moment else None
                exam["open"] = bool(is_open(attempt))
            result.append({**level_info(kind, data, lang), "unlocked": lessons[0]["unlocked"], "lessons": lessons, "exam": exam})
        return {"course": kind.key, "levels": result,
                "certificate": certificate_json(certificate) if certificate else None,
                "place": place_json(place, done, lang),
                "exam_size": kind.exam_size, "exam_minutes": kind.exam_minutes,
                "pass_percent": kind.pass_percent, "lesson_pass": kind.lesson_pass}

    @router.get("/levels/{level}/lessons/{number}/")
    async def lesson_detail(level: int, number: int, request: Request, db: DB, user: OptionalUser):
        lang = lang_of(request)
        data = must_level(level)
        item = kind.lesson(level, number)
        if not item:
            raise ApiError(NO_LESSON, 404)
        await must_unlocked(db, user, level, number)
        done = (await progress_of(db, user, level)).get((level, number))
        place = await place_of(db, user)
        resume = None
        if place and (place.level, place.number) == (level, number) and 0 < place.index < len(item["exercises"]):
            resume = {"index": place.index, "right": min(place.right, place.index)}
        return {**kind.translated(item, lang), "level": level, "number": number,
                "level_title": (lang == "ru" and data.get("title_ru")) or data["title"],
                "lessons_total": len(data["lessons"]), "score": done.score if done else None,
                "lesson_pass": kind.lesson_pass, "resume": resume}

    @router.put("/place/")
    async def save_place(body: PlaceIn, request: Request, db: DB, user: CurrentUser):
        must_level(body.level)
        item = kind.lesson(body.level, body.number)
        if not item:
            raise ApiError(NO_LESSON, 404)
        await must_unlocked(db, user, body.level, body.number)
        index = body.index if body.index < len(item["exercises"]) else 0
        place = await place_of(db, user)
        if not place:
            place = CoursePlace(user_id=user.id, course=kind.key)
            db.add(place)
        place.level, place.number, place.index, place.right = body.level, body.number, index, min(body.right, index)
        place.updated_at = utcnow()
        await db.commit()
        return place_json(place, await progress_of(db, user), lang_of(request))

    @router.post("/levels/{level}/lessons/{number}/complete/")
    async def lesson_complete(level: int, number: int, body: LessonDone, db: DB, user: CurrentUser):
        must_level(level)
        if not kind.lesson(level, number):
            raise ApiError(NO_LESSON, 404)
        await must_unlocked(db, user, level, number)
        if body.score < kind.lesson_pass:
            raise FieldError("score", f"At least {kind.lesson_pass}% is needed to finish the lesson.")
        done = (await progress_of(db, user, level)).get((level, number))
        if done:
            done.score = max(done.score, body.score)
            done.completed_at = utcnow()
        else:
            done = LessonProgress(user_id=user.id, course=kind.key, level=level, number=number, score=body.score)
            db.add(done)
        place = await place_of(db, user)
        if place and (place.level, place.number) == (level, number):
            place.index, place.right = 0, 0
        await db.commit()
        return {"level": level, "number": number, "score": done.score}

    @router.post("/levels/{level}/exam/", status_code=201)
    async def exam_start(level: int, body: ExamStart, request: Request, db: DB, user: CurrentUser):
        data = must_level(level)
        passed = await passed_levels(db, user)
        if level in passed:
            raise ApiError(ALREADY_PASSED)
        if level > 1 and level - 1 not in passed:
            raise ApiError(LOCKED, 403, code="locked")
        done = await progress_of(db, user, level)
        if len(done) < len(data["lessons"]):
            raise ApiError(LESSONS_FIRST)
        attempt = await last_attempt(db, user, level)
        if is_open(attempt):
            return exam_json(attempt, lang_of(request))
        if moment := wait_until(attempt):
            raise ApiError(WAIT, 429, wait_until=moment.isoformat())
        earlier = (await db.scalars(select(ExamAttempt.questions)
                                    .where(ExamAttempt.user_id == user.id, ExamAttempt.course == kind.key,
                                           ExamAttempt.level == level))).all()
        seen = [item["i"] for questions in earlier for item in questions]
        attempt = ExamAttempt(user_id=user.id, course=kind.key, level=level, full_name=" ".join(body.full_name.split()),
                              questions=[shuffled(level, i) for i in kind.pick_exam(level, seen)],
                              ends_at=utcnow() + timedelta(minutes=kind.exam_minutes))
        db.add(attempt)
        await db.commit()
        return exam_json(attempt, lang_of(request))

    async def own_attempt(db, user, attempt_id):
        attempt = await db.get(ExamAttempt, attempt_id)
        if not attempt or attempt.user_id != user.id or attempt.course != kind.key:
            raise ApiError(NO_LEVEL, 404)
        return attempt

    @router.get("/exams/{attempt_id}/")
    async def exam_detail(attempt_id: int, request: Request, db: DB, user: CurrentUser):
        attempt = await own_attempt(db, user, attempt_id)
        if not is_open(attempt):
            raise ApiError(FINISHED)
        return exam_json(attempt, lang_of(request))

    async def issue(db, user, attempt):
        passed = await passed_levels(db, user)
        percent = round(sum(passed.values()) / len(passed))
        certificate = Certificate(code=secrets.token_hex(6), user_id=user.id, course=kind.key,
                                  attempt_id=attempt.id, level=attempt.level, full_name=attempt.full_name,
                                  percent=percent, number="")
        db.add(certificate)
        await db.flush()
        certificate.number = f"{kind.prefix}-{certificate.issued_at:%Y}-{certificate.id:05d}"
        await db.commit()
        await notify(db, user, "Сертификати нав!",
                     f"Табрик! Шумо ҳамаи {kind.total_levels} сатҳи {kind.name}-ро хатм кардед, натиҷаи миёна "
                     f"{percent}%. Сертификат № {certificate.number} дар саҳифаи «{kind.page}» аст.")
        return certificate

    @router.post("/exams/{attempt_id}/submit/")
    async def exam_submit(attempt_id: int, body: ExamAnswers, request: Request, db: DB, user: CurrentUser):
        lang = lang_of(request)
        attempt = await own_attempt(db, user, attempt_id)
        if attempt.finished_at:
            raise ApiError(FINISHED)
        late = utcnow() > attempt.ends_at + timedelta(seconds=course.GRACE_SECONDS)
        answers = (list(body.answers) + [None] * len(attempt.questions))[:len(attempt.questions)]
        review, right = [], 0
        for item, answer in zip(attempt.questions, answers):
            q = kind.exam_question(attempt.level, item["i"])
            order = item["order"]
            ok = not late and answer is not None and 0 <= answer < len(order) and order[answer] == q["answer"]
            right += ok
            review.append({"q": kind.tr(q["q"], lang), "ru": q.get("ru", ""), "sign": q.get("sign", ""),
                           "options": [kind.tr(q["options"][k], lang) for k in order],
                           "answer": order.index(q["answer"]), "picked": answer, "right": ok})
        total = len(attempt.questions)
        percent = round(right * 100 / total) if total else 0
        attempt.answers, attempt.score, attempt.finished_at = answers, right, utcnow()
        attempt.passed = percent >= kind.pass_percent
        await db.commit()
        certificate = None
        if attempt.passed and attempt.level == kind.total_levels and not await certificate_of(db, user):
            certificate = await issue(db, user, attempt)
        return {"right": right, "total": total, "percent": percent, "passed": attempt.passed, "late": late,
                "final": attempt.level == kind.total_levels,
                "review": review, "certificate": certificate_json(certificate) if certificate else None,
                "wait_until": (moment.isoformat() if (moment := wait_until(attempt)) else None)}

    @router.get("/certificates/")
    async def my_certificates(db: DB, user: CurrentUser):
        rows = (await db.scalars(select(Certificate).where(Certificate.user_id == user.id,
                                                           Certificate.course == kind.key)
                                 .order_by(Certificate.level))).all()
        return [certificate_json(c) for c in rows]

    return router


router = build(course.RU, "/api/course", "course")
drive_router = build(course.DRIVE, "/api/drive", "drive")


@router.get("/stats/")
async def course_stats(db: DB, user: CurrentUser):
    return await stats.course_stats(db, user)


@router.get("/certificates/{code}/")
async def certificate_detail(code: str, db: DB):
    certificate = await db.scalar(select(Certificate).where(Certificate.code == code))
    if not certificate:
        raise ApiError("Certificate not found.", 404)
    return certificate_json(certificate)
