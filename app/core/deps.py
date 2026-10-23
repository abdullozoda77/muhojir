"""Who is asking. Like the Django version: no Authorization header = a guest; a broken or expired token = 401,
so the site refreshes its token and asks again."""
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError
from app.core.security import read_token
from app.db.session import get_db
from app.models import User

DB = Annotated[AsyncSession, Depends(get_db)]

NOT_LOGGED_IN = "Учетные данные не были предоставлены."
BAD_TOKEN = "Данный токен недействителен для любого типа токена"


async def optional_user(request: Request, db: DB) -> User | None:
    header = request.headers.get("authorization", "")
    if not header:
        return None
    scheme, _, token = header.partition(" ")
    payload = read_token(token.strip(), "access") if scheme.lower() == "bearer" else None
    user = await db.get(User, payload["user_id"]) if payload else None
    if user is None or not user.is_active:
        raise ApiError(BAD_TOKEN, 401, code="token_not_valid")
    request.state.user = user
    return user


async def current_user(user: Annotated[User | None, Depends(optional_user)]) -> User:
    if user is None:
        raise ApiError(NOT_LOGGED_IN, 401)
    return user


async def editor_user(user: Annotated[User, Depends(current_user)]) -> User:
    if not user.is_editor:
        raise ApiError("У вас недостаточно прав для выполнения данного действия.", 403)
    return user


async def admin_user(user: Annotated[User, Depends(current_user)]) -> User:
    if not user.is_admin:
        raise ApiError("У вас недостаточно прав для выполнения данного действия.", 403)
    return user


OptionalUser = Annotated[User | None, Depends(optional_user)]
CurrentUser = Annotated[User, Depends(current_user)]
EditorUser = Annotated[User, Depends(editor_user)]
AdminUser = Annotated[User, Depends(admin_user)]
