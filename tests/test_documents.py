import io

from tests.conftest import set_role


async def test_public_content_is_seeded(client):
    r = await client.get("/api/documents/document-types/")
    assert r.json()["count"] == 5
    r = await client.get("/api/documents/regions/", params={"search": "москва", "page_size": 100})
    names = [x["name"] for x in r.json()["results"]]
    assert "Москва" in names
    moscow = next(x for x in r.json()["results"] if x["name"] == "Москва")
    assert moscow["patent_monthly_price"] == "10000.00" and moscow["price_year"] == 2026
    r = await client.get("/api/documents/exam-questions/", params={"page_size": 100})
    assert r.json()["count"] == 100
    r = await client.get("/api/documents/news/", params={"page_size": 3})
    assert r.json()["count"] == 6 and r.json()["next"].endswith("page=2&page_size=3") or "page=2" in r.json()["next"]
    r = await client.get("/api/documents/regions/", params={"page": 999})
    assert r.status_code == 404


async def test_my_documents_photos_and_payments(client, user):
    headers, _ = user
    r = await client.post("/api/documents/my-documents/", headers=headers,
                          json={"document_type": 1, "region": 1, "issued_at": "2026-05-01", "expires_at": "2026-04-01"})
    assert r.json() == {"expires_at": ["The end date must be after the issue date."]}
    r = await client.post("/api/documents/my-documents/", headers=headers,
                          json={"document_type": 1, "region": 1, "number": "77 1", "expires_at": "2026-01-31", "remind_days_before": 3})
    assert r.status_code == 201
    doc = r.json()
    assert doc["region_name"] == "Москва" and doc["has_photo"] is False and doc["status"] in ("valid", "expiring", "expired")

    r = await client.post(f"/api/documents/my-documents/{doc['id']}/photo/", headers=headers,
                          files={"photo": ("p.png", io.BytesIO(b"\x89PNG data"), "image/png")})
    assert r.json()["has_photo"] is True
    r = await client.get(f"/api/documents/my-documents/{doc['id']}/photo/", headers=headers)
    assert r.content == b"\x89PNG data"
    r = await client.post(f"/api/documents/my-documents/{doc['id']}/photo/", headers=headers,
                          files={"photo": ("a.exe", io.BytesIO(b"MZ"), "application/octet-stream")})
    assert r.status_code == 400 and "photo" in r.json()

    r = await client.post("/api/documents/payments/", headers=headers,
                          data={"document": doc["id"], "months": "1", "amount": "10000", "paid_at": "2026-01-20"})
    assert r.status_code == 201
    assert r.json()["document_expires_at"] == "2026-02-28"
    r = await client.post("/api/documents/payments/", headers=headers, data={"document": doc["id"], "months": "13", "amount": "1"})
    assert r.status_code == 400 and "months" in r.json()

    other, _ = await other_user(client)
    r = await client.get(f"/api/documents/my-documents/{doc['id']}/", headers=other)
    assert r.status_code == 404
    r = await client.post("/api/documents/payments/", headers=other, data={"document": doc["id"], "amount": "1"})
    assert r.json() == {"document": ["This is not your document."]}

    r = await client.delete(f"/api/documents/my-documents/{doc['id']}/", headers=headers)
    assert r.status_code == 204


async def other_user(client):
    from tests.conftest import last_code

    email = "other@example.com"
    await client.post("/api/auth/register/", json={"email": email, "password": "Strong-pass-2026"})
    r = await client.post("/api/auth/verify-email/", json={"email": email, "code": last_code(email)})
    if r.status_code != 201:
        r = await client.post("/api/auth/login/", json={"email": email, "password": "Strong-pass-2026"})
    return {"Authorization": f"Bearer {r.json()['access']}"}, r.json()


async def test_editors_change_content(client, user):
    headers, data = user
    news = {"title": "Қонуни нав", "summary": "Кӯтоҳ", "body": "Матн", "document_types": [1], "is_published": True}
    r = await client.post("/api/documents/news/", headers=headers, json=news)
    assert r.status_code == 403
    await set_role(data["user"]["id"], "editor")
    r = await client.post("/api/documents/news/", headers=headers, json=news)
    assert r.status_code == 201 and r.json()["published_at"] and r.json()["document_types"] == [1]
    r = await client.get("/api/documents/news/", params={"document_type": 1, "page_size": 100})
    assert any(n["title"] == "Қонуни нав" for n in r.json()["results"])
    r = await client.patch(f"/api/documents/regions/1/", headers=headers, json={"patent_monthly_price": "10500"})
    assert r.json()["patent_monthly_price"] == "10500.00"
    r = await client.post("/api/documents/exam-questions/", headers=headers,
                          json={"section": "law", "question": "?", "options": ["а"], "answer": 0})
    assert r.json() == {"options": ["Give at least two answers."]}
    r = await client.post("/api/documents/document-types/", headers=headers, json={"slug": "x", "title": "X"})
    assert r.status_code == 403


async def test_reminders_are_sent_once(client, user, outbox):
    from datetime import date, timedelta

    from app.db.session import SessionLocal
    from app.services.reminders import send_due_reminders

    headers, data = user
    end = date.today() + timedelta(days=3)
    r = await client.post("/api/documents/my-documents/", headers=headers,
                          json={"document_type": 2, "expires_at": end.isoformat(), "remind_days_before": 3})
    assert r.status_code == 201
    async with SessionLocal() as db:
        assert await send_due_reminders(db) >= 1
        assert await send_due_reminders(db) == 0
    r = await client.get("/api/auth/notifications/", headers=headers, params={"kind": "reminder"})
    assert r.json()["count"] == 1 and "пас аз 3 рӯз" in r.json()["results"][0]["message"]
    assert any(letter["to"] == data["user"]["email"] for letter in outbox)
