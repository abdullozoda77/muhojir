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
    digits = re.sub(r"\D", "", value or "")
    if len(digits) == 11 and digits.startswith("8"):
        digits = "7" + digits[1:]
    if not 10 <= len(digits) <= 15:
        raise ValueError("Enter the phone number with the country code, e.g. +79991234567.")
    return "+" + digits


class Form(BaseModel):

    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)
