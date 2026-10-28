from datetime import date, timedelta

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import Notification
from tests.conftest import last_code, set_role
from tests.test_market import PNG, SHOP, sign_up


async def titles(user_id):
    async with SessionLocal() as db:
        return (await db.scalars(select(Notification.title).where(Notification.user_id == user_id))).all()


async def test_welcome_after_the_email_is_confirmed(client, user):
    _, data = user
    assert (await titles(data["user"]["id"])).count("Хуш омадед ба Muhojir!") == 1


async def test_password_change_is_reported(client, user):
    _, data = user
    email = data["user"]["email"]
    await client.post("/api/auth/password/forgot/", json={"email": email})
    r = await client.post("/api/auth/password/reset/", json={"email": email, "code": last_code(email), "password": "Another-pass-2026"})
    assert r.status_code == 200, r.text
    assert "Пароли шумо иваз шуд" in await titles(data["user"]["id"])


async def test_document_expired_today(client, user):
    from app.services.reminders import send_due_reminders

    headers, data = user
    r = await client.post("/api/documents/my-documents/", headers=headers,
                          json={"document_type": 2, "expires_at": date.today().isoformat(), "remind_days_before": 7})
    assert r.status_code == 201
    async with SessionLocal() as db:
        await send_due_reminders(db)
    r = await client.get("/api/auth/notifications/", headers=headers, params={"kind": "reminder"})
    assert any("имрӯз" in n["message"] for n in r.json()["results"])


async def test_editors_hear_about_new_shops_and_places_and_owners_about_reviews(client, user):
    owner, owner_data = user
    editor, editor_id = await sign_up(client, "notify-editor@example.com")
    await set_role(editor_id, "editor")

    shop = (await client.post("/api/market/shops/", headers=owner, json={**SHOP, "lat": 55.68, "lon": 37.76})).json()
    for kind in ("place", "goods"):
        await client.post(f"/api/market/shops/{shop['id']}/proofs/", headers=owner, data={"kind": kind},
                          files={"file": ("p.png", PNG, "image/png")})
    assert (await client.post(f"/api/market/shops/{shop['id']}/submit/", headers=owner)).json()["status"] == "pending"
    assert "Мағозаи нав барои санҷиш" in await titles(editor_id)

    form = {"category": "halal", "name": "Халял", "region": "Москва", "address": "Мира 5", "lat": "55.7", "lon": "37.6", "confirmed": "true"}
    r = await client.post("/api/places/", headers=owner, data=form, files={"photo": ("p.png", PNG, "image/png")})
    assert r.status_code == 201, r.text
    assert "Ҷойи нав барои санҷиш" in await titles(editor_id)

    await client.post(f"/api/market/shops/{shop['id']}/moderate/", headers=editor, json={"status": "approved"})
    r = await client.put(f"/api/market/shops/{shop['id']}/reviews/mine/", headers=editor, json={"rating": 5, "text": "Нон тоза"})
    assert r.status_code == 200
    await client.put(f"/api/market/shops/{shop['id']}/reviews/mine/", headers=editor, json={"rating": 4})
    assert (await titles(owner_data["user"]["id"])).count("Шарҳи нав дар мағозаи шумо") == 1

    r = await client.patch(f"/api/market/shops/{shop['id']}/", headers=owner, json={"lat": 55.69, "lon": 37.77})
    assert r.json()["status"] == "pending"
    assert "Мағоза ҷояшро иваз кард" in await titles(editor_id)
