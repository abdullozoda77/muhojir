from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from sqlalchemy import delete, func, or_, select, update

from app.core.config import LOGIN_CODE_LIFETIME, LOGIN_CODE_MAX_ATTEMPTS, RESEND_PAUSE, settings
from app.core.deps import DB, CurrentUser
from app.core.errors import ApiError, FieldError
from app.core.files import delete_avatar, save_avatar
from app.core.pagination import Paginate
from app.core.security import hash_password, make_tokens, password_problems, read_token, verify_password
from app.core.throttle import throttle
from app.db.types import utcnow
from app.models import EmailCode, Notification, RevokedToken, User
from app.schemas.accounts import (
    CodeIn, EmailIn, GoogleIn, LoginIn, NotificationIn, ProfileIn, RefreshIn, RegisterIn, ResetPasswordIn, user_json,
)
from app.services.emails import send_code
from app.services.google import verify_google_token
from app.services.live import notification_json, push_count
from app.services.stats import activity
from app.services.notify import PASSWORD_TEXT, PASSWORD_TITLE, notify, welcome

router = APIRouter(prefix="/api/auth", tags=["auth"])

WAIT = "A code was just sent. Wait a minute before asking for a new one."
EXPIRED = "The code has expired. Ask for a new one."
BLOCKED = "This account is blocked."


def check_password_rules(password, email):
    problems = password_problems(password, email)
    if problems:
        raise ApiError({"password": problems})


def logged_in(user, status=200):
    return JSONResponse({"user": jsonable(user_json(user)), **make_tokens(user.id)}, status_code=status)


def jsonable(data):
    from fastapi.encoders import jsonable_encoder

    return jsonable_encoder(data)


async def email_code(db, email, purpose):
    old = await db.scalar(select(EmailCode).where(EmailCode.email == email))
    if old and utcnow() - old.sent_at < RESEND_PAUSE:
        raise ApiError(WAIT, 429)
    try:
        await send_code(db, email, purpose)
    except OSError:
        raise ApiError("The email could not be sent. Try again in a few minutes.", 503)


async def use_code(db, email, code, purpose):
    entry = await db.scalar(select(EmailCode).where(EmailCode.email == email, EmailCode.purpose == purpose))
    if entry is None or utcnow() - entry.sent_at > LOGIN_CODE_LIFETIME:
        raise ApiError(EXPIRED)
    if entry.attempts >= LOGIN_CODE_MAX_ATTEMPTS:
        raise ApiError("Too many wrong tries. Ask for a new code.")
    if not verify_password(code, entry.code_hash):
        await db.execute(update(EmailCode).where(EmailCode.id == entry.id).values(attempts=EmailCode.attempts + 1))
        await db.commit()
        raise ApiError("Wrong code.")
    await db.delete(entry)
    await db.commit()


async def user_by_email(db, email, **filters):
    query = select(User).where(User.email == email)
    for name, value in filters.items():
        query = query.where(getattr(User, name) == value)
    return await db.scalar(query)


@router.post("/register/", status_code=201, dependencies=[Depends(throttle("login_code"))])
async def register(data: RegisterIn, db: DB):
    check_password_rules(data.password, data.email)
    user = await user_by_email(db, data.email)
    if user and user.email_verified:
        raise ApiError("This email is already registered. Log in or reset the password.", code="registered")
    if user and not user.is_active:
        raise ApiError(BLOCKED, 403)
    if user is None:
        user = User(email=data.email, password_hash=hash_password(data.password), full_name=data.full_name)
        db.add(user)
    else:
        user.password_hash = hash_password(data.password)
        user.full_name = data.full_name or user.full_name
    await db.commit()
    try:
        await email_code(db, user.email, "verify")
    except ApiError as error:
        if error.status_code != 429:
            raise
    return {"detail": "Code sent.", "email": user.email}


@router.post("/verify-email/", status_code=201)
async def verify_email(data: CodeIn, db: DB):
    user = await user_by_email(db, data.email)
    if user is None:
        raise ApiError(EXPIRED)
    await use_code(db, data.email, data.code, "verify")
    if not user.is_active:
        raise ApiError(BLOCKED, 403)
    first = not user.email_verified
    user.email_verified = True
    await db.commit()
    if first:
        await welcome(db, user)
    return logged_in(user, 201)


@router.post("/resend-code/", dependencies=[Depends(throttle("login_code"))])
async def resend_code(data: EmailIn, db: DB):
    user = await user_by_email(db, data.email, email_verified=False)
    if user is None:
        raise ApiError("This email is already confirmed or not registered.")
    await email_code(db, user.email, "verify")
    return {"detail": "Code sent."}


@router.post("/login/", dependencies=[Depends(throttle("login"))])
async def login(data: LoginIn, db: DB):
    user = await user_by_email(db, data.email)
    if user is None or not verify_password(data.password, user.password_hash):
        raise ApiError("Wrong email or password.")
    if not user.is_active:
        raise ApiError(BLOCKED, 403)
    if not user.email_verified:
        try:
            await email_code(db, user.email, "verify")
        except ApiError:
            pass
        raise ApiError("Confirm your email first. We sent you a code.", 403, code="not_verified")
    return logged_in(user)


@router.get("/google/")
async def google_settings():
    return {"client_id": settings.google_client_id}


async def social_login(db, email, full_name):
    email = email.strip().lower()
    user = await user_by_email(db, email)
    created = user is None
    if created:
        user = User(email=email, full_name=full_name.strip()[:150], email_verified=True)
        db.add(user)
    elif not user.is_active:
        raise ApiError(BLOCKED, 403)
    elif not user.email_verified:
        user.password_hash = ""
        user.email_verified = True
    await db.commit()
    if created:
        await welcome(db, user)
    return logged_in(user, 201 if created else 200)


@router.post("/google/", dependencies=[Depends(throttle("login"))])
async def google_login(data: GoogleIn, db: DB):
    if not settings.google_client_id:
        raise ApiError("Google login is not set up.", 503)
    claims = await run_in_threadpool(verify_google_token, data.credential)
    if claims is None:
        raise ApiError("Could not sign in with Google. Try again.")
    return await social_login(db, claims["email"], claims.get("name", ""))


@router.post("/password/forgot/", dependencies=[Depends(throttle("login_code"))])
async def forgot_password(data: EmailIn, db: DB):
    user = await user_by_email(db, data.email, is_active=True)
    if user:
        try:
            await email_code(db, user.email, "reset")
        except ApiError as error:
            if error.status_code == 503:
                raise
    return {"detail": "If this email is registered, a code was sent."}


@router.post("/password/reset/")
async def reset_password(data: ResetPasswordIn, db: DB):
    check_password_rules(data.password, data.email)
    user = await user_by_email(db, data.email, is_active=True)
    if user is None:
        raise ApiError(EXPIRED)
    await use_code(db, data.email, data.code, "reset")
    user.password_hash = hash_password(data.password)
    user.email_verified = True
    await db.commit()
    await notify(db, user, PASSWORD_TITLE, PASSWORD_TEXT)
    return logged_in(user)


async def revoke(db, payload):
    if await db.get(RevokedToken, payload["jti"]):
        return False
    db.add(RevokedToken(jti=payload["jti"], expires_at=datetime.fromtimestamp(payload["exp"], timezone.utc)))
    await db.execute(delete(RevokedToken).where(RevokedToken.expires_at < utcnow()))
    await db.commit()
    return True


@router.post("/token/refresh/")
async def refresh_token(data: RefreshIn, db: DB):
    payload = read_token(data.refresh, "refresh")
    user = await db.get(User, payload["user_id"]) if payload else None
    if user is None or not user.is_active or not await revoke(db, payload):
        raise ApiError("Token is invalid or expired", 401, code="token_not_valid")
    return make_tokens(user.id)


@router.post("/logout/", status_code=204)
async def logout(data: RefreshIn, db: DB):
    payload = read_token(data.refresh, "refresh")
    if payload is None:
        raise ApiError("Invalid or expired token.")
    await revoke(db, payload)
    return Response(status_code=204)


@router.get("/profile/")
async def profile(user: CurrentUser):
    return user_json(user)


@router.get("/activity/")
async def my_activity(user: CurrentUser, db: DB):
    return await activity(db, user)


@router.patch("/profile/")
async def update_profile(data: ProfileIn, user: CurrentUser, db: DB):
    changes = data.model_dump(exclude_unset=True)
    if "phone" in changes and changes["phone"]:
        taken = await db.scalar(select(User.id).where(User.phone == changes["phone"], User.id != user.id))
        if taken:
            raise FieldError("phone", "This phone number is already used by another account.")
    for name, value in changes.items():
        if value is None and name != "phone":
            continue
        setattr(user, name, value)
    await db.commit()
    return user_json(user)


@router.post("/profile/avatar/")
async def upload_avatar(user: CurrentUser, db: DB, avatar: Annotated[UploadFile, File()]):
    old, user.avatar = user.avatar, await save_avatar(avatar)
    await db.commit()
    await delete_avatar(old)
    return user_json(user)


@router.delete("/profile/avatar/")
async def remove_avatar(user: CurrentUser, db: DB):
    old, user.avatar = user.avatar, ""
    await db.commit()
    await delete_avatar(old)
    return user_json(user)


def my_notifications(user):
    return select(Notification).where(Notification.user_id == user.id)


@router.get("/notifications/")
async def notifications(
    user: CurrentUser, db: DB, page: Paginate,
    kind: str | None = None, is_read: bool | None = None, search: str | None = None,
):
    query = my_notifications(user).order_by(Notification.created_at.desc(), Notification.id.desc())
    if kind:
        query = query.where(Notification.kind == kind)
    if is_read is not None:
        query = query.where(Notification.is_read == is_read)
    if search:
        query = query.where(or_(Notification.title.ilike(f"%{search}%"), Notification.message.ilike(f"%{search}%")))
    return await page.respond(db, query, notification_json)


@router.get("/notifications/unread-count/")
async def unread_notifications(user: CurrentUser, db: DB):
    return {"count": await db.scalar(select(func.count()).select_from(my_notifications(user).where(Notification.is_read.is_(False)).subquery()))}


@router.post("/notifications/read-all/")
async def read_all(user: CurrentUser, db: DB):
    result = await db.execute(
        update(Notification).where(Notification.user_id == user.id, Notification.is_read.is_(False)).values(is_read=True)
    )
    await db.commit()
    await push_count(db, user.id)
    return {"updated": result.rowcount}


async def get_notification(db, user, notification_id):
    notification = await db.scalar(my_notifications(user).where(Notification.id == notification_id))
    if notification is None:
        raise ApiError("No Notification matches the given query.", 404)
    return notification


@router.get("/notifications/{notification_id}/")
async def notification(notification_id: int, user: CurrentUser, db: DB):
    return notification_json(await get_notification(db, user, notification_id))


@router.patch("/notifications/{notification_id}/")
async def update_notification(notification_id: int, data: NotificationIn, user: CurrentUser, db: DB):
    item = await get_notification(db, user, notification_id)
    if data.is_read is not None:
        item.is_read = data.is_read
    await db.commit()
    await push_count(db, user.id)
    return notification_json(item)


@router.delete("/notifications/{notification_id}/", status_code=204)
async def delete_notification(notification_id: int, user: CurrentUser, db: DB):
    await db.delete(await get_notification(db, user, notification_id))
    await db.commit()
    await push_count(db, user.id)
    return Response(status_code=204)
