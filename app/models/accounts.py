from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, utcnow


class User(Base):
    """migrant: documents, reminders, payments, reviews of companies.
    editor: also the site's content (news, guides, exam questions, help sites, centers, patent prices),
            in the admin panel and through the API; no access to users, their documents or payments.
    admin: everything, including users, roles and the blacklist of companies."""

    __tablename__ = "users"

    ROLES = ("migrant", "editor", "admin")
    LANGUAGES = ("tg", "ru")

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), default="")  # "" = no password (can not log in with one)
    phone: Mapped[str | None] = mapped_column(String(16), unique=True)  # optional contact number, not for login
    full_name: Mapped[str] = mapped_column(String(150), default="")
    role: Mapped[str] = mapped_column(String(20), default="migrant")
    language: Mapped[str] = mapped_column(String(2), default="tg")
    # City in Russia where the person lives now; jobs and news are shown for it first.
    city: Mapped[str] = mapped_column(String(100), default="")
    email_reminders: Mapped[bool] = mapped_column(Boolean, default=True)
    # Sign-up is finished only when the code sent to the email is entered; until then login is refused.
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)
    date_joined: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    notifications: Mapped[list["Notification"]] = relationship(back_populates="user", cascade="all, delete-orphan", passive_deletes=True)

    @property
    def is_admin(self):
        return self.is_superuser or self.role == "admin"

    @property
    def is_editor(self):
        """Editors manage the site's content; admins too."""
        return self.is_active and (self.role == "editor" or self.is_admin)

    def __str__(self):
        return self.full_name or self.email


class EmailCode(Base):
    """A 6-digit code sent by email: to confirm the email after sign-up ("verify") or to set a new password
    ("reset"). Only a hash is stored, like a password; asking for a new code replaces the old one."""

    __tablename__ = "email_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    purpose: Mapped[str] = mapped_column(String(10), default="verify")
    code_hash: Mapped[str] = mapped_column(String(255))
    sent_at: Mapped[datetime] = mapped_column(UTCDateTime)
    attempts: Mapped[int] = mapped_column(Integer, default=0)  # wrong tries with this code

    def __str__(self):
        return self.email


class Notification(Base):
    __tablename__ = "notifications"

    KINDS = ("reminder", "job", "news", "system")

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20), default="system")
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)

    user: Mapped[User] = relationship(back_populates="notifications")

    def __str__(self):
        return self.title


class RevokedToken(Base):
    """Refresh tokens that can not be used again: after logout, and the old one after each refresh."""

    __tablename__ = "revoked_tokens"

    jti: Mapped[str] = mapped_column(String(64), primary_key=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime, index=True)  # can be deleted after this
