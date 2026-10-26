from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime, utcnow


class User(Base):

    __tablename__ = "users"

    ROLES = ("migrant", "editor", "admin")
    LANGUAGES = ("tg", "ru")

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), default="")
    phone: Mapped[str | None] = mapped_column(String(16), unique=True)
    full_name: Mapped[str] = mapped_column(String(150), default="")
    role: Mapped[str] = mapped_column(String(20), default="migrant")
    language: Mapped[str] = mapped_column(String(2), default="tg")
    city: Mapped[str] = mapped_column(String(100), default="")
    avatar: Mapped[str] = mapped_column(String(100), default="", server_default="")
    email_reminders: Mapped[bool] = mapped_column(Boolean, default=True)
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
        return self.is_active and (self.role == "editor" or self.is_admin)

    def __str__(self):
        return self.full_name or self.email


class EmailCode(Base):

    __tablename__ = "email_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    purpose: Mapped[str] = mapped_column(String(10), default="verify")
    code_hash: Mapped[str] = mapped_column(String(255))
    sent_at: Mapped[datetime] = mapped_column(UTCDateTime)
    attempts: Mapped[int] = mapped_column(Integer, default=0)

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

    __tablename__ = "revoked_tokens"

    jti: Mapped[str] = mapped_column(String(64), primary_key=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime, index=True)
