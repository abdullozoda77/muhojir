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


async def test_new_navigation_targets():
    async with SessionLocal() as db:
        _, _, path = await run_tool(db, "navigate", {"page": "housing", "housing_city": "Москва", "housing_kind": "bed",
                                                     "housing_max_price": 15000, "housing_registration": True})
        assert path == "/housing?city=%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0&kind=bed&max_price=15000&registration=true"
        _, _, path = await run_tool(db, "navigate", {"page": "shops", "shops_category": "meat"})
        assert path == "/shops?category=meat"
        _, _, path = await run_tool(db, "navigate", {"page": "lesson", "course_level": 1, "course_lesson": 2})
        assert path == "/course/1/2"
        _, _, path = await run_tool(db, "navigate", {"page": "course_stats"})
        assert path == "/course/stats"


async def test_search_tools_and_rate(monkeypatch):
    from datetime import date

    from app.models import ExchangeRate
    from app.services import rates

    async def fresh(db):
        return None

    monkeypatch.setattr(rates, "ensure_fresh", fresh)
    async with SessionLocal() as db:
        db.add(ExchangeRate(source="nbt", day=date(2026, 10, 31), value=0.1144))
        await db.commit()
        text, error, _ = await run_tool(db, "exchange_rate", {"amount": 10000, "direction": "rub_to_tjs"})
        data = json.loads(text)
        assert not error and data["converted"] == {"rub": 10000, "tjs": 1144.0}
        for name, args in (("find_housing", {"city": "Москва", "cheapest": True}), ("find_shops", {"search": "курага"}),
                           ("check_employer", {"name": "ООО"})):
            text, error, _ = await run_tool(db, name, args)
            assert not error, (name, text)
        text, error, _ = await run_tool(db, "my_course", {})
        assert error


async def test_my_course_and_activity(client, user):
    from app.models import User

    headers, data = user
    await client.post("/api/course/levels/1/lessons/1/complete/", headers=headers, json={"score": 80})
    async with SessionLocal() as db:
        me = await db.get(User, data["user"]["id"])
        text, error, _ = await run_tool(db, "my_course", {}, me)
        course = json.loads(text)
        assert not error and course["lessons_done"] == 1 and course["next"]["level"] == 1 and course["next"]["lesson"] == 2
        text, error, _ = await run_tool(db, "my_activity", {}, me)
        assert not error and json.loads(text)["totals"]["lessons"] == 1


async def test_every_page_and_items_open(client, user):
    from app.assistant.tools import ITEM_PAGES, PAGES
    from app.models import User

    _, data = user
    async with SessionLocal() as db:
        me = await db.get(User, data["user"]["id"])
        for page in PAGES:
            args = {"page": page, "item_id": 7, "course_level": 2, "course_lesson": 1}
            text, error, path = await run_tool(db, "navigate", args, me)
            if page == "my_certificate":
                assert error and path is None
            else:
                assert not error and path.startswith("/"), (page, text)
        assert (await run_tool(db, "navigate", {"page": "job", "item_id": 7}))[2] == "/jobs/7"
        assert (await run_tool(db, "navigate", {"page": "course_exam", "course_level": 3}))[2] == "/course/3/exam"
        assert (await run_tool(db, "navigate", {"page": "my_housing"}))[2] == "/housing?tab=mine"
        assert set(ITEM_PAGES) <= set(PAGES)
        text, error, _ = await run_tool(db, "navigate", {"page": "shop"})
        assert error
        text, error, _ = await run_tool(db, "latest_news", {})
        assert not error
