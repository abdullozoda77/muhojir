from urllib.parse import urlsplit

from fastapi import APIRouter, Request
from pydantic import Field, field_validator
from sqlalchemy import func, select

from app.core.deps import DB, CurrentUser
from app.schemas.common import Form
from app.models import PushSubscription
from app.services import push

router = APIRouter(prefix="/api/push", tags=["push"])

MAX_DEVICES = 10
PUSH_HOSTS = ("fcm.googleapis.com", "updates.push.services.mozilla.com", "push.apple.com", "notify.windows.com")


class Keys(Form):
    p256dh: str = Field(min_length=20, max_length=120)
    auth: str = Field(min_length=8, max_length=60)


class SubscriptionIn(Form):
    endpoint: str = Field(max_length=500)
    keys: Keys

    @field_validator("endpoint")
    @classmethod
    def known_push_service(cls, value):
        parts = urlsplit(value)
        host = parts.hostname or ""
        if parts.scheme != "https" or not any(host == h or host.endswith("." + h) for h in PUSH_HOSTS):
            raise ValueError("Unknown push service.")
        return value


class EndpointIn(Form):
    endpoint: str = Field(max_length=500)


async def devices(db, user):
    return await db.scalar(select(func.count()).select_from(PushSubscription).where(PushSubscription.user_id == user.id))


@router.get("/")
async def push_status(db: DB, user: CurrentUser):
    return {"key": push.public_key(), "devices": await devices(db, user)}


@router.post("/subscribe/", status_code=201)
async def push_subscribe(body: SubscriptionIn, request: Request, db: DB, user: CurrentUser):
    subscription = await db.scalar(select(PushSubscription).where(PushSubscription.endpoint == body.endpoint))
    if subscription is None:
        if await devices(db, user) >= MAX_DEVICES:
            oldest = await db.scalar(select(PushSubscription).where(PushSubscription.user_id == user.id)
                                     .order_by(PushSubscription.created_at).limit(1))
            await db.delete(oldest)
        subscription = PushSubscription(endpoint=body.endpoint)
        db.add(subscription)
    subscription.user_id = user.id
    subscription.p256dh, subscription.auth = body.keys.p256dh, body.keys.auth
    subscription.user_agent = request.headers.get("user-agent", "")[:200]
    await db.commit()
    return {"key": push.public_key(), "devices": await devices(db, user)}


@router.post("/unsubscribe/")
async def push_unsubscribe(body: EndpointIn, db: DB, user: CurrentUser):
    subscription = await db.scalar(select(PushSubscription).where(
        PushSubscription.endpoint == body.endpoint, PushSubscription.user_id == user.id))
    if subscription:
        await db.delete(subscription)
        await db.commit()
    return {"key": push.public_key(), "devices": await devices(db, user)}


@router.post("/test/")
async def push_test(db: DB, user: CurrentUser):
    sent = await push.send_to_user(db, user, "Muhojir", "Огоҳиҳо кор мекунанд ✓", "/saved-jobs")
    return {"sent": sent}
