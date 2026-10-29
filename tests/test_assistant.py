import json

from app.assistant import providers
from app.assistant.tools import run_tool
from app.db.session import SessionLocal


async def test_guests_cannot_chat(client):
    r = await client.post("/api/assistant/", json={"messages": [{"role": "user", "content": "Салом"}]})
    assert r.status_code == 401


async def test_not_configured(client, user):
    headers, _ = user
    assert (await client.get("/api/assistant/")).json() == {"enabled": False}
    r = await client.post("/api/assistant/", headers=headers, json={"messages": [{"role": "user", "content": "Салом"}]})
    assert r.status_code == 503 and r.json()["code"] == "not_configured"


async def test_last_message_must_be_from_user(client, user):
    headers, _ = user
    r = await client.post("/api/assistant/", headers=headers, json={"messages": [{"role": "assistant", "content": "Салом"}]})
    assert r.status_code == 400


async def test_tools():
    async with SessionLocal() as db:
        text, error, path = await run_tool(db, "navigate", {"page": "jobs", "job_search": "курьер", "job_city": "Москва", "job_housing": True})
        assert path == "/jobs?search=%D0%BA%D1%83%D1%80%D1%8C%D0%B5%D1%80&city=%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0&housing_provided=true"
        _, _, path = await run_tool(db, "navigate", {"page": "guides", "guide_document": "patent"})
        assert path.startswith("/guides?type=")
        text, error, _ = await run_tool(db, "patent_price", {"region": "Свердловской области"})
        assert not error and json.loads(text)["regions"][0]["name"] == "Свердловская область"
        text, error, _ = await run_tool(db, "my_documents", {})
        assert error
        text, error, _ = await run_tool(db, "guide_steps", {"document": "patent"})
        assert json.loads(text)["steps"]


async def test_answer_opens_a_page(client, user, monkeypatch):
    headers, _ = user
    async def fake_gemini(system_text, visitor_note, messages, run):
        assert "Never use rude words" in system_text and "Tajik" in visitor_note
        await run.tool("navigate", {"page": "calculator"})
        return {"reply": "Калкулятор кушода шуд.", "refused": False, "truncated": False}

    monkeypatch.setattr(providers.settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(providers, "_ask_gemini", fake_gemini)
    r = await client.post("/api/assistant/", headers=headers,
                          json={"messages": [{"role": "user", "content": "Калкуляторро кушо"}], "page": "/"})
    assert r.json() == {"reply": "Калкулятор кушода шуд.", "refused": False, "truncated": False, "navigate": "/calculator"}
