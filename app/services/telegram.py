import hashlib
import hmac
import html
import logging
import time

import httpx
from sqlalchemy import select

from app.core.config import settings
from app.models import TelegramLink, User
from app.schemas.common import normalize_phone

logger = logging.getLogger(__name__)

CODE_LIFETIME = 24 * 3600
API = "https://api.telegram.org/bot{token}/{method}"

LINKED = (
    "✅ Telegram ба ҳисоби Muhojir пайваст шуд. Акнун ёдраскуниҳо ва хабарҳо ба ин ҷо меоянд.\n\n"
    "✅ Telegram подключён к аккаунту Muhojir. Теперь напоминания и уведомления будут приходить сюда.\n\n"
    "Барои хомӯш кардан: /stop"
)
SHARE_PHONE = "Рақами телефонро тасдиқ кунед / Подтвердите номер телефона"
SHARE_BUTTON = "📱 Рақамро фиристодан / Отправить номер"
PHONE_SAVED = "📱 Рақами {0} дар ҳисоби шумо сабт шуд. / Номер {0} сохранён в аккаунте."
PHONE_TAKEN = "Ин рақам ба ҳисоби дигар тааллуқ дорад. / Этот номер принадлежит другому аккаунту."
PHONE_OK = "📱 Рақам тасдиқ шуд. / Номер подтверждён."
PHONE_OTHER = "Рақами худро фиристед, на рақами каси дигар. / Отправьте свой номер, а не чужой."
NOT_LINKED = (
    "Салом! Ин боти Muhojir (muhojir.king.tj) аст. Барои гирифтани ёдраскуниҳо дар сайт ба «Профил» дароед ва "
    "«Пайваст кардани Telegram»-ро пахш кунед.\n\n"
    "Здравствуйте! Это бот Muhojir (muhojir.king.tj). Чтобы получать напоминания, откройте «Профиль» на сайте и "
    "нажмите «Подключить Telegram».\n\n{0}"
)
EXPIRED = "Пайванд кӯҳна шуд — дар сайт боз пахш кунед. / Ссылка устарела — нажмите ещё раз на сайте."
STOPPED = "Telegram аз ҳисоби Muhojir ҷудо шуд. / Telegram отключён от аккаунта Muhojir."
NOT_CONNECTED = "Telegram ба ягон ҳисоб пайваст нест. / Telegram не подключён ни к одному аккаунту.\n\n{0}"
STATUS = (
    "✅ Пайваст ба ҳисоби Muhojir: {name}\n"
    "Ёдраскуниҳо: {state_tg}\nТелефон: {phone}\n\n"
    "✅ Подключён к аккаунту Muhojir: {name}\n"
    "Напоминания: {state_ru}\nТелефон: {phone}\n\n"
    "/phone — рақам / номер · /stop — ҷудо кардан / отключить"
)
HELP = (
    "Ин бот ёдраскуниҳои Muhojir-ро мефиристад: мӯҳлати ҳуҷҷатҳо ва хабарҳои ҳисоби шумо.\n"
    "Этот бот присылает напоминания Muhojir: сроки документов и уведомления вашего аккаунта.\n\n"
    "/status — ҳолат / статус\n/phone — рақами телефон / номер телефона\n"
    "/stop — ҷудо кардан / отключить\n\n{0}"
)
COMMANDS = [
    {"command": "status", "description": "Ҳолат / Статус"},
    {"command": "phone", "description": "Рақами телефон / Номер телефона"},
    {"command": "help", "description": "Кумак / Помощь"},
    {"command": "stop", "description": "Ҷудо кардан / Отключить"},
]


def configured():
    return bool(settings.telegram_bot_token and settings.telegram_bot_name)


def webhook_secret():
    return hashlib.sha256(f"telegram:{settings.telegram_bot_token}".encode()).hexdigest()[:32]


def _sign(user_id, stamp):
    message = f"{user_id}.{stamp}".encode()
    return hmac.new(settings.secret_key.encode(), message, hashlib.sha256).hexdigest()[:20]


def link_code(user_id, now=None):
    stamp = format(int(now or time.time()), "x")
    return f"{user_id}-{stamp}-{_sign(user_id, stamp)}"


def read_code(code, now=None):
    try:
        user_id, stamp, sign = code.split("-")
        user_id, moment = int(user_id), int(stamp, 16)
    except ValueError:
        return None
    if not hmac.compare_digest(sign, _sign(user_id, stamp)):
        return None
    if (now or time.time()) - moment > CODE_LIFETIME:
        return None
    return user_id


def link_url(user_id):
    return f"https://t.me/{settings.telegram_bot_name}?start={link_code(user_id)}"


async def call(method, **payload):
    url = API.format(token=settings.telegram_bot_token, method=method)
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.post(url, json=payload)
        data = response.json()
    except (httpx.HTTPError, ValueError) as error:
        logger.warning("Telegram %s failed: %s", method, error)
        return {"ok": False, "error_code": 0}
    if not data.get("ok"):
        logger.warning("Telegram %s: %s", method, data.get("description"))
    return data


async def send(chat_id, text, **extra):
    return await call("sendMessage", chat_id=chat_id, text=text, disable_web_page_preview=True, **extra)


async def link_of(db, user):
    return await db.scalar(select(TelegramLink).where(TelegramLink.user_id == user.id))


async def send_to_user(db, user, title, message):
    if not configured():
        return False
    link = await link_of(db, user)
    if not link or not link.enabled:
        return False
    text = f"<b>{html.escape(title)}</b>\n\n{html.escape(message)}\n\n{settings.site_url}"
    result = await send(link.chat_id, text, parse_mode="HTML")
    if result.get("error_code") == 403:
        await db.delete(link)
        await db.commit()
    return bool(result.get("ok"))


def phone_keyboard():
    return {"keyboard": [[{"text": SHARE_BUTTON, "request_contact": True}]], "resize_keyboard": True,
            "one_time_keyboard": True}


async def connect(db, user_id, chat):
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        return await send(chat["id"], EXPIRED)
    old = await db.scalar(select(TelegramLink).where(TelegramLink.chat_id == chat["id"]))
    if old and old.user_id != user.id:
        await db.delete(old)
        await db.flush()
    link = await db.scalar(select(TelegramLink).where(TelegramLink.user_id == user.id))
    if link is None:
        link = TelegramLink(user_id=user.id, chat_id=chat["id"])
        db.add(link)
    link.chat_id, link.username, link.enabled = chat["id"], chat.get("username") or "", True
    await db.commit()
    await send(chat["id"], LINKED, reply_markup={"remove_keyboard": True})
    await send(chat["id"], SHARE_PHONE, reply_markup=phone_keyboard())


async def save_contact(db, chat_id, sender_id, contact):
    link = await db.scalar(select(TelegramLink).where(TelegramLink.chat_id == chat_id))
    if link is None:
        return await send(chat_id, NOT_LINKED.format(settings.site_url))
    if contact.get("user_id") != sender_id:
        return await send(chat_id, PHONE_OTHER)
    try:
        phone = normalize_phone(contact.get("phone_number", ""))
    except ValueError:
        return await send(chat_id, PHONE_OTHER)
    user = await db.get(User, link.user_id)
    done = {"reply_markup": {"remove_keyboard": True}}
    if user.phone == phone:
        return await send(chat_id, PHONE_OK, **done)
    owner = await db.scalar(select(User.id).where(User.phone == phone))
    if owner:
        return await send(chat_id, PHONE_TAKEN, **done)
    user.phone = phone
    await db.commit()
    return await send(chat_id, PHONE_SAVED.format(phone), **done)


async def handle_update(db, update):
    message = update.get("message") or {}
    chat = message.get("chat") or {}
    if chat.get("type") != "private":
        return
    sender = message.get("from") or {}
    if message.get("contact"):
        return await save_contact(db, chat["id"], sender.get("id"), message["contact"])
    text = (message.get("text") or "").strip()
    command = text.split()[0].split("@")[0].lower() if text else ""
    link = await db.scalar(select(TelegramLink).where(TelegramLink.chat_id == chat["id"]))
    if command == "/start":
        code = text.removeprefix(text.split()[0]).strip()
        user_id = read_code(code) if code else None
        if user_id:
            return await connect(db, user_id, chat)
        if code:
            return await send(chat["id"], EXPIRED)
        if link:
            return await send_status(db, link)
        return await send(chat["id"], NOT_LINKED.format(settings.site_url))
    if command == "/help":
        return await send(chat["id"], HELP.format(settings.site_url))
    if link is None:
        return await send(chat["id"], NOT_CONNECTED.format(settings.site_url) if command == "/stop"
                          else NOT_LINKED.format(settings.site_url), reply_markup={"remove_keyboard": True})
    if command == "/stop":
        await db.delete(link)
        await db.commit()
        return await send(chat["id"], STOPPED, reply_markup={"remove_keyboard": True})
    if command == "/phone":
        return await send(chat["id"], SHARE_PHONE, reply_markup=phone_keyboard())
    return await send_status(db, link)


async def send_status(db, link):
    user = await db.get(User, link.user_id)
    name = user.full_name or user.email or user.phone or f"#{user.id}"
    return await send(link.chat_id, STATUS.format(
        name=name, phone=user.phone or "—",
        state_tg="фаъол" if link.enabled else "хомӯш", state_ru="включены" if link.enabled else "выключены"))


async def set_webhook(base_url):
    url = f"{base_url.rstrip('/')}/api/telegram/webhook/{webhook_secret()}/"
    await call("setMyCommands", commands=COMMANDS)
    return await call("setWebhook", url=url, secret_token=webhook_secret(),
                      allowed_updates=["message"], drop_pending_updates=True)
