import re
from typing import Literal

from pydantic import Field, field_validator

from app.schemas.common import Email, Form, normalize_phone


class EmailIn(Form):
    email: Email


class RegisterIn(Form):
    email: Email
    password: str = Field(max_length=128)
    full_name: str = Field("", max_length=150)


class LoginIn(Form):
    email: Email
    password: str


class CodeIn(Form):
    email: Email
    code: str

    @field_validator("code")
    @classmethod
    def six_digits(cls, value):
        if not re.fullmatch(r"\d{6}", value):
            raise ValueError("The code is 6 digits.")
        return value


class ResetPasswordIn(CodeIn):
    password: str = Field(max_length=128)


class RefreshIn(Form):
    refresh: str


class ProfileIn(Form):
    phone: str | None = None
    full_name: str | None = Field(None, max_length=150)
    language: Literal["tg", "ru"] | None = None
    city: str | None = Field(None, max_length=100)
    email_reminders: bool | None = None

    @field_validator("phone")
    @classmethod
    def phone_format(cls, value):
        return normalize_phone(value) if value else None


class NotificationIn(Form):
    is_read: bool | None = None


def user_json(user):
    return {
        "id": user.id, "email": user.email, "phone": user.phone, "full_name": user.full_name, "role": user.role,
        "language": user.language, "city": user.city, "email_reminders": user.email_reminders,
        "date_joined": user.date_joined,
    }
