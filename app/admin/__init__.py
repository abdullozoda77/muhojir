"""The admin panel at /admin/ (SQLAdmin). Log in with the email and password of an editor or admin.

Admins see everything. Editors see only the site's content: news, guides, exam questions, help sites, centers and
patent prices (document types they may only edit). Users, their documents and payments, jobs and companies stay
hidden from editors. The start page shows the site's numbers (for admins)."""
from datetime import date, timedelta

from sqladmin import Admin
from sqladmin.authentication import AuthenticationBackend, login_required
from sqladmin.authorization import AuthorizationBackend
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from starlette.requests import Request

from app.admin.views import EDITOR_VIEWS, VIEWS
from app.core.config import BASE_DIR, settings
from app.core.security import verify_password
from app.db.session import SessionLocal, engine
from app.db.types import utcnow
from app.models import (
    Employer, EmployerReview, ExamQuestion, FlightWatch, Job, JobAlert, LawNews, Payment, Place, PlaceReview, ReminderLog,
    SavedJob, User, UserDocument,
)


class StaffLogin(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        email = str(form.get("username", "")).strip().lower()
        async with SessionLocal() as db:
            user = await db.scalar(select(User).where(User.email == email))
        if user is None or not user.is_editor or not verify_password(str(form.get("password", "")), user.password_hash):
            return False
        request.session.update({"user_id": user.id})
        return True

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        user_id = request.session.get("user_id")
        if not user_id:
            return False
        async with SessionLocal() as db:
            user = await db.get(User, user_id)
        if user is None or not user.is_editor:  # blocked, or no longer staff: the session ends
            request.session.clear()
            return False
        request.state.admin_user = user
        return True

    async def get_user_id(self, request: Request):
        return request.session.get("user_id")


class RoleAccess(AuthorizationBackend):
    """Admins may do everything; editors only what EDITOR_VIEWS gives them on content."""

    def has_permission(self, request, identity, action, obj=None):
        user = getattr(request.state, "admin_user", None)
        if user is None:
            return False
        if user.is_admin:
            return True
        return action in EDITOR_VIEWS.get(identity, ())


async def stats():
    now, today = utcnow(), date.today()
    week_ago, month_start = now - timedelta(days=7), today.replace(day=1)
    async with SessionLocal() as db:
        count = lambda query: db.scalar(select(func.count()).select_from(query.subquery()))  # noqa: E731
        open_jobs = select(Job).where(Job.is_active.is_(True), Job.expires_at > now,
                                      Job.employer_id.in_(select(Employer.id).where(Employer.is_blacklisted.is_(False))))
        month_payments = select(Payment).where(Payment.paid_at >= month_start)
        paid = await db.scalar(select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.paid_at >= month_start))
        last_import = await db.scalar(select(func.max(Job.updated_at)))
        cards = [
            ("Корбарон", await count(select(User).where(User.is_active.is_(True))),
             f"+{await count(select(User).where(User.date_joined >= week_ago))} дар 7 рӯз", "user/list", False),
            ("Ҳуҷҷатҳо", await count(select(UserDocument)),
             f"{await count(select(UserDocument).where(UserDocument.expires_at < today))} мӯҳлаташ гузашта", "user-document/list", False),
            ("Тамом мешаванд (30 рӯз)",
             await count(select(UserDocument).where(UserDocument.expires_at >= today, UserDocument.expires_at <= today + timedelta(days=30))),
             f"{await count(select(ReminderLog).where(ReminderLog.sent_at >= week_ago))} ёдраскунӣ дар 7 рӯз", "user-document/list", True),
            ("Пардохтҳо (ин моҳ)", await count(month_payments), f"{int(paid):,} ₽".replace(",", " "), "payment/list", False),
            ("Ҷойҳои кори фаъол", await count(open_jobs),
             f"+{await count(select(Job).where(Job.created_at >= now - timedelta(days=1)))} дар 24 соат", "job/list", False),
            ("Шикоят аз маош (30 рӯз)",
             await count(select(EmployerReview).where(EmployerReview.salary_not_paid.is_(True), EmployerReview.created_at >= now - timedelta(days=30))),
             f"{await count(select(Employer).where(Employer.is_blacklisted.is_(True)))} ширкат дар рӯйхати сиёҳ", "employer-review/list", True),
        ]
        small = [
            ("Ёдраскунӣ ба почта фаъол", await count(select(User).where(User.is_active.is_(True), User.email_reminders.is_(True)))),
            ("Огоҳиҳои кори нав", await count(select(JobAlert).where(JobAlert.is_active.is_(True)))),
            ("Ҷойҳои захирашуда", await count(select(SavedJob))),
            ("Хабарҳои нашршуда", await count(select(LawNews).where(LawNews.is_published.is_(True)))),
            ("Саволҳои имтиҳон", await count(select(ExamQuestion).where(ExamQuestion.is_active.is_(True)))),
            ("Ҷойҳо дар харита", await count(select(Place).where(Place.is_approved.is_(True)))),
            ("Ҷойҳои пешниҳодшуда (интизор)", await count(select(Place).where(Place.is_approved.is_(False)))),
            ("Шарҳҳо дар бораи ҷойҳо", await count(select(PlaceReview))),
            ("Огоҳиҳои нархи чипта", await count(select(FlightWatch).where(FlightWatch.is_active.is_(True)))),
        ]
        jobs_by_city = (await db.execute(
            select(Job.city, func.count()).where(Job.id.in_(open_jobs.with_only_columns(Job.id)))
            .group_by(Job.city).order_by(func.count().desc()).limit(6)
        )).all()
        complaints = (await db.scalars(
            select(EmployerReview).options(selectinload(EmployerReview.employer))
            .where(EmployerReview.salary_not_paid.is_(True)).order_by(EmployerReview.created_at.desc()).limit(5)
        )).unique().all()
        complaints = [(c.employer.name, c.rating, c.text[:120]) for c in complaints]
    return {
        "cards": cards, "small": small, "jobs_by_city": jobs_by_city, "complaints": complaints,
        "last_import": last_import, "import_late": not last_import or now - last_import > timedelta(hours=36),
    }


class MuhojirAdmin(Admin):
    @login_required
    async def index(self, request: Request):
        user = getattr(request.state, "admin_user", None)
        # The numbers (users, payments) are for admins only; editors see just their sections.
        context = {"stats": await stats()} if user is not None and user.is_admin else {}
        return await self.templates.TemplateResponse(request, "dashboard.html", context)


def setup_admin(app):
    admin = MuhojirAdmin(
        app, engine, title="Muhojir", base_url="/admin",
        templates_dir=str(BASE_DIR / "app" / "admin" / "templates"),
        authentication_backend=StaffLogin(secret_key=settings.secret_key, https_only=settings.https),
        authorization_backend=RoleAccess(),
    )
    for view in VIEWS:
        admin.add_view(view)
    return admin
