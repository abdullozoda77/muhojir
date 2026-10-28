from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import Notification
from tests.conftest import last_code, set_role

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64

SHOP = {"name": "Дӯкони Саид", "category": "grocery", "city": "Москва", "address": "Люблинская 10",
        "phone": "8 999 123-45-67", "telegram": "https://t.me/dukoni_said", "delivery": True}


async def sign_up(client, email):
    await client.post("/api/auth/register/", json={"email": email, "password": "Strong-pass-2026"})
    r = await client.post("/api/auth/verify-email/", json={"email": email, "code": last_code(email)})
    return {"Authorization": f"Bearer {r.json()['access']}"}, r.json()["user"]["id"]


async def test_shop_moderation_products_reviews(client, user):
    owner, owner_data = user
    r = await client.post("/api/market/shops/", headers=owner, json={**SHOP, "phone": "", "telegram": ""})
    assert r.status_code == 400 and "non_field_errors" in r.json()
    r = await client.post("/api/market/shops/", headers=owner, json={**SHOP, "telegram": "@a b"})
    assert "telegram" in r.json()

    r = await client.post("/api/market/shops/", headers=owner, json=SHOP)
    assert r.status_code == 201, r.text
    shop = r.json()
    assert shop["status"] == "draft" and shop["phone"] == "+79991234567" and shop["telegram"] == "dukoni_said"
    assert shop["is_mine"] and shop["reject_reason"] == ""

    assert (await client.get(f"/api/market/shops/{shop['id']}/")).status_code == 404
    assert (await client.get(f"/api/market/shops/{shop['id']}/", headers=owner)).status_code == 200
    r = await client.get("/api/market/shops/", params={"mine": "true"}, headers=owner)
    assert [x["id"] for x in r.json()["results"]] == [shop["id"]]

    r = await client.post(f"/api/market/shops/{shop['id']}/products/", headers=owner,
                          json={"name": "Курагаи Исфара", "price": 650, "unit": "kg"})
    assert r.status_code == 201, r.text
    product = r.json()
    r = await client.post(f"/api/market/products/{product['id']}/photo/", headers=owner, files={"photo": ("a.png", PNG, "image/png")})
    assert r.json()["photo"].startswith("/media/products/")
    r = await client.post(f"/api/market/products/{product['id']}/photo/", headers=owner, files={"photo": ("a.png", b"text", "image/png")})
    assert "photo" in r.json()
    r = await client.post(f"/api/market/shops/{shop['id']}/logo/", headers=owner, files={"logo": ("l.png", PNG, "image/png")})
    assert r.json()["logo"].startswith("/media/shops/")

    editor, editor_id = await sign_up(client, "editor-market@example.com")
    assert (await client.post(f"/api/market/shops/{shop['id']}/moderate/", headers=owner, json={"status": "approved"})).status_code == 403
    await set_role(editor_id, "editor")
    r = await client.post(f"/api/market/shops/{shop['id']}/moderate/", headers=editor, json={"status": "approved"})
    assert r.status_code == 400

    r = await client.post(f"/api/market/shops/{shop['id']}/submit/", headers=owner)
    assert "proofs" in r.json()
    proof = lambda kind, data=PNG, name="p.png": client.post(f"/api/market/shops/{shop['id']}/proofs/", headers=owner,
                                                             data={"kind": kind}, files={"file": (name, data, "image/png")})
    r = await proof("place")
    assert r.status_code == 201, r.text
    place_id = r.json()["id"]
    assert (await proof("selfie")).status_code == 400
    assert (await proof("goods", b"x", "p.exe")).status_code == 400
    assert (await client.post(f"/api/market/shops/{shop['id']}/submit/", headers=owner)).status_code == 400
    assert (await proof("goods")).status_code == 201
    assert (await client.get(f"/api/market/shops/{shop['id']}/proofs/{place_id}/", headers=editor)).content == PNG
    r = await client.post(f"/api/market/shops/{shop['id']}/submit/", headers=owner)
    assert "location" in r.json()
    r = await client.patch(f"/api/market/shops/{shop['id']}/", headers=owner, json={"lat": 55.68, "lon": 37.76})
    assert r.json()["lat"] == 55.68
    stranger, _ = await sign_up(client, "proof-stranger@example.com")
    assert (await client.get(f"/api/market/shops/{shop['id']}/proofs/", headers=stranger)).status_code == 404
    r = await client.post(f"/api/market/shops/{shop['id']}/submit/", headers=owner)
    assert r.json()["status"] == "pending"
    assert (await client.post(f"/api/market/shops/{shop['id']}/submit/", headers=owner)).status_code == 400

    r = await client.get("/api/market/shops/", params={"status": "pending"}, headers=editor)
    assert shop["id"] in [x["id"] for x in r.json()["results"]]
    r = await client.post(f"/api/market/shops/{shop['id']}/moderate/", headers=editor, json={"status": "rejected"})
    assert "reason" in r.json()
    r = await client.post(f"/api/market/shops/{shop['id']}/moderate/", headers=editor, json={"status": "rejected", "reason": "Суроға нест"})
    assert r.json()["status"] == "rejected"
    r = await client.patch(f"/api/market/shops/{shop['id']}/", headers=owner, json={"address": "Люблинская 12"})
    assert r.json()["status"] == "rejected"
    r = await client.post(f"/api/market/shops/{shop['id']}/submit/", headers=owner)
    assert r.json()["status"] == "pending"
    r = await client.post(f"/api/market/shops/{shop['id']}/moderate/", headers=editor, json={"status": "approved"})
    assert r.json()["status"] == "approved" and r.json()["reject_reason"] == ""
    async with SessionLocal() as db:
        titles = (await db.scalars(select(Notification.title).where(Notification.user_id == owner_data["user"]["id"]))).all()
    assert "Мағозаи шумо рад шуд" in titles and "Мағозаи шумо тасдиқ шуд" in titles

    r = await client.get("/api/market/shops/map/")
    pin = next(x for x in r.json() if x["id"] == shop["id"])
    assert pin["lat"] == 55.68 and pin["lon"] == 37.76 and "phone" not in pin
    r = await client.patch(f"/api/market/shops/{shop['id']}/", headers=owner, json={"opening_hours": "08:00–22:00"})
    assert r.json()["status"] == "approved"
    r = await client.patch(f"/api/market/shops/{shop['id']}/", headers=owner, json={"lat": None, "lon": None})
    assert "location" in r.json()
    r = await client.patch(f"/api/market/shops/{shop['id']}/", headers=owner, json={"lat": 55.69, "lon": 37.77})
    assert r.json()["status"] == "pending"
    assert shop["id"] not in [x["id"] for x in (await client.get("/api/market/shops/map/")).json()]
    r = await client.post(f"/api/market/shops/{shop['id']}/moderate/", headers=editor, json={"status": "approved"})
    assert r.json()["status"] == "approved" and r.json()["lat"] == 55.69

    r = await client.get("/api/market/shops/", params={"search": "курага", "city": "моск", "delivery": "true"})
    assert [x["id"] for x in r.json()["results"]] == [shop["id"]]
    assert r.json()["results"][0]["products_count"] == 1 and "reject_reason" not in r.json()["results"][0]
    r = await client.get("/api/market/products/", params={"search": "курага", "max_price": 700})
    assert r.json()["results"][0]["shop"]["name"] == "Дӯкони Саид"
    r = await client.get("/api/market/shops/summary/")
    assert r.json()["categories"]["grocery"] >= 1 and r.json()["products"] >= 1

    r = await client.put(f"/api/market/shops/{shop['id']}/reviews/mine/", headers=owner, json={"rating": 5})
    assert r.status_code == 400
    r = await client.put(f"/api/market/shops/{shop['id']}/reviews/mine/", headers=editor, json={"rating": 4, "text": "Хуб"})
    assert r.status_code == 200 and r.json()["is_mine"]
    r = await client.get(f"/api/market/shops/{shop['id']}/")
    assert r.json()["rating"] == 4.0 and r.json()["reviews_count"] == 1

    r = await client.patch(f"/api/market/products/{product['id']}/", headers=editor, json={"in_stock": False})
    assert r.json()["in_stock"] is False
    r = await client.get(f"/api/market/shops/{shop['id']}/products/", params={"in_stock": "true"})
    assert r.json()["count"] == 0

    assert (await client.delete(f"/api/market/shops/{shop['id']}/", headers=owner)).status_code == 204
    assert (await client.get(f"/api/market/products/{product['id']}/")).status_code == 404


async def test_shop_limit_and_strangers(client, user):
    headers, _ = user
    for _ in range(3):
        assert (await client.post("/api/market/shops/", headers=headers, json=SHOP)).status_code == 201
    r = await client.post("/api/market/shops/", headers=headers, json=SHOP)
    assert r.status_code == 400
    shop_id = (await client.get("/api/market/shops/", params={"mine": "true"}, headers=headers)).json()["results"][0]["id"]
    stranger, _ = await sign_up(client, "stranger-market@example.com")
    assert (await client.patch(f"/api/market/shops/{shop_id}/", headers=stranger, json={"name": "Мой"})).status_code == 404
    assert (await client.post(f"/api/market/shops/{shop_id}/products/", headers=stranger, json={"name": "Нон", "price": 50})).status_code == 404
    assert (await client.post("/api/market/shops/", json=SHOP)).status_code == 401


async def test_geocode(client, user, monkeypatch):
    from app.services import geocode

    calls = []

    class Answer:
        def raise_for_status(self):
            pass

        def json(self):
            return [{"display_name": "10, Люблинская улица, Люблино, Москва, Россия", "lat": "55.6765123", "lon": "37.7612345", "type": "house"}]

    class Client:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def get(self, url, params):
            calls.append(params)
            return Answer()

    monkeypatch.setattr(geocode.httpx, "AsyncClient", Client)
    monkeypatch.setattr(geocode, "GAP", 0)
    headers, _ = user
    assert (await client.get("/api/market/geocode/", params={"q": "Люблинская 10"})).status_code == 401
    assert "q" in (await client.get("/api/market/geocode/", params={"q": "a"}, headers=headers)).json()
    r = await client.get("/api/market/geocode/", params={"q": "Москва, Люблинская 10"}, headers=headers)
    assert r.json() == [{"name": "10, Люблинская улица, Люблино, Москва", "full_name": "10, Люблинская улица, Люблино, Москва, Россия",
                         "lat": 55.676512, "lon": 37.761235, "kind": "house"}]
    await client.get("/api/market/geocode/", params={"q": "москва,  люблинская 10"}, headers=headers)
    assert len(calls) == 1 and calls[0]["countrycodes"] == "ru,tj"

    class Broken(Client):
        async def get(self, url, params):
            raise geocode.httpx.ConnectError("down")

    monkeypatch.setattr(geocode.httpx, "AsyncClient", Broken)
    assert (await client.get("/api/market/geocode/", params={"q": "Казань, Баумана 5"}, headers=headers)).status_code == 503
