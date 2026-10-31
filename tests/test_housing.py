from tests.conftest import set_role
from tests.test_feedback import register

LISTING = {"kind": "bed", "title": "Ҷойи хоб дар Люблино", "city": "Москва", "metro": "Люблино", "price": 9000,
           "for_whom": "men", "registration": True, "phone": "+7 999 123-45-67"}
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64


async def test_a_listing_is_shown_only_after_an_editor_approves_it(client, user):
    editor, data = user
    await set_role(data["user"]["id"], "editor")
    owner = await register(client, "landlord@example.com", "Аҳмад Солиев")
    r = await client.post("/api/housing/", headers=owner, json={**LISTING, "phone": "", "whatsapp": ""})
    assert r.status_code == 400
    r = await client.post("/api/housing/", headers=owner, json=LISTING)
    assert "confirmed" in r.json()
    r = await client.post("/api/housing/", headers=owner, json={**LISTING, "confirmed": True})
    assert r.status_code == 201, r.text
    listing = r.json()
    assert listing["status"] == "pending" and listing["phone"] == "+79991234567" and listing["for_whom_label"] == "Танҳо мардон"
    assert (await client.get("/api/housing/", headers=owner)).json()["count"] == 0
    assert (await client.get("/api/housing/?mine=true", headers=owner)).json()["count"] == 1
    assert (await client.get(f"/api/housing/{listing['id']}/")).status_code == 404
    r = await client.get("/api/auth/notifications/", headers=editor)
    assert any("Люблино" in n["message"] for n in r.json()["results"])
    r = await client.post(f"/api/housing/{listing['id']}/moderate/", headers=owner, json={"status": "approved"})
    assert r.status_code == 403
    r = await client.post(f"/api/housing/{listing['id']}/moderate/", headers=editor, json={"status": "rejected"})
    assert "reason" in r.json()
    r = await client.post(f"/api/housing/{listing['id']}/moderate/", headers=editor, json={"status": "approved"})
    assert r.json()["status"] == "approved"
    r = await client.get("/api/auth/notifications/", headers=owner)
    assert any(n["title"] == "Эълони манзил тасдиқ шуд" for n in r.json()["results"])
    assert (await client.get(f"/api/housing/{listing['id']}/")).status_code == 200
    r = await client.patch(f"/api/housing/{listing['id']}/", headers=owner, json={"is_active": False})
    assert r.json()["status"] == "approved"
    assert (await client.get("/api/housing/")).json()["count"] == 0
    r = await client.patch(f"/api/housing/{listing['id']}/", headers=owner, json={"is_active": True, "price": 8000})
    assert r.json()["status"] == "pending"


async def test_filters_search_and_ordering(client, user):
    editor, data = user
    await set_role(data["user"]["id"], "editor")
    rows = [
        {**LISTING},
        {**LISTING, "kind": "flat", "title": "Хонаи дуҳуҷрагӣ барои оила", "metro": "Марьино", "price": 45000, "for_whom": "family",
         "registration": False, "rooms": 2, "utilities_included": True},
        {**LISTING, "kind": "room", "title": "Ҳуҷра дар Казань", "city": "Казань", "metro": "", "price": 15000,
         "for_whom": "any", "registration": False, "no_deposit": True},
    ]
    for row in rows:
        assert (await client.post("/api/housing/", headers=editor, json=row)).status_code == 201

    async def titles(query):
        r = await client.get(f"/api/housing/?{query}")
        return [h["title"] for h in r.json()["results"]]

    assert len(await titles("")) == 3
    assert await titles("city=москва&ordering=price") == ["Ҷойи хоб дар Люблино", "Хонаи дуҳуҷрагӣ барои оила"]
    assert await titles("kind=room") == ["Ҳуҷра дар Казань"]
    assert await titles("search=Люблино") == ["Ҷойи хоб дар Люблино"]
    assert set(await titles("for_whom=men")) == {"Ҷойи хоб дар Люблино", "Ҳуҷра дар Казань"}
    assert await titles("max_price=10000") == ["Ҷойи хоб дар Люблино"]
    assert await titles("min_price=20000") == ["Хонаи дуҳуҷрагӣ барои оила"]
    assert await titles("registration=true") == ["Ҷойи хоб дар Люблино"]
    assert await titles("utilities_included=true") == ["Хонаи дуҳуҷрагӣ барои оила"]
    assert await titles("no_deposit=true") == ["Ҳуҷра дар Казань"]
    assert (await client.get("/api/housing/?max_price=abc")).status_code == 400
    summary = (await client.get("/api/housing/summary/")).json()
    assert summary["total"] == 3 and summary["kinds"]["flat"] == 1
    assert summary["cities"][0] == {"name": "Москва", "count": 2}


async def test_photos_only_the_owner_adds_and_removes(client, user):
    editor, data = user
    await set_role(data["user"]["id"], "editor")
    owner = await register(client, "photos@example.com", "Нигина Раҳимова")
    stranger = await register(client, "nosy@example.com", "Бегона Одам")
    listing = (await client.post("/api/housing/", headers=owner, json={**LISTING, "confirmed": True})).json()
    r = await client.post(f"/api/housing/{listing['id']}/photos/", headers=owner, files={"photo": ("a.txt", b"hello", "text/plain")})
    assert "photo" in r.json()
    r = await client.post(f"/api/housing/{listing['id']}/photos/", headers=owner, files={"photo": ("room.png", PNG, "image/png")})
    assert r.status_code == 201, r.text
    photo = r.json()["photos"][0]
    assert photo["url"].startswith("/media/housing/")
    await client.post(f"/api/housing/{listing['id']}/moderate/", headers=editor, json={"status": "approved"})
    r = await client.post(f"/api/housing/{listing['id']}/photos/", headers=stranger, files={"photo": ("x.png", PNG, "image/png")})
    assert r.status_code == 403
    r = await client.get("/api/housing/?with_photos=true")
    assert r.json()["count"] == 1
    r = await client.delete(f"/api/housing/{listing['id']}/photos/{photo['id']}/", headers=owner)
    assert r.json()["photos"] == []
    assert (await client.delete(f"/api/housing/{listing['id']}/", headers=stranger)).status_code == 403
    assert (await client.delete(f"/api/housing/{listing['id']}/", headers=owner)).status_code == 204


def tg_page(posts):
    blocks = []
    for number, when, text in posts:
        blocks.append(
            f'<div class="tgme_widget_message_wrap js-widget_message_wrap"><div class="tgme_widget_message" data-post="test_flats/{number}">'
            f'<a class="tgme_widget_message_photo_wrap" style="width:800px;background-image:url(\'https://cdn.test/{number}.jpg\')"></a>'
            f'<div class="tgme_widget_message_text js-message_text" dir="auto">{text}</div>'
            f'<time datetime="{when}" class="time">10:00</time></div></div>')
    return "<html>" + "".join(blocks) + "</html>"


async def test_telegram_import_keeps_only_real_offers(client):
    from datetime import timedelta

    import httpx

    from app.db.session import SessionLocal
    from app.db.types import utcnow
    from app.services import housing_import

    fresh = (utcnow() - timedelta(days=1)).isoformat()
    old = (utcnow() - timedelta(days=60)).isoformat()
    posts = [
        (1, fresh, "Сдам без посредников: комната, 14м²<br/>Цена: 16000<br/>Адрес: Тестоград, ул. Ленина, 5<br/>"
                   "Только для мужчин, помогу с регистрацией, всё включено. Звоните +7 (999) 111-22-33"),
        (2, fresh, "3-к квартира<br/>м.Балтийская<br/>Стоимость: 75.000₽ + жкх.<br/>Контакт: @good_owner"),
        (3, fresh, "Ищу комнату в Тестограде до 15000, пишите @someone_here"),
        (4, fresh, "Сдаю однокомнатную квартиру, 30 000 руб, только славянам, без животных"),
        (5, fresh, "Подписывайтесь на наш закрытый telegram-канал, 300 квартир в месяц от 20 000 руб"),
        (6, fresh, "Сдам без посредников: комната, 14м²<br/>Цена: 16000<br/>Адрес: Тестоград, ул. Ленина, 5<br/>"
                   "Только для мужчин, помогу с регистрацией, всё включено. Звоните +7 (999) 111-22-33"),
        (7, old, "Сдам квартиру-студию в Тестограде, цена 20000, тел. +7 999 000-00-01"),
    ]
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 64

    def answer(request):
        if request.url.host == "cdn.test":
            return httpx.Response(200, content=png)
        if "before" in str(request.url):
            return httpx.Response(200, text="<html></html>")
        return httpx.Response(200, text=tg_page(posts))

    monkey = dict(housing_import.CHANNELS)
    housing_import.CHANNELS["test_flats"] = "Тестоград"
    try:
        async with SessionLocal() as db:
            counts = await housing_import.import_housing(db, channels=["test_flats"], pause=0, log=lambda *_: None,
                                                         transport=httpx.MockTransport(answer))
            again = await housing_import.import_housing(db, channels=["test_flats"], pause=0, log=lambda *_: None,
                                                        transport=httpx.MockTransport(answer))
    finally:
        housing_import.CHANNELS.clear()
        housing_import.CHANNELS.update(monkey)
    assert counts["created"] == 2 and counts["duplicates"] == 1 and counts["skipped"] == 3
    assert again["created"] == 0 and again["known"] == 2

    r = await client.get("/api/housing/?city=Тестоград&source=telegram")
    assert r.json()["count"] == 2
    room = next(h for h in r.json()["results"] if h["kind"] == "room")
    assert room["kind"] == "room" and room["price"] == 16000 and room["for_whom"] == "men"
    assert room["registration"] and room["utilities_included"] and room["phone"] == "+79991112233"
    assert room["source_name"] == "@test_flats" and room["source_url"] == "https://t.me/test_flats/1"
    assert len(room["photos"]) == 1 and room["is_mine"] is False
    r = await client.get("/api/housing/?search=Балтийская")
    flat = next(h for h in r.json()["results"] if h["source"] == "telegram")
    assert flat["kind"] == "flat" and flat["rooms"] == 3 and flat["price"] == 75000 and flat["telegram"] == "good_owner"
