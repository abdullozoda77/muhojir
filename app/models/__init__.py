"""All tables; importing this module registers every model with Base (Alembic and the admin need that)."""
from app.models.accounts import EmailCode, Notification, RevokedToken, User
from app.models.documents import (
    DocumentType, ExamQuestion, GuideStep, LawNews, MigrationCenter, Payment, Region, ReminderLog, UserDocument,
    add_months, law_news_document_types,
)
from app.models.jobs import INDUSTRIES, BlacklistReport, Employer, EmployerReview, Job, JobAlert, SavedJob
from app.models.places import PLACE_CATEGORIES, Place, PlaceReview
from app.models.support import HelpContact, LegalQuestion
from app.models.travel import AIRLINES, Airport, FlightWatch

__all__ = [
    "User", "EmailCode", "Notification", "RevokedToken",
    "DocumentType", "GuideStep", "Region", "UserDocument", "Payment", "MigrationCenter", "ReminderLog", "LawNews",
    "ExamQuestion", "law_news_document_types",
    "INDUSTRIES", "Employer", "Job", "EmployerReview", "SavedJob", "JobAlert", "BlacklistReport",
    "HelpContact", "LegalQuestion",
    "AIRLINES", "Airport", "FlightWatch",
    "PLACE_CATEGORIES", "Place", "PlaceReview",
]
