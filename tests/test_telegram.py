import pytest

from app.services import telegram

CHAT = 555001


@pytest.fixture
def bot(monkeypatch):
    sent = []

    async def fake_call(method, **payload):
        sent.append({"method": method, **payload})
        return {"ok": True}

    monkeypatch.setattr(telegram.settings, "telegram_bot_token", "123456:TEST")
    monkeypatch.setattr(telegram.settings, "telegram_bot_name", "MuhojirTestBot")
    monkeypatch.setattr(telegram, "call", fake_call)
    return sent


def hook_headers():
    return {"X-Telegram-Bot-Api-Secret-Token": telegram.webhook_secret()}


def update(text=None, contact=None, chat=CHAT, sender=CHAT):
    message = {"chat": {"id": chat, "type": "private", "username": "ali_tj"}, "from": {"id": sender}}
    if text is not None:
        message["text"] = text
    if contact is not None:
        message["contact"] = contact
    return {"update_id": 1, "message": message}


async def post_update(client, body):
    return await client.post(f"/api/telegram/webhook/{telegram.webhook_secret()}/", json=body, headers=hook_headers())


def test_link_codes():
    code = telegram.link_code(7, now=1_000_000)
    assert telegram.read_code(code, now=1_000_100) == 7
    assert telegram.read_code(code, now=1_000_000 + telegram.CODE_LIFETIME + 1) is None
    assert telegram.read_code(code.replace("7-", "8-", 1), now=1_000_100) is None
    assert telegram.read_code("garbage") is None
    assert len(code) <= 64


async def test_not_configured(client, user):
    headers, _ = user
    r = await client.get("/api/telegram/", headers=headers)
    assert r.status_code == 200 and r.json()["configured"] is False
    assert (await client.post("/api/telegram/link/", headers=headers)).status_code == 503
    assert (await client.post("/api/telegram/webhook/x/", json={})).status_code == 404


async def test_connect_notify_phone_and_stop(client, user, bot):
    headers, data = user
    assert (await client.get("/api/telegram/")).status_code == 401
    r = await client.post("/api/telegram/link/", headers=headers)
    url = r.json()["url"]
    assert url.startswith("https://t.me/MuhojirTestBot?start=")
    code = url.split("start=")[1]

    r = await client.post(f"/api/telegram/webhook/{telegram.webhook_secret()}/", json=update(f"/start {code}"))
    assert r.status_code == 404
    r = await client.post("/api/telegram/webhook/wrong/", json=update(f"/start {code}"), headers=hook_headers())
    assert r.status_code == 404

    assert (await post_update(client, update(f"/start {code}"))).status_code == 200
    assert bot[-2]["chat_id"] == CHAT and "пайваст шуд" in bot[-2]["text"]
    assert bot[-1]["reply_markup"]["keyboard"][0][0]["request_contact"] is True
    status = (await client.get("/api/telegram/", headers=headers)).json()
    assert status == {"configured": True, "bot": "MuhojirTestBot", "connected": True, "username": "ali_tj", "enabled": True}

    bot.clear()
    from app.db.session import SessionLocal
    from app.models import User
    from app.services.notify import notify

    async with SessionLocal() as db:
        me = await db.get(User, data["user"]["id"])
        await notify(db, me, "Мӯҳлати патент", "Патент <3 рӯз> монд")
    assert bot[-1]["chat_id"] == CHAT and bot[-1]["parse_mode"] == "HTML"
    assert "<b>Мӯҳлати патент</b>" in bot[-1]["text"] and "&lt;3 рӯз&gt;" in bot[-1]["text"]

    r = await client.patch("/api/telegram/", headers=headers, json={"enabled": False})
    assert r.json()["enabled"] is False
    bot.clear()
    async with SessionLocal() as db:
        me = await db.get(User, data["user"]["id"])
        await notify(db, me, "Хомӯш", "Набояд равад")
    assert bot == []
    await client.patch("/api/telegram/", headers=headers, json={"enabled": True})

    await post_update(client, update(contact={"phone_number": "79991112233", "user_id": 999}))
    assert "чужой" in bot[-1]["text"]
    await post_update(client, update(contact={"phone_number": "79991112233", "user_id": CHAT}))
    assert "+79991112233" in bot[-1]["text"]
    profile = (await client.get("/api/auth/profile/", headers=headers)).json()
    assert profile["phone"] == "+79991112233"

    await post_update(client, update("/stop"))
    status = (await client.get("/api/telegram/", headers=headers)).json()
    assert status["connected"] is False

    await post_update(client, update("/start"))
    assert "Профиль" in bot[-1]["text"]
    await post_update(client, update(f"/start {code}x"))
    assert "устарела" in bot[-1]["text"]


async def test_disconnect_from_site_and_blocked_bot(client, user, bot, monkeypatch):
    headers, data = user
    code = (await client.post("/api/telegram/link/", headers=headers)).json()["url"].split("start=")[1]
    await post_update(client, update(f"/start {code}", chat=CHAT + 1, sender=CHAT + 1))
    assert (await client.delete("/api/telegram/", headers=headers)).status_code == 204
    assert (await client.get("/api/telegram/", headers=headers)).json()["connected"] is False
    assert (await client.patch("/api/telegram/", headers=headers, json={"enabled": True})).status_code == 404

    await post_update(client, update(f"/start {code}", chat=CHAT + 1, sender=CHAT + 1))

    async def blocked(method, **payload):
        return {"ok": False, "error_code": 403, "description": "Forbidden: bot was blocked by the user"}

    monkeypatch.setattr(telegram, "call", blocked)
    from app.db.session import SessionLocal
    from app.models import User

    async with SessionLocal() as db:
        me = await db.get(User, data["user"]["id"])
        assert await telegram.send_to_user(db, me, "Салом", "Матн") is False
    assert (await client.get("/api/telegram/", headers=headers)).json()["connected"] is False
