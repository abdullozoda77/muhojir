from sqladmin import ModelView
from wtforms import PasswordField
from wtforms.validators import Optional

from app.core.security import hash_password, password_problems
from app.models import (
    BlacklistReport, DocumentType, EmailCode, Employer, EmployerReview, ExamQuestion, GuideStep, HelpContact, Job, JobAlert, LawNews,
    MigrationCenter, Notification, Payment, Region, ReminderLog, SavedJob, User, UserDocument,
)
from app.models import PLACE_CATEGORIES, Airport, FlightWatch, Place, PlaceReview
from app.models import PRODUCT_UNITS, SHOP_CATEGORIES, SHOP_STATUSES, Product, Shop, ShopReview
from app.models import Certificate, ExamAttempt, LessonProgress
from app.models import RATE_SOURCES, ExchangeRate
from app.models import FEEDBACK_STATUSES, Feedback
from app.models import HOUSING_FOR, HOUSING_KINDS, HOUSING_STATUSES, Housing

ALL = ("list", "details", "create", "edit", "delete", "export")
EDITOR_VIEWS = {
    "document-type": ("list", "details", "edit"),
    "guide-step": ALL,
    "region": ALL,
    "law-news": ALL,
    "migration-center": ALL,
    "exam-question": ALL,
    "help-contact": ALL,
    "place": ALL,
    "place-review": ("list", "details", "delete"),
    "airport": ALL,
    "shop": ("list", "details", "edit", "delete"),
    "product": ("list", "details", "edit", "delete"),
    "shop-review": ("list", "details", "delete"),
    "certificate": ("list", "details", "edit"),
    "exam-attempt": ("list", "details"),
    "exchange-rate": ("list", "details"),
    "feedback": ("list", "details", "edit", "delete"),
    "housing": ("list", "details", "edit", "delete"),
}


class Base(ModelView):
    page_size = 50
    page_size_options = [25, 50, 100, 200]


class DeletesPrivateFiles:

    async def on_model_delete(self, model, request):
        from sqlalchemy import select

        from app.db.session import SessionLocal

        async with SessionLocal() as db:
            if isinstance(model, User):
                docs = select(UserDocument.photo).where(UserDocument.user_id == model.id)
                pays = select(Payment.receipt).where(Payment.user_id == model.id)
            elif isinstance(model, UserDocument):
                docs = select(UserDocument.photo).where(UserDocument.id == model.id)
                pays = select(Payment.receipt).where(Payment.document_id == model.id)
            else:
                docs = select(UserDocument.photo).where(False)
                pays = select(Payment.receipt).where(Payment.id == model.id)
            request.state.private_files = [*(await db.scalars(docs)).all(), *(await db.scalars(pays)).all()]
            if isinstance(model, User):
                request.state.private_files += (await db.scalars(select(Feedback.photo).where(Feedback.user_id == model.id))).all()

    async def after_model_delete(self, model, request):
        from app.core.files import delete_private

        for name in getattr(request.state, "private_files", []):
            await delete_private(name)


class UserAdmin(DeletesPrivateFiles, Base, model=User):
    name, name_plural, icon, category = "Корбар", "Корбарон", "fa-solid fa-user", "Корбарон"
    column_list = [User.email, User.full_name, User.phone, User.role, User.city, User.is_active, User.date_joined]
    column_searchable_list = [User.email, User.phone, User.full_name, User.city]
    column_sortable_list = [User.email, User.date_joined, User.role]
    column_default_sort = [(User.date_joined, True)]
    form_columns = [User.email, User.full_name, User.phone, User.role, User.language, User.city, User.email_reminders,
                    User.email_verified, User.is_active, User.is_superuser]
    form_choices = {"role": [(r, r) for r in User.ROLES], "language": [("tg", "Тоҷикӣ"), ("ru", "Русский")]}
    column_details_exclude_list = [User.password_hash]
    form_args = {"phone": {"filters": [lambda value: value or None]}}

    async def scaffold_form(self, rules=None):
        form = await super().scaffold_form(rules)
        form.new_password = PasswordField("Пароли нав (холӣ = бе тағйир)", validators=[Optional()])
        return form

    async def on_model_change(self, data, model, is_created, request):
        password = data.pop("new_password", None)
        if data.get("email"):
            data["email"] = data["email"].strip().lower()
        if password:
            problems = password_problems(password, data.get("email") or model.email or "")
            if problems:
                raise ValueError(" ".join(problems))
            model.password_hash = hash_password(password)


class NotificationAdmin(Base, model=Notification):
    name, name_plural, icon, category = "Огоҳӣ", "Огоҳиҳо", "fa-solid fa-bell", "Корбарон"
    column_list = [Notification.title, Notification.user, Notification.kind, Notification.is_read, Notification.created_at]
    column_searchable_list = [Notification.title]
    column_default_sort = [(Notification.created_at, True)]
    form_columns = [Notification.user, Notification.kind, Notification.title, Notification.message, Notification.is_read]
    form_choices = {"kind": [(k, k) for k in Notification.KINDS]}

    async def after_model_change(self, data, model, is_created, request):
        if is_created:
            from app.db.session import SessionLocal
            from app.services.emails import queue_email
            from app.services.live import push_new

            async with SessionLocal() as db:
                notification = await db.get(Notification, model.id)
                user = await db.get(User, notification.user_id)
                await push_new(db, notification)
            if user.email_reminders:
                try:
                    await queue_email(f"Muhojir — {model.title}", model.message, user.email)
                except OSError:
                    pass


class EmailCodeAdmin(Base, model=EmailCode):
    name, name_plural, icon, category = "Рамзи почта", "Рамзҳои почта", "fa-solid fa-key", "Корбарон"
    column_list = [EmailCode.email, EmailCode.purpose, EmailCode.sent_at, EmailCode.attempts]
    can_create = can_edit = False


class DocumentTypeAdmin(Base, model=DocumentType):
    name, name_plural, icon, category = "Навъи ҳуҷҷат", "Навъҳои ҳуҷҷат", "fa-solid fa-id-card", "Ҳуҷҷатҳо ва роҳнамо"
    column_list = [DocumentType.title, DocumentType.slug, DocumentType.default_validity_days, DocumentType.order]
    column_default_sort = [(DocumentType.order, False)]
    form_columns = [DocumentType.title, DocumentType.slug, DocumentType.description, DocumentType.default_validity_days, DocumentType.order]


class GuideStepAdmin(Base, model=GuideStep):
    name, name_plural, icon, category = "Қадами роҳнамо", "Қадамҳои роҳнамо", "fa-solid fa-list-ol", "Ҳуҷҷатҳо ва роҳнамо"
    column_list = [GuideStep.document_type, GuideStep.order, GuideStep.title, GuideStep.where]
    column_searchable_list = [GuideStep.title, GuideStep.body]
    column_default_sort = [(GuideStep.document_type_id, False), (GuideStep.order, False)]
    form_columns = [GuideStep.document_type, GuideStep.order, GuideStep.title, GuideStep.body, GuideStep.where,
                    GuideStep.required_papers, GuideStep.cost_note, GuideStep.deadline_note, GuideStep.official_url,
                    GuideStep.example]


class RegionAdmin(Base, model=Region):
    name, name_plural, icon, category = "Минтақа", "Минтақаҳо (нархи патент)", "fa-solid fa-map", "Ҳуҷҷатҳо ва роҳнамо"
    column_list = [Region.name, Region.patent_monthly_price, Region.price_year]
    column_searchable_list = [Region.name]
    column_sortable_list = [Region.name, Region.patent_monthly_price]
    column_default_sort = [(Region.name, False)]
    form_columns = [Region.name, Region.patent_monthly_price, Region.price_year]


class MigrationCenterAdmin(Base, model=MigrationCenter):
    name, name_plural, icon, category = "Маркази муҳоҷират", "Марказҳои муҳоҷират", "fa-solid fa-building", "Ҳуҷҷатҳо ва роҳнамо"
    column_list = [MigrationCenter.name, MigrationCenter.region, MigrationCenter.address, MigrationCenter.working_hours, MigrationCenter.order]
    column_searchable_list = [MigrationCenter.name, MigrationCenter.address]
    form_columns = [MigrationCenter.region, MigrationCenter.name, MigrationCenter.address, MigrationCenter.working_hours,
                    MigrationCenter.phone, MigrationCenter.website, MigrationCenter.order]


class LawNewsAdmin(Base, model=LawNews):
    name, name_plural, icon, category = "Хабари қонун", "Хабарҳои қонун", "fa-solid fa-newspaper", "Ҳуҷҷатҳо ва роҳнамо"
    column_list = [LawNews.title, LawNews.is_published, LawNews.published_at]
    column_searchable_list = [LawNews.title, LawNews.summary]
    column_default_sort = [(LawNews.published_at, True)]
    form_columns = [LawNews.title, LawNews.summary, LawNews.body, LawNews.source_url, LawNews.document_types,
                    LawNews.is_published, LawNews.published_at]

    async def on_model_change(self, data, model, is_created, request):
        from app.db.types import utcnow

        if is_created and getattr(request.state, "admin_user", None):
            model.created_by_id = request.state.admin_user.id
        if data.get("is_published") and not data.get("published_at"):
            data["published_at"] = utcnow()


class ExamQuestionAdmin(Base, model=ExamQuestion):
    name, name_plural, icon, category = "Саволи имтиҳон", "Саволҳои имтиҳон", "fa-solid fa-graduation-cap", "Ҳуҷҷатҳо ва роҳнамо"
    column_list = [ExamQuestion.question, ExamQuestion.section, ExamQuestion.answer, ExamQuestion.is_active, ExamQuestion.order]
    column_searchable_list = [ExamQuestion.question]
    column_default_sort = [(ExamQuestion.section, False), (ExamQuestion.order, False)]
    form_columns = [ExamQuestion.section, ExamQuestion.question, ExamQuestion.listen_text, ExamQuestion.options,
                    ExamQuestion.answer, ExamQuestion.explanation, ExamQuestion.is_active, ExamQuestion.order]
    form_choices = {"section": [("language", "Забони русӣ"), ("history", "Таърихи Русия"), ("law", "Асосҳои қонун")]}

    async def on_model_change(self, data, model, is_created, request):
        options = data.get("options")
        if not isinstance(options, list) or len(options) < 2:
            raise ValueError("Give at least two answers.")
        if data.get("answer") is not None and int(data["answer"]) >= len(options):
            raise ValueError("The right answer must be one of the options.")


class UserDocumentAdmin(DeletesPrivateFiles, Base, model=UserDocument):
    name, name_plural, icon, category = "Ҳуҷҷати корбар", "Ҳуҷҷатҳои корбарон", "fa-solid fa-file", "Ҳуҷҷатҳо ва роҳнамо"
    column_list = [UserDocument.user, UserDocument.document_type, UserDocument.expires_at, UserDocument.region]
    column_searchable_list = [UserDocument.number]
    column_default_sort = [(UserDocument.expires_at, False)]
    form_excluded_columns = [UserDocument.photo, UserDocument.created_at, UserDocument.updated_at]


class PaymentAdmin(DeletesPrivateFiles, Base, model=Payment):
    name, name_plural, icon, category = "Пардохт", "Пардохтҳо", "fa-solid fa-receipt", "Ҳуҷҷатҳо ва роҳнамо"
    column_list = [Payment.document, Payment.user, Payment.months, Payment.amount, Payment.paid_at]
    column_default_sort = [(Payment.paid_at, True)]
    column_details_exclude_list = [Payment.receipt]
    form_excluded_columns = [Payment.receipt, Payment.created_at]


class ReminderLogAdmin(Base, model=ReminderLog):
    name, name_plural, icon, category = "Ёдраскунӣ", "Ёдраскуниҳои фиристода", "fa-solid fa-clock", "Ҳуҷҷатҳо ва роҳнамо"
    column_list = [ReminderLog.user_document, ReminderLog.days_before, ReminderLog.expires_at, ReminderLog.sent_at]
    column_default_sort = [(ReminderLog.sent_at, True)]
    can_create = can_edit = False


class EmployerAdmin(Base, model=Employer):
    name, name_plural, icon, category = "Корфармо", "Корфармоён", "fa-solid fa-industry", "Кор"
    column_list = [Employer.name, Employer.city, Employer.is_verified, Employer.is_blacklisted, Employer.reports_count, Employer.created_at]
    column_searchable_list = [Employer.name, Employer.inn]
    column_sortable_list = [Employer.name, Employer.created_at]
    form_excluded_columns = [Employer.created_at, Employer.reports_count]


class JobAdmin(Base, model=Job):
    name, name_plural, icon, category = "Ҷойи кор", "Ҷойҳои кор", "fa-solid fa-briefcase", "Кор"
    column_list = [Job.title, Job.employer, Job.city, Job.industry, Job.salary_from, Job.salary_to, Job.is_active, Job.expires_at]
    column_searchable_list = [Job.title, Job.city]
    column_sortable_list = [Job.title, Job.salary_from, Job.created_at]
    column_default_sort = [(Job.created_at, True)]
    form_excluded_columns = [Job.created_at, Job.updated_at]


class EmployerReviewAdmin(Base, model=EmployerReview):
    name, name_plural, icon, category = "Шарҳ", "Шарҳҳо дар бораи корфармо", "fa-solid fa-star", "Кор"
    column_list = [EmployerReview.employer, EmployerReview.author, EmployerReview.rating, EmployerReview.salary_not_paid, EmployerReview.created_at]
    column_default_sort = [(EmployerReview.created_at, True)]
    form_excluded_columns = [EmployerReview.created_at]


class BlacklistReportAdmin(Base, model=BlacklistReport):
    name, name_plural, icon, category = "Шикоят", "Шикоятҳо (рӯйхати сиёҳ)", "fa-solid fa-ban", "Кор"
    column_list = [BlacklistReport.employer, BlacklistReport.job, BlacklistReport.author, BlacklistReport.reason, BlacklistReport.created_at]
    column_searchable_list = [BlacklistReport.reason]
    column_default_sort = [(BlacklistReport.created_at, True)]
    can_create = can_edit = False

    async def after_model_delete(self, model, request):
        from sqlalchemy import func, select

        from app.db.session import SessionLocal
        async with SessionLocal() as db:
            employer = await db.get(Employer, model.employer_id)
            if employer is not None:
                employer.reports_count = await db.scalar(select(func.count()).where(BlacklistReport.employer_id == employer.id))
                await db.commit()


class JobAlertAdmin(Base, model=JobAlert):
    name, name_plural, icon, category = "Огоҳии кор", "Огоҳиҳои кори нав", "fa-solid fa-bullhorn", "Кор"
    column_list = [JobAlert.user, JobAlert.search, JobAlert.city, JobAlert.industry, JobAlert.min_salary, JobAlert.is_active]
    form_excluded_columns = [JobAlert.created_at]


class SavedJobAdmin(Base, model=SavedJob):
    name, name_plural, icon, category = "Ҷойи захирашуда", "Ҷойҳои захирашуда", "fa-solid fa-heart", "Кор"
    column_list = [SavedJob.user, SavedJob.job, SavedJob.created_at]
    can_create = can_edit = False


class HelpContactAdmin(Base, model=HelpContact):
    name, name_plural, icon, category = "Сайти ёрӣ", "Сайтҳо ва тамосҳои ёрӣ", "fa-solid fa-life-ring", "Ёрӣ"
    column_list = [HelpContact.title, HelpContact.kind, HelpContact.website, HelpContact.order, HelpContact.is_active]
    column_searchable_list = [HelpContact.title, HelpContact.description]
    column_default_sort = [(HelpContact.order, False)]
    form_columns = [HelpContact.kind, HelpContact.title, HelpContact.website, HelpContact.phone, HelpContact.description,
                    HelpContact.region, HelpContact.order, HelpContact.is_active]
    form_choices = {"kind": [(k, k) for k in HelpContact.KINDS]}


class PlaceAdmin(Base, model=Place):
    name, name_plural, icon, category = "Ҷой", "Ҷойҳои муфид (харита)", "fa-solid fa-location-dot", "Ҷойҳо ва чиптаҳо"
    column_list = [Place.name, Place.category, Place.region, Place.address, Place.source, Place.is_approved]
    column_searchable_list = [Place.name, Place.address, Place.city]
    column_sortable_list = [Place.name, Place.region, Place.created_at]
    column_default_sort = [(Place.is_approved, False), (Place.created_at, True)]
    form_columns = [Place.category, Place.name, Place.region, Place.city, Place.address, Place.lat, Place.lon,
                    Place.phone, Place.website, Place.opening_hours, Place.description, Place.is_approved,
                    Place.reject_reason]
    form_choices = {"category": [(c, c) for c in PLACE_CATEGORIES]}

    async def on_model_change(self, data, model, is_created, request):
        approved = data.get("is_approved")
        reason = (data.get("reject_reason") or "").strip()
        request.state.tell_author = not is_created and model.created_by_id and (
            (approved and not model.is_approved) or (not approved and reason and reason != model.reject_reason))
        if approved:
            data["reject_reason"] = ""

    async def after_model_change(self, data, model, is_created, request):
        if getattr(request.state, "tell_author", False):
            from app.db.session import SessionLocal
            from app.routers.places import tell_author

            async with SessionLocal() as db:
                await tell_author(db, await db.get(Place, model.id))

    async def on_model_delete(self, model, request):
        request.state.place_proof = model.proof

    async def after_model_delete(self, model, request):
        from app.core.files import delete_private

        await delete_private(getattr(request.state, "place_proof", ""))


class PlaceReviewAdmin(Base, model=PlaceReview):
    name, name_plural, icon, category = "Шарҳи ҷой", "Шарҳҳо дар бораи ҷойҳо", "fa-solid fa-comment", "Ҷойҳо ва чиптаҳо"
    column_list = [PlaceReview.place, PlaceReview.author, PlaceReview.rating, PlaceReview.text, PlaceReview.created_at]
    column_default_sort = [(PlaceReview.created_at, True)]
    can_create = can_edit = False


class AirportAdmin(Base, model=Airport):
    name, name_plural, icon, category = "Фурудгоҳ", "Фурудгоҳҳо", "fa-solid fa-plane", "Ҷойҳо ва чиптаҳо"
    column_list = [Airport.code, Airport.city, Airport.city_tg, Airport.name, Airport.country, Airport.is_active]
    column_searchable_list = [Airport.code, Airport.city, Airport.name]
    column_default_sort = [(Airport.country, True), (Airport.order, False)]
    form_choices = {"country": [("TJ", "Тоҷикистон"), ("RU", "Русия")]}


class FlightWatchAdmin(Base, model=FlightWatch):
    name, name_plural, icon, category = "Огоҳии чипта", "Огоҳиҳои нархи чипта", "fa-solid fa-bell", "Ҷойҳо ва чиптаҳо"
    column_list = [FlightWatch.user, FlightWatch.origin, FlightWatch.destination, FlightWatch.month, FlightWatch.max_price,
                   FlightWatch.last_price, FlightWatch.is_active]
    can_create = False


class ShopAdmin(Base, model=Shop):
    name, name_plural, icon, category = "Мағоза", "Мағозаҳо", "fa-solid fa-store", "Мағозаҳо"
    column_list = [Shop.name, Shop.category, Shop.city, Shop.owner, Shop.status, Shop.created_at]
    column_searchable_list = [Shop.name, Shop.city, Shop.address, Shop.phone]
    column_sortable_list = [Shop.name, Shop.city, Shop.status, Shop.created_at]
    column_default_sort = [(Shop.created_at, True)]
    form_columns = [Shop.status, Shop.reject_reason, Shop.name, Shop.category, Shop.description, Shop.city,
                    Shop.address, Shop.lat, Shop.lon, Shop.phone, Shop.whatsapp, Shop.telegram, Shop.opening_hours,
                    Shop.delivery]
    form_choices = {"status": [(st, st) for st in SHOP_STATUSES],
                    "category": [(c, label) for c, label in SHOP_CATEGORIES.items()]}
    can_create = False

    async def on_model_change(self, data, model, is_created, request):
        request.state.status_changed = data.get("status") not in (None, model.status)
        if data.get("status") == "rejected" and not (data.get("reject_reason") or "").strip():
            raise ValueError("Write why the shop is rejected.")
        if data.get("status") == "approved":
            data["reject_reason"] = ""

    async def after_model_change(self, data, model, is_created, request):
        if getattr(request.state, "status_changed", False):
            from app.db.session import SessionLocal
            from app.services.market import tell_owner

            async with SessionLocal() as db:
                await tell_owner(db, await db.get(Shop, model.id))

    async def on_model_delete(self, model, request):
        from app.db.session import SessionLocal
        from app.services.market import shop_files

        async with SessionLocal() as db:
            request.state.shop_files = await shop_files(db, model)

    async def after_model_delete(self, model, request):
        from app.services.market import delete_files

        await delete_files(getattr(request.state, "shop_files", []))


class ProductAdmin(Base, model=Product):
    name, name_plural, icon, category = "Мол", "Молҳо", "fa-solid fa-basket-shopping", "Мағозаҳо"
    column_list = [Product.name, Product.shop, Product.price, Product.unit, Product.in_stock, Product.created_at]
    column_searchable_list = [Product.name]
    column_sortable_list = [Product.name, Product.price, Product.created_at]
    column_default_sort = [(Product.created_at, True)]
    form_columns = [Product.name, Product.description, Product.price, Product.unit, Product.in_stock]
    form_choices = {"unit": [(u, u) for u in PRODUCT_UNITS]}
    can_create = False

    async def after_model_delete(self, model, request):
        from app.core.files import delete_image
        from app.services.market import PHOTOS

        await delete_image(model.photo, PHOTOS)


class ShopReviewAdmin(Base, model=ShopReview):
    name, name_plural, icon, category = "Шарҳи мағоза", "Шарҳҳо дар бораи мағозаҳо", "fa-solid fa-comment", "Мағозаҳо"
    column_list = [ShopReview.shop, ShopReview.author, ShopReview.rating, ShopReview.text, ShopReview.created_at]
    column_default_sort = [(ShopReview.created_at, True)]
    can_create = can_edit = False


class CertificateAdmin(Base, model=Certificate):
    name, name_plural, icon, category = "Сертификат", "Сертификатҳо", "fa-solid fa-award", "Курси забони русӣ"
    column_list = [Certificate.number, Certificate.full_name, Certificate.level, Certificate.percent,
                   Certificate.issued_at, Certificate.is_revoked]
    column_searchable_list = [Certificate.number, Certificate.full_name, Certificate.code]
    column_default_sort = [(Certificate.issued_at, True)]
    form_columns = [Certificate.full_name, Certificate.is_revoked]
    can_create = False


class ExamAttemptAdmin(Base, model=ExamAttempt):
    name, name_plural, icon, category = "Имтиҳон", "Имтиҳонҳо", "fa-solid fa-file-pen", "Курси забони русӣ"
    column_list = [ExamAttempt.user, ExamAttempt.level, ExamAttempt.score, ExamAttempt.passed, ExamAttempt.started_at,
                   ExamAttempt.finished_at]
    column_default_sort = [(ExamAttempt.started_at, True)]
    can_create = can_edit = False


class LessonProgressAdmin(Base, model=LessonProgress):
    name, name_plural, icon, category = "Дарси хатмшуда", "Дарсҳои хатмшуда", "fa-solid fa-book-open", "Курси забони русӣ"
    column_list = [LessonProgress.user, LessonProgress.level, LessonProgress.number, LessonProgress.score,
                   LessonProgress.completed_at]
    column_default_sort = [(LessonProgress.completed_at, True)]
    can_create = can_edit = False


class ExchangeRateAdmin(Base, model=ExchangeRate):
    name, name_plural, icon, category = "Қурби расмӣ", "Қурбҳои расмӣ", "fa-solid fa-chart-line", "Қурби рубл"
    column_list = [ExchangeRate.source, ExchangeRate.day, ExchangeRate.value, ExchangeRate.fetched_at]
    column_sortable_list = [ExchangeRate.day]
    column_default_sort = [(ExchangeRate.day, True)]
    column_formatters = {"source": lambda m, a: RATE_SOURCES.get(m.source, m.source)}
    can_create = can_edit = False


class FeedbackAdmin(Base, model=Feedback):
    name, name_plural, icon, category = "Фикр", "Фикру мулоҳизаҳо", "fa-solid fa-comments", "Корбарон"
    column_list = [Feedback.kind, Feedback.rating, Feedback.message, Feedback.user, Feedback.status, Feedback.created_at]
    column_searchable_list = [Feedback.message]
    column_sortable_list = [Feedback.created_at, Feedback.status, Feedback.rating]
    column_default_sort = [(Feedback.created_at, True)]
    column_formatters = {"kind": lambda m, a: m.kind_label, "message": lambda m, a: m.message[:120] + (" 📷" if m.photo else "")}
    form_columns = [Feedback.status, Feedback.reply]
    form_choices = {"status": [(st, st) for st in FEEDBACK_STATUSES]}
    can_create = False

    async def on_model_change(self, data, model, is_created, request):
        request.state.new_reply = bool((data.get("reply") or "").strip()) and data.get("reply") != model.reply

    async def after_model_change(self, data, model, is_created, request):
        if getattr(request.state, "new_reply", False):
            from app.db.session import SessionLocal
            from app.services.feedback import send_reply

            async with SessionLocal() as db:
                await send_reply(db, await db.get(Feedback, model.id))

    async def after_model_delete(self, model, request):
        from app.core.files import delete_private

        await delete_private(model.photo)


class HousingAdmin(Base, model=Housing):
    name, name_plural, icon, category = "Манзил", "Манзил", "fa-solid fa-bed", "Мағозаҳо"
    column_list = [Housing.title, Housing.kind, Housing.city, Housing.price, Housing.owner, Housing.status, Housing.is_active,
                   Housing.created_at]
    column_searchable_list = [Housing.title, Housing.city, Housing.address, Housing.phone]
    column_sortable_list = [Housing.price, Housing.city, Housing.status, Housing.created_at]
    column_default_sort = [(Housing.created_at, True)]
    column_formatters = {"kind": lambda m, a: m.kind_label}
    form_columns = [Housing.status, Housing.reject_reason, Housing.is_active, Housing.kind, Housing.title, Housing.description,
                    Housing.city, Housing.address, Housing.metro, Housing.price, Housing.period, Housing.rooms, Housing.places,
                    Housing.for_whom, Housing.registration, Housing.utilities_included, Housing.no_deposit, Housing.phone,
                    Housing.whatsapp, Housing.telegram]
    form_choices = {"status": [(st, st) for st in HOUSING_STATUSES],
                    "kind": [(k, label) for k, label in HOUSING_KINDS.items()],
                    "for_whom": [(k, label) for k, label in HOUSING_FOR.items()],
                    "period": [("month", "month"), ("day", "day")]}
    can_create = False

    async def on_model_change(self, data, model, is_created, request):
        request.state.status_changed = data.get("status") not in (None, model.status)
        if data.get("status") == "rejected" and not (data.get("reject_reason") or "").strip():
            raise ValueError("Write why the listing is rejected.")
        if data.get("status") == "approved":
            data["reject_reason"] = ""

    async def after_model_change(self, data, model, is_created, request):
        if getattr(request.state, "status_changed", False) and model.status != "pending":
            from app.db.session import SessionLocal
            from app.routers.housing import tell_owner

            async with SessionLocal() as db:
                await tell_owner(db, await db.get(Housing, model.id))

    async def on_model_delete(self, model, request):
        request.state.housing_files = [p.file for p in model.photos]

    async def after_model_delete(self, model, request):
        from app.core.files import delete_image

        for name in getattr(request.state, "housing_files", []):
            await delete_image(name, "housing")


VIEWS = [
    UserAdmin, NotificationAdmin, EmailCodeAdmin,
    DocumentTypeAdmin, GuideStepAdmin, RegionAdmin, MigrationCenterAdmin, LawNewsAdmin, ExamQuestionAdmin,
    UserDocumentAdmin, PaymentAdmin, ReminderLogAdmin,
    EmployerAdmin, JobAdmin, EmployerReviewAdmin, BlacklistReportAdmin, JobAlertAdmin, SavedJobAdmin,
    HelpContactAdmin,
    PlaceAdmin, PlaceReviewAdmin, AirportAdmin, FlightWatchAdmin,
    ShopAdmin, ProductAdmin, ShopReviewAdmin,
    CertificateAdmin, ExamAttemptAdmin, LessonProgressAdmin,
    ExchangeRateAdmin, FeedbackAdmin, HousingAdmin,
]
