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
    listing = (await client.post("/api/housing/", headers=owner, json=LISTING)).json()
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
