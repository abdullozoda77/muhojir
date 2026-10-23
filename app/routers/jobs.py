"""/api/jobs/: real vacancies (imported from «Работа России», read-only here), their companies, workers' reviews
of companies, saved jobs and alerts about new jobs."""
from fastapi import APIRouter, Request, Response
from sqlalchemy import and_, exists, func, or_, select

from app.core.crud import apply_ordering
from app.core.deps import DB, CurrentUser, OptionalUser
from app.core.errors import ApiError, FieldError
from app.core.pagination import Paginate
from app.db.types import utcnow
from app.models import Employer, EmployerReview, Job, JobAlert, SavedJob
from app.models.jobs import INDUSTRIES
from app.routers.documents import int_param, param
from app.schemas import jobs as s

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

TRUE = ("true", "True", "1")
FALSE = ("false", "False", "0")


def bool_param(request, name):
    value = param(request, name)
    return True if value in TRUE else False if value in FALSE else None


def open_jobs(query):
    """The jobs workers see: switched on, not expired, and not from a blacklisted company."""
    return query.where(Job.is_active.is_(True), Job.expires_at > utcnow(),
                       Job.employer_id.in_(select(Employer.id).where(Employer.is_blacklisted.is_(False))))


def filter_jobs(query, params, user=None):
    """The job filters, used by the list and by the alerts: search, city, industry, min_salary, housing..."""
    get = params.get
    if words := get("search"):
        query = query.where(or_(Job.title.ilike(f"%{words}%"), Job.description.ilike(f"%{words}%"),
                                Job.employer_id.in_(select(Employer.id).where(Employer.name.ilike(f"%{words}%")))))
    if city := get("city"):
        query = query.where(Job.city.ilike(f"%{city}%"))
    if (industry := get("industry")) and industry in INDUSTRIES:
        query = query.where(Job.industry == industry)
    if get("salary_period"):
        query = query.where(Job.salary_period == get("salary_period"))
    if get("employer"):
        try:
            query = query.where(Job.employer_id == int(get("employer")))
        except ValueError:
            raise FieldError("employer", "Введите правильное число.")
    for flag in ("housing_provided", "meals_provided", "helps_with_documents", "is_active"):
        value = get(flag)
        if value in TRUE:
            query = query.where(getattr(Job, flag).is_(True))
        elif value in FALSE:
            query = query.where(getattr(Job, flag).is_(False))
    if get("min_salary"):
        # The top of the range counts; a job with only "from" is compared by that.
        value = int(get("min_salary"))
        query = query.where(or_(Job.salary_to >= value, and_(Job.salary_to.is_(None), Job.salary_from >= value)))
    if get("saved") in TRUE:
        if user is None:
            return query.where(False)
        query = query.where(Job.id.in_(select(SavedJob.job_id).where(SavedJob.user_id == user.id)))
    return query


def jobs_query(user):
    if user is None:
        query = select(Job)
    else:
        is_saved = exists().where(SavedJob.job_id == Job.id, SavedJob.user_id == user.id)
        query = select(Job, is_saved.label("is_saved"))
    return query if user is not None and user.is_admin else open_jobs(query)


@router.get("/jobs/")
async def list_jobs(request: Request, db: DB, user: OptionalUser, page: Paginate):
    """Workers see only open jobs; admins see everything. Filters: search, city, industry, employer, min_salary,
    salary_period, housing_provided, meals_provided, helps_with_documents, saved=true; ordering=-salary_from..."""
    query = filter_jobs(jobs_query(user), request.query_params, user)
    query = apply_ordering(request, query, {"created_at": Job.created_at, "salary_from": Job.salary_from,
                                            "salary_to": Job.salary_to}, [Job.created_at.desc(), Job.id.desc()])
    return await page.respond(db, query, s.job_json)


async def get_job(db, user, job_id):
    row = (await db.execute(jobs_query(user).where(Job.id == job_id))).unique().first()
    if row is None:
        raise ApiError("No Job matches the given query.", 404)
    return row


@router.get("/jobs/{job_id}/")
async def job_detail(job_id: int, db: DB, user: OptionalUser):
    return s.job_json(*get_job_row(await get_job(db, user, job_id)))


def get_job_row(row):
    return (row[0], row[1]) if len(row) > 1 else (row[0], False)


@router.post("/jobs/{job_id}/save/")
async def save_job(job_id: int, db: DB, user: CurrentUser):
    """Save the job for later."""
    job = get_job_row(await get_job(db, user, job_id))[0]
    if not await db.scalar(select(SavedJob.id).where(SavedJob.user_id == user.id, SavedJob.job_id == job.id)):
        db.add(SavedJob(user_id=user.id, job_id=job.id))
        await db.commit()
    return {"is_saved": True}


@router.delete("/jobs/{job_id}/save/")
async def unsave_job(job_id: int, db: DB, user: CurrentUser):
    """Remove the job from the saved ones."""
    job = get_job_row(await get_job(db, user, job_id))[0]
    saved = await db.scalar(select(SavedJob).where(SavedJob.user_id == user.id, SavedJob.job_id == job.id))
    if saved:
        await db.delete(saved)
        await db.commit()
    return {"is_saved": False}


# --- Employers -------------------------------------------------------------------------------------------------

@router.get("/employers/")
async def list_employers(request: Request, db: DB, page: Paginate):
    query = select(Employer)
    if words := param(request, "search"):
        query = query.where(or_(Employer.name.ilike(f"%{words}%"), Employer.description.ilike(f"%{words}%"),
                                Employer.inn.ilike(f"%{words}%")))
    if city := param(request, "city"):
        query = query.where(Employer.city.ilike(f"%{city}%"))
    for flag in ("is_verified", "is_blacklisted"):
        value = bool_param(request, flag)
        if value is not None:
            query = query.where(getattr(Employer, flag).is_(value))
    return await page.respond(db, query.order_by(Employer.name), s.employer_json)


@router.get("/employers/{employer_id}/")
async def employer_detail(employer_id: int, db: DB):
    employer = await db.get(Employer, employer_id)
    if employer is None:
        raise ApiError("No Employer matches the given query.", 404)
    return s.employer_json(employer)


# --- Reviews of employers --------------------------------------------------------------------------------------

@router.get("/reviews/")
async def list_reviews(request: Request, db: DB, user: OptionalUser, page: Paginate):
    query = select(EmployerReview)
    if (employer := int_param(request, "employer")) is not None:
        query = query.where(EmployerReview.employer_id == employer)
    if (rating := int_param(request, "rating")) is not None:
        query = query.where(EmployerReview.rating == rating)
    if (min_rating := int_param(request, "min_rating")) is not None:
        query = query.where(EmployerReview.rating >= min_rating)
    if (value := bool_param(request, "salary_not_paid")) is not None:
        query = query.where(EmployerReview.salary_not_paid.is_(value))
    if words := param(request, "search"):
        query = query.where(EmployerReview.text.ilike(f"%{words}%"))
    query = query.order_by(EmployerReview.created_at.desc(), EmployerReview.id.desc())
    return await page.respond(db, query, lambda review: s.review_json(review, user))


async def get_review(db, review_id):
    review = (await db.execute(select(EmployerReview).where(EmployerReview.id == review_id)
                               .execution_options(populate_existing=True))).unique().scalar_one_or_none()
    if review is None:
        raise ApiError("No EmployerReview matches the given query.", 404)
    return review


@router.post("/reviews/", status_code=201)
async def create_review(data: s.ReviewIn, db: DB, user: CurrentUser):
    if await db.get(Employer, data.employer) is None:
        raise FieldError("employer", f"Недопустимый первичный ключ \"{data.employer}\" - объект не существует.")
    if await db.scalar(select(EmployerReview.id).where(EmployerReview.employer_id == data.employer,
                                                      EmployerReview.author_id == user.id)):
        raise FieldError("employer", "You already reviewed this employer. Edit that review instead.")
    review = EmployerReview(employer_id=data.employer, author_id=user.id, rating=data.rating, text=data.text,
                            salary_not_paid=data.salary_not_paid)
    db.add(review)
    await db.commit()
    return s.review_json(await get_review(db, review.id), user)


@router.get("/reviews/{review_id}/")
async def review_detail(review_id: int, db: DB, user: OptionalUser):
    return s.review_json(await get_review(db, review_id), user)


async def own_review(db, user, review_id):
    review = await get_review(db, review_id)
    if review.author_id != user.id and not user.is_admin:
        raise ApiError("У вас недостаточно прав для выполнения данного действия.", 403)
    return review


async def change_review(review_id, data, db, user, partial):
    review = await own_review(db, user, review_id)
    changes = data.model_dump(exclude_unset=partial)
    if changes.get("employer") not in (None, review.employer_id):
        raise FieldError("employer", "A review cannot be moved to another employer.")
    for field in ("rating", "text", "salary_not_paid"):
        if changes.get(field) is not None:
            setattr(review, field, changes[field])
    await db.commit()
    return s.review_json(await get_review(db, review_id), user)


@router.put("/reviews/{review_id}/")
async def put_review(review_id: int, data: s.ReviewIn, db: DB, user: CurrentUser):
    return await change_review(review_id, data, db, user, False)


@router.patch("/reviews/{review_id}/")
async def patch_review(review_id: int, data: s.ReviewPatch, db: DB, user: CurrentUser):
    return await change_review(review_id, data, db, user, True)


@router.delete("/reviews/{review_id}/", status_code=204)
async def delete_review(review_id: int, db: DB, user: CurrentUser):
    await db.delete(await own_review(db, user, review_id))
    await db.commit()
    return Response(status_code=204)


# --- Job alerts: the user's own, at most 10, not paged ----------------------------------------------------------

MAX_ALERTS = 10
ALERT_FIELDS = ("search", "city", "industry", "min_salary", "housing_provided")


def check_alert(alert):
    if not any(getattr(alert, field) for field in ALERT_FIELDS):
        raise ApiError({"detail": ["Choose at least one filter for the alert."]})


async def my_alert(db, user, alert_id):
    alert = await db.scalar(select(JobAlert).where(JobAlert.id == alert_id, JobAlert.user_id == user.id))
    if alert is None:
        raise ApiError("No JobAlert matches the given query.", 404)
    return alert


@router.get("/alerts/")
async def list_alerts(db: DB, user: CurrentUser):
    alerts = await db.scalars(select(JobAlert).where(JobAlert.user_id == user.id).order_by(JobAlert.created_at.desc()))
    return [s.alert_json(a) for a in alerts.unique()]


@router.post("/alerts/", status_code=201)
async def create_alert(data: s.AlertIn, db: DB, user: CurrentUser):
    count = await db.scalar(select(func.count()).where(JobAlert.user_id == user.id))
    if count >= MAX_ALERTS:
        raise ApiError({"detail": ["You can have at most 10 job alerts."]})
    alert = JobAlert(user_id=user.id, **data.model_dump())
    check_alert(alert)
    db.add(alert)
    await db.commit()
    return s.alert_json(alert)


@router.get("/alerts/{alert_id}/")
async def alert_detail(alert_id: int, db: DB, user: CurrentUser):
    return s.alert_json(await my_alert(db, user, alert_id))


async def change_alert(alert_id, data, db, user, partial):
    alert = await my_alert(db, user, alert_id)
    for field, value in data.model_dump(exclude_unset=partial).items():
        if value is None and field != "min_salary":
            continue
        setattr(alert, field, value)
    check_alert(alert)
    await db.commit()
    return s.alert_json(alert)


@router.put("/alerts/{alert_id}/")
async def put_alert(alert_id: int, data: s.AlertIn, db: DB, user: CurrentUser):
    return await change_alert(alert_id, data, db, user, False)


@router.patch("/alerts/{alert_id}/")
async def patch_alert(alert_id: int, data: s.AlertPatch, db: DB, user: CurrentUser):
    return await change_alert(alert_id, data, db, user, True)


@router.delete("/alerts/{alert_id}/", status_code=204)
async def delete_alert(alert_id: int, db: DB, user: CurrentUser):
    await db.delete(await my_alert(db, user, alert_id))
    await db.commit()
    return Response(status_code=204)
