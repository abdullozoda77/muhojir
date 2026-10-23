"""Errors in the same shape as the Django REST Framework version, which the site already understands:
{"detail": "..."} (sometimes with "code"), or {"field": ["message", ...]} for wrong form fields."""
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ApiError(Exception):
    """raise ApiError("Wrong code.") -> 400 {"detail": "Wrong code."}"""

    def __init__(self, detail, status_code=400, **extra):
        self.status_code = status_code
        self.body = {"detail": detail, **extra} if isinstance(detail, str) else detail


class FieldError(ApiError):
    """raise FieldError("expires_at", "The end date must be after the issue date.") -> 400 {"expires_at": [...]}"""

    def __init__(self, field, message, status_code=400):
        super().__init__({field: [message]}, status_code)


DRF_MESSAGES = {
    "missing": "Обязательное поле.",
    "string_too_long": "Слишком длинное значение.",
    "int_parsing": "Введите правильное число.",
    "decimal_parsing": "Введите правильное число.",
    "float_parsing": "Введите правильное число.",
    "date_from_datetime_parsing": "Неправильный формат date. Используйте формат YYYY-MM-DD.",
    "date_parsing": "Неправильный формат date. Используйте формат YYYY-MM-DD.",
    "bool_parsing": "Должно быть булево значение.",
    "literal_error": "Значения нет среди допустимых вариантов.",
    "enum": "Значения нет среди допустимых вариантов.",
    "value_error": None,  # our own validators: their message is used as it is
}


def _message(error):
    text = DRF_MESSAGES.get(error["type"], "")
    if text:
        return text
    message = error.get("msg", "")
    return message.removeprefix("Value error, ")


async def api_error_handler(request: Request, error: ApiError):
    return JSONResponse(error.body, status_code=error.status_code)


async def validation_error_handler(request: Request, error: RequestValidationError):
    fields = {}
    for item in error.errors():
        loc = [str(part) for part in item["loc"] if part not in ("body", "query", "path", "form")]
        field = loc[0] if loc else "non_field_errors"
        if field.isdigit():
            field = "non_field_errors"
        fields.setdefault(field, []).append(_message(item))
    return JSONResponse(fields, status_code=400)


async def http_error_handler(request: Request, error: StarletteHTTPException):
    detail = error.detail if error.status_code != 404 or error.detail != "Not Found" else "Страница не найдена."
    return JSONResponse({"detail": detail}, status_code=error.status_code, headers=getattr(error, "headers", None))
