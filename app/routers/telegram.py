import hmac

from fastapi import APIRouter, Header, Request
from pydantic import Field

from app.core.deps import DB, CurrentUser
from app.core.errors import ApiError
from app.core.config import settings
from app.schemas.common import Form
from app.services import telegram

router = APIRouter(prefix="/api/telegram", tags=["telegram"])

NOT_SET_UP = "Telegram is not set up on this site yet."


class TelegramPatch(Form):
    enabled: bool = Field()


def status_json(link):
    return {"configured": telegram.configured(), "bot": settings.telegram_bot_name,
            "connected": link is not None, "username": link.username if link else "",
            "enabled": link.enabled if link else False}


@router.get("/")
async def telegram_status(db: DB, user: CurrentUser):
    return status_json(await telegram.link_of(db, user))


@router.post("/link/")
async def telegram_link(user: CurrentUser):
    if not telegram.configured():
        raise ApiError(NOT_SET_UP, 503)
    return {"url": telegram.link_url(user.id)}


@router.patch("/")
async def telegram_update(body: TelegramPatch, db: DB, user: CurrentUser):
    link = await telegram.link_of(db, user)
    if link is None:
        raise ApiError("Telegram is not connected.", 404)
    link.enabled = body.enabled
    await db.commit()
    return status_json(link)


@router.delete("/", status_code=204)
async def telegram_disconnect(db: DB, user: CurrentUser):
    link = await telegram.link_of(db, user)
    if link:
        chat_id = link.chat_id
        await db.delete(link)
        await db.commit()
        await telegram.send(chat_id, telegram.STOPPED)


@router.post("/webhook/{secret}/")
async def telegram_webhook(secret: str, request: Request, db: DB,
                           x_telegram_bot_api_secret_token: str = Header("")):
    expected = telegram.webhook_secret()
    if not telegram.configured() or not hmac.compare_digest(secret, expected) \
            or not hmac.compare_digest(x_telegram_bot_api_secret_token, expected):
        raise ApiError("Not found.", 404)
    await telegram.handle_update(db, await request.json())
    return {"ok": True}
