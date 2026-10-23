import re
from typing import Annotated

from email_validator import EmailNotValidError, validate_email
from pydantic import AfterValidator, BaseModel, ConfigDict


def _email(value: str) -> str:
    value = value.strip().lower()
    try:
        validate_email(value, check_deliverability=False)
    except EmailNotValidError:
        raise ValueError("Введите правильный адрес электронной почты.")
    return value


Email = Annotated[str, AfterValidator(_email)]


def normalize_phone(value):
    """"+7 (999) 123-45-67" -> "+79991234567". Russian (+7) and Tajik (+992) numbers are the usual ones,
    but any international number with 10-15 digits is accepted."""
    digits = re.sub(r"\D", "", value or "")
    # People in Russia often type 8XXXXXXXXXX instead of +7XXXXXXXXXX.
    if len(digits) == 11 and digits.startswith("8"):
        digits = "7" + digits[1:]
    if not 10 <= len(digits) <= 15:
        raise ValueError("Enter the phone number with the country code, e.g. +79991234567.")
    return "+" + digits


class Form(BaseModel):
    """Request bodies: unknown fields are ignored (like DRF), surrounding spaces of text are trimmed."""

    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)
