from collections import Counter
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.models import (
    BlacklistReport, Certificate, DocumentType, EmployerReview, ExamAttempt, Feedback, FlightWatch, Housing, JobAlert,
    LessonProgress, Payment, Place, PlaceReview, SavedJob, Shop, ShopReview, UserDocument,
)
from app.services import course

MOSCOW = timezone(timedelta(hours=3))
COURSE_DAYS = 84
ACTIVITY_DAYS = 182


def local_day(moment):
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(MOSCOW).date()


def today():
    return datetime.now(MOSCOW).date()


def calendar(counter, days):
    end = today()
    start = end - timedelta(days=days - 1)
    start -= timedelta(days=start.weekday())
    span = (end - start).days + 1
    return [{"date": (start + timedelta(days=i)).isoformat(), "count": counter.get(start + timedelta(days=i), 0)}
            for i in range(span)]


def streaks(days):
    if not days:
        return 0, 0
    ordered = sorted(days)
    best = run = 1
    for before, after in zip(ordered, ordered[1:]):
        run = run + 1 if after - before == timedelta(days=1) else 1
        best = max(best, run)
    current, day = 0, today()
    if day not in days:
        day -= timedelta(days=1)
    while day in days:
        current += 1
        day -= timedelta(days=1)
    return current, best


def week_count(counter):
    start = today() - timedelta(days=6)
    return sum(n for d, n in counter.items() if d >= start)


async def course_stats(db, user):
    lessons = (await db.scalars(select(LessonProgress).where(LessonProgress.user_id == user.id))).all()
    attempts = (await db.scalars(select(ExamAttempt).where(ExamAttempt.user_id == user.id,
                                                           ExamAttempt.finished_at.is_not(None)))).all()
    certificate = await db.scalar(select(Certificate).where(Certificate.user_id == user.id).limit(1))

    counter = Counter(local_day(p.completed_at) for p in lessons)
    counter.update(local_day(a.finished_at) for a in attempts)
    current, best = streaks(set(counter))

    best_exam = {}
    for a in attempts:
        if a.questions:
            best_exam[a.level] = max(best_exam.get(a.level, 0), round(a.score * 100 / len(a.questions)))
    passed = {a.level for a in attempts if a.passed}

    levels = []
    for data in course.levels():
        n = data["level"]
        scores = [p.score for p in lessons if p.level == n]
        levels.append({"level": n, "title": data["title"], "title_ru": data.get("title_ru", ""),
                       "cefr": data.get("cefr", ""), "done": len(scores), "total": len(data["lessons"]),
                       "average": round(sum(scores) / len(scores)) if scores else None,
                       "exam_percent": best_exam.get(n), "passed": n in passed})

    recent = []
    for p in sorted(lessons, key=lambda p: p.completed_at, reverse=True)[:5]:
        item = course.lesson(p.level, p.number) or {}
        recent.append({"level": p.level, "number": p.number, "title": item.get("title", ""), "score": p.score,
                       "at": p.completed_at.isoformat()})

    scores = [p.score for p in lessons]
    return {
        "lessons_done": len(lessons), "lessons_total": sum(level["total"] for level in levels),
        "levels_passed": len(passed), "levels_total": len(levels),
        "average_score": round(sum(scores) / len(scores)) if scores else None,
        "perfect": sum(1 for s in scores if s == 100),
        "exams": {"attempts": len(attempts), "passed": len(passed),
                  "best_percent": max(best_exam.values()) if best_exam else None},
        "certificate": certificate.code if certificate else None,
        "streak": current, "best_streak": best, "active_days": len(counter), "this_week": week_count(counter),
        "days": calendar(counter, COURSE_DAYS), "levels": levels, "recent": recent,
    }


SECTIONS = (
    ("documents", UserDocument, UserDocument.user_id),
    ("payments", Payment, Payment.user_id),
    ("saved_jobs", SavedJob, SavedJob.user_id),
    ("job_alerts", JobAlert, JobAlert.user_id),
    ("lessons", LessonProgress, LessonProgress.user_id),
    ("exams", ExamAttempt, ExamAttempt.user_id),
    ("place_reviews", PlaceReview, PlaceReview.author_id),
    ("shop_reviews", ShopReview, ShopReview.author_id),
    ("employer_reviews", EmployerReview, EmployerReview.author_id),
    ("blacklist_reports", BlacklistReport, BlacklistReport.author_id),
    ("places", Place, Place.created_by_id),
    ("shops", Shop, Shop.owner_id),
    ("housing", Housing, Housing.owner_id),
    ("feedback", Feedback, Feedback.user_id),
    ("flights", FlightWatch, FlightWatch.user_id),
)


def moment_of(model):
    if model is LessonProgress:
        return LessonProgress.completed_at
    if model is ExamAttempt:
        return ExamAttempt.started_at
    return model.created_at


async def activity(db, user):
    since = datetime.now(timezone.utc) - timedelta(days=ACTIVITY_DAYS + 7)
    counter, totals, sections = Counter(), {}, []
    for key, model, owner in SECTIONS:
        moment = moment_of(model)
        totals[key] = await db.scalar(select(func.count()).select_from(model).where(owner == user.id)) or 0
        for (value,) in (await db.execute(select(moment).where(owner == user.id, moment >= since))).all():
            counter[local_day(value)] += 1
            sections.append(key)

    paid = await db.scalar(select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.user_id == user.id))

    recent = []
    rows = await db.execute(select(UserDocument.created_at, DocumentType.title)
                            .join(DocumentType, DocumentType.id == UserDocument.document_type_id)
                            .where(UserDocument.user_id == user.id).order_by(UserDocument.created_at.desc()).limit(5))
    recent += [{"kind": "documents", "title": title, "at": at, "to": "/documents"} for at, title in rows.all()]
    rows = await db.execute(select(Payment.created_at, Payment.amount).where(Payment.user_id == user.id)
                            .order_by(Payment.created_at.desc()).limit(5))
    recent += [{"kind": "payments", "title": f"{amount:,.0f} ₽".replace(",", " "), "at": at, "to": "/payments"}
               for at, amount in rows.all()]
    rows = await db.scalars(select(LessonProgress).where(LessonProgress.user_id == user.id)
                            .order_by(LessonProgress.completed_at.desc()).limit(5))
    recent += [{"kind": "lessons", "title": (course.lesson(p.level, p.number) or {}).get("title", ""),
                "at": p.completed_at, "to": f"/course/{p.level}/{p.number}"} for p in rows.all()]
    rows = await db.execute(select(Housing.created_at, Housing.title, Housing.id).where(Housing.owner_id == user.id)
                            .order_by(Housing.created_at.desc()).limit(5))
    recent += [{"kind": "housing", "title": title, "at": at, "to": f"/housing/{pk}"} for at, title, pk in rows.all()]
    rows = await db.execute(select(Shop.created_at, Shop.name).where(Shop.owner_id == user.id)
                            .order_by(Shop.created_at.desc()).limit(5))
    recent += [{"kind": "shops", "title": name, "at": at, "to": "/shops"} for at, name in rows.all()]
    rows = await db.execute(select(Place.created_at, Place.name).where(Place.created_by_id == user.id)
                            .order_by(Place.created_at.desc()).limit(5))
    recent += [{"kind": "places", "title": name, "at": at, "to": "/places"} for at, name in rows.all()]
    rows = await db.execute(select(SavedJob.created_at).where(SavedJob.user_id == user.id)
                            .order_by(SavedJob.created_at.desc()).limit(5))
    recent += [{"kind": "saved_jobs", "title": "", "at": at, "to": "/saved-jobs"} for (at,) in rows.all()]
    recent.sort(key=lambda r: r["at"], reverse=True)
    recent = [{**r, "at": r["at"].isoformat()} for r in recent[:8]]

    current, best = streaks(set(counter))
    joined = local_day(user.date_joined) if user.date_joined else today()
    return {
        "member_days": (today() - joined).days + 1,
        "total": sum(totals.values()), "totals": totals, "paid": float(paid or 0),
        "streak": current, "best_streak": best, "active_days": len(counter), "this_week": week_count(counter),
        "sections": dict(Counter(sections)), "days": calendar(counter, ACTIVITY_DAYS), "recent": recent,
    }
