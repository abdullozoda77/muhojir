from sqladmin import ModelView
from wtforms import PasswordField
from wtforms.validators import Optional

from app.core.security import hash_password, password_problems
from app.models import (
    BlacklistReport, DocumentType, EmailCode, Employer, EmployerReview, ExamQuestion, GuideStep, HelpContact, Job, JobAlert, LawNews,
    LegalQuestion, MigrationCenter, Notification, Payment, Region, ReminderLog, SavedJob, User, UserDocument,
)
from app.models import PLACE_CATEGORIES, Airport, FlightWatch, Place, PlaceReview
from app.models import PRODUCT_UNITS, SHOP_CATEGORIES, SHOP_STATUSES, Product, Shop, ShopReview

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


class LegalQuestionAdmin(Base, model=LegalQuestion):
    name, name_plural, icon, category = "Саволи ҳуқуқӣ", "Саволҳо ба ҳуқуқшинос", "fa-solid fa-scale-balanced", "Ёрӣ"
    column_list = [LegalQuestion.question, LegalQuestion.user, LegalQuestion.status, LegalQuestion.created_at]
    column_default_sort = [(LegalQuestion.created_at, True)]
    form_columns = [LegalQuestion.status, LegalQuestion.answer]
    form_choices = {"status": [(s, s) for s in LegalQuestion.STATUSES]}
    can_create = False

    async def on_model_change(self, data, model, is_created, request):
        request.state.new_answer = (data.get("answer") or "").strip() and data.get("answer") != model.answer
        if request.state.new_answer:
            from app.db.types import utcnow

            data["status"] = "answered"
            model.answered_at = utcnow()
            model.answered_by_id = request.state.admin_user.id

    async def after_model_change(self, data, model, is_created, request):
        if getattr(request.state, "new_answer", False):
            from app.db.session import SessionLocal
            from app.services.notify import notify

            async with SessionLocal() as db:
                user = await db.get(User, model.user_id)
                await notify(db, user, "Ҷавоби ҳуқуқшинос", f"Ба саволи шумо ҷавоб доданд:\n\n{model.answer}", kind="system")


class PlaceAdmin(Base, model=Place):
    name, name_plural, icon, category = "Ҷой", "Ҷойҳои муфид (харита)", "fa-solid fa-location-dot", "Ҷойҳо ва чиптаҳо"
    column_list = [Place.name, Place.category, Place.region, Place.address, Place.source, Place.is_approved]
    column_searchable_list = [Place.name, Place.address, Place.city]
    column_sortable_list = [Place.name, Place.region, Place.created_at]
    column_default_sort = [(Place.is_approved, False), (Place.created_at, True)]
    form_columns = [Place.category, Place.name, Place.region, Place.city, Place.address, Place.lat, Place.lon,
                    Place.phone, Place.website, Place.opening_hours, Place.description, Place.is_approved]
    form_choices = {"category": [(c, c) for c in PLACE_CATEGORIES]}


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


VIEWS = [
    UserAdmin, NotificationAdmin, EmailCodeAdmin,
    DocumentTypeAdmin, GuideStepAdmin, RegionAdmin, MigrationCenterAdmin, LawNewsAdmin, ExamQuestionAdmin,
    UserDocumentAdmin, PaymentAdmin, ReminderLogAdmin,
    EmployerAdmin, JobAdmin, EmployerReviewAdmin, BlacklistReportAdmin, JobAlertAdmin, SavedJobAdmin,
    HelpContactAdmin, LegalQuestionAdmin,
    PlaceAdmin, PlaceReviewAdmin, AirportAdmin, FlightWatchAdmin,
    ShopAdmin, ProductAdmin, ShopReviewAdmin,
]
