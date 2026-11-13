from app.assistant import providers
from app.services import translate
from tests.conftest import last_code, set_role

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64
PDF = b"%PDF-1.4\n" + b"0" * 64


async def register(client, email, name):
    await client.post("/api/auth/register/", json={"email": email, "password": "Strong-pass-2026", "full_name": name})
    r = await client.post("/api/auth/verify-email/", json={"email": email, "code": last_code(email)})
    return {"Authorization": f"Bearer {r.json()['access']}"}


async def test_options_and_guests(client):
    r = await client.get("/api/translations/options/")
    data = r.json()
    assert [lang["code"] for lang in data["languages"]] == ["tg", "ru", "en", "zh"]
    assert data["ai_enabled"] is False and any(d["code"] == "passport" for d in data["doc_types"])
    r = await client.post("/api/translations/ai/", data={"target_lang": "ru", "text": "Салом"})
    assert r.status_code == 401


async def test_ai_translation(client, user, monkeypatch):
    headers, _ = user
    r = await client.post("/api/translations/ai/", headers=headers, data={"target_lang": "ru", "text": "Салом"})
    assert r.status_code == 503 and r.json()["code"] == "not_configured"

    calls = []

    async def fake_gemini(prompt, text, data, mime):
        calls.append((prompt, text, data, mime))
        return "NO_TEXT" if text.endswith("...") else "Здравствуйте"

    monkeypatch.setattr(providers.settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(translate, "_gemini", fake_gemini)

    r = await client.post("/api/translations/ai/", headers=headers, data={"target_lang": "ru"})
    assert "text" in r.json()
    r = await client.post("/api/translations/ai/", headers=headers, data={"source_lang": "ru", "target_lang": "ru", "text": "да"})
    assert "target_lang" in r.json()
    r = await client.post("/api/translations/ai/", headers=headers, data={"target_lang": "fr", "text": "Салом"})
    assert r.status_code == 400

    r = await client.post("/api/translations/ai/", headers=headers, data={"source_lang": "tg", "target_lang": "ru", "text": "Салом"})
    assert r.status_code == 201, r.text
    assert r.json()["result_text"] == "Здравствуйте" and r.json()["direction"] == "Тоҷикӣ → Русӣ"
    assert "from Tajik" in calls[-1][0] and "into Russian" in calls[-1][0]

    r = await client.post("/api/translations/ai/", headers=headers, data={"target_lang": "zh"},
                          files={"file": ("passport.png", PNG, "image/png")})
    assert r.status_code == 201, r.text
    assert calls[-1][3] == "image/png" and "Simplified Chinese" in calls[-1][0] and "detect its language" in calls[-1][0]
    assert r.json()["file"] is None and r.json()["file_name"] == "passport.png"

    r = await client.post("/api/translations/ai/", headers=headers, data={"target_lang": "en"},
                          files={"file": ("contract.pdf", PDF, "application/pdf")})
    assert calls[-1][3] == "application/pdf"
    r = await client.post("/api/translations/ai/", headers=headers, data={"target_lang": "en"},
                          files={"file": ("notes.txt", b"hello", "text/plain")})
    assert "file" in r.json()
    r = await client.post("/api/translations/ai/", headers=headers, data={"target_lang": "en", "text": "..."})
    assert r.status_code == 422 and r.json()["code"] == "no_text"

    mine = (await client.get("/api/translations/mine/", headers=headers)).json()
    assert len(mine) == 3 and all(t["kind"] == "ai" for t in mine)
    r = await client.delete(f"/api/translations/{mine[0]['id']}/", headers=headers)
    assert r.status_code == 204


async def test_certified_order(client, user):
    editor, data = user
    await set_role(data["user"]["id"], "editor")
    owner = await register(client, "translate@example.com", "Фарида Раҳимова")
    other = await register(client, "translate-stranger@example.com", "Бегона Одам")

    r = await client.post("/api/translations/orders/", headers=owner, data={"source_lang": "tg", "target_lang": "ru"},
                          files={"file": ("diploma.jpg", PNG, "image/png")})
    assert "phone" in r.json()
    r = await client.post("/api/translations/orders/", headers=owner,
                          data={"source_lang": "tg", "target_lang": "ru", "doc_type": "diploma", "notarized": "true",
                                "phone": "+79991234567", "note": "Барои кор лозим"},
                          files={"file": ("diploma.jpg", PNG, "image/png")})
    assert r.status_code == 201, r.text
    order = r.json()
    assert order["status"] == "new" and order["notarized"] and order["file"] and "email" not in order

    notes = (await client.get("/api/auth/notifications/", headers=editor)).json()["results"]
    assert any("Фарида" in n["message"] and "нотариус" in n["message"] for n in notes)

    assert (await client.get(f"/api/translations/{order['id']}/file/", headers=other)).status_code == 404
    assert (await client.get(f"/api/translations/{order['id']}/file/", headers=owner)).content == PNG
    assert (await client.get("/api/translations/orders/", headers=owner)).status_code == 403
    listed = (await client.get("/api/translations/orders/", headers=editor, params={"status": "new"})).json()["results"]
    assert any(o["id"] == order["id"] and o["email"] == "translate@example.com" for o in listed)

    r = await client.patch(f"/api/translations/{order['id']}/", headers=editor, json={"status": "priced"})
    assert "price" in r.json()
    r = await client.patch(f"/api/translations/{order['id']}/", headers=editor,
                           json={"status": "priced", "price": 1500, "editor_note": "Нотариус дар Москва"})
    assert r.json()["status"] == "priced" and r.json()["price"] == 1500
    r = await client.patch(f"/api/translations/{order['id']}/", headers=editor, json={"status": "done"})
    assert "status" in r.json()
    notes = (await client.get("/api/auth/notifications/", headers=owner)).json()["results"]
    assert any("1500 ₽" in n["message"] and "Нотариус дар Москва" in n["message"] for n in notes)

    r = await client.post(f"/api/translations/{order['id']}/result/", headers=editor,
                          files={"file": ("diploma-ru.pdf", PDF, "application/pdf")})
    assert r.json()["status"] == "done" and r.json()["result"]
    assert (await client.get(f"/api/translations/{order['id']}/result/", headers=owner)).content == PDF
    notes = (await client.get("/api/auth/notifications/", headers=owner)).json()["results"]
    assert any("Тарҷума тайёр аст" in n["message"] for n in notes)

    r = await client.post(f"/api/translations/{order['id']}/cancel/", headers=owner)
    assert r.status_code == 400
    assert (await client.delete(f"/api/translations/{order['id']}/", headers=owner)).status_code == 204


async def test_cancel_order(client, user):
    headers, _ = user
    r = await client.post("/api/translations/orders/", headers=headers,
                          data={"source_lang": "ru", "target_lang": "en", "phone": "+79990001122"},
                          files={"file": ("contract.pdf", PDF, "application/pdf")})
    order = r.json()
    assert (await client.delete(f"/api/translations/{order['id']}/", headers=headers)).status_code == 400
    r = await client.post(f"/api/translations/{order['id']}/cancel/", headers=headers)
    assert r.json()["status"] == "cancelled"
    assert (await client.delete(f"/api/translations/{order['id']}/", headers=headers)).status_code == 204
