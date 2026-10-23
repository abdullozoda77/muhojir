from datetime import date

import httpx
import pytest

from app.core import cache
from app.db.session import SessionLocal
from app.models import Place
from app.services import flights

NEXT_MONTH = f"{date(date.today().year + (date.today().month == 12), date.today().month % 12 + 1, 1):%Y-%m}"


@pytest.fixture
def aviasales(monkeypatch):
    """A fake Aviasales API: three tickets DYU→MOW, two of them on the same day."""
    calls = []

    def answer(request):
        calls.append(request)
        assert request.headers["X-Access-Token"] == "tp-test"
        data = [
            {"origin": "DYU", "destination": "MOW", "origin_airport": "DYU", "destination_airport": "VKO", "price": 15400,
             "airline": "SZ", "flight_number": "201", "departure_at": f"{NEXT_MONTH}-05T06:10:00+05:00", "transfers": 0,
             "duration": 285, "link": "/search/DYU0511MOW1?t=1"},
            {"origin": "DYU", "destination": "MOW", "price": 12900, "airline": "DP", "flight_number": "6703",
             "departure_at": f"{NEXT_MONTH}-05T09:00:00+05:00", "transfers": 0, "link": "/search/x"},
            {"origin": "DYU", "destination": "MOW", "price": 18000, "airline": "XX", "flight_number": "1",
             "departure_at": f"{NEXT_MONTH}-09T09:00:00+05:00", "transfers": 1, "link": "/search/y"},
        ]
        return httpx.Response(200, json={"success": True, "currency": "rub", "data": data})

    real = httpx.AsyncClient
    monkeypatch.setattr(flights.httpx, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(answer), **kw))
    monkeypatch.setattr(flights.settings, "travelpayouts_token", "tp-test")
    cache._memory.clear()
    return calls


async def test_airports(client):
    r = await client.get("/api/flights/airports/", params={"country": "TJ"})
    assert [a["code"] for a in r.json()] == ["DYU", "LBD", "KQT", "TJU"]
    r = await client.get("/api/flights/airports/")
    moscow = [a for a in r.json() if a["city_code"] == "MOW"]
    assert {a["code"] for a in moscow} == {"SVO", "DME", "VKO", "ZIA"} and moscow[0]["city_tg"] == "Маскав"


async def test_prices_without_token_give_search_link(client):
    r = await client.get("/api/flights/prices/", params={"origin": "dyu", "destination": "MOW", "month": NEXT_MONTH})
    data = r.json()
    assert data["enabled"] is False and data["results"] == []
    assert data["search_url"] == f"https://www.aviasales.ru/search/DYU01{NEXT_MONTH[5:]}MOW1"


async def test_prices_only_between_tajikistan_and_russia(client):
    r = await client.get("/api/flights/prices/", params={"origin": "MOW", "destination": "LED"})
    assert r.status_code == 400
    r = await client.get("/api/flights/prices/", params={"origin": "XXX", "destination": "DYU"})
    assert r.json() == {"origin": ["Unknown airport or city: XXX."]}
    r = await client.get("/api/flights/prices/", params={"origin": "DYU", "destination": "MOW", "month": "2020-01"})
    assert "month" in r.json()


async def test_prices_with_token(client, aviasales):
    r = await client.get("/api/flights/prices/", params={"origin": "DYU", "destination": "MOW", "month": NEXT_MONTH})
    data = r.json()
    assert data["enabled"] is True
    first = data["results"][0]
    assert first["airline_name"] == "Somon Air" and first["destination_airport"] == "VKO"
    assert first["link"] == "https://www.aviasales.ru/search/DYU0511MOW1?t=1"
    assert data["calendar"] == {f"{NEXT_MONTH}-05": 12900, f"{NEXT_MONTH}-09": 18000}  # the cheapest of each day
    assert data["results"][2]["airline_name"] == "XX"  # unknown airlines keep their code
    await client.get("/api/flights/prices/", params={"origin": "DYU", "destination": "MOW", "month": NEXT_MONTH})
    assert len(aviasales) == 1  # the second answer came from the cache


async def test_price_watch_tells_once(client, user, aviasales):
    headers, data = user
    r = await client.post("/api/flights/watches/", headers=headers,
                          json={"origin": "dyu", "destination": "MOW", "month": NEXT_MONTH, "max_price": 14000})
    assert r.status_code == 201 and r.json()["origin"] == "DYU"
    async with SessionLocal() as db:
        assert await flights.check_watches(db) >= 1
        assert await flights.check_watches(db) == 0  # the same price is not told twice
    r = await client.get("/api/auth/notifications/", headers=headers)
    assert "12 900 ₽" in r.json()["results"][0]["message"]
    r = await client.get("/api/flights/watches/", headers=headers)
    assert r.json()[0]["last_price"] == 12900


async def add_places():
    async with SessionLocal() as db:
        db.add_all([
            Place(category="mosque", name="Соборная мечеть", region="Москва", city="Москва", address="Выползов переулок 7",
                  lat=55.7790, lon=37.6260, external_id="osm:way/1"),
            Place(category="food", name="Чайхана Душанбе", region="Москва", city="Москва", address="улица Ленина 1",
                  lat=55.7000, lon=37.6000, external_id="osm:node/2"),
            Place(category="food", name="Плов центр", region="Санкт-Петербург", city="Санкт-Петербург", address="Невский 1",
                  lat=59.93, lon=30.36, external_id="osm:node/3"),
        ])
        await db.commit()


async def test_places_filters_map_and_reviews(client, user):
    await add_places()
    headers, _ = user
    r = await client.get("/api/places/", params={"category": "food", "region": "Москва"})
    assert [p["name"] for p in r.json()["results"]] == ["Чайхана Душанбе"]
    r = await client.get("/api/places/", params={"search": "чайхана"})
    assert r.json()["count"] >= 1  # case does not matter
    r = await client.get("/api/places/", params={"near": "55.7792,37.6262", "category": "mosque,food", "region": "Москва"})
    results = r.json()["results"]
    assert results[0]["name"] == "Соборная мечеть" and results[0]["distance_km"] < 1
    r = await client.get("/api/places/map/", params={"bbox": "30,59,31,60"})
    assert [p["name"] for p in r.json()] == ["Плов центр"]
    r = await client.get("/api/places/summary/")
    assert r.json()["categories"]["food"] >= 2 and any(x["name"] == "Москва" for x in r.json()["regions"])

    place_id = results[0]["id"]
    r = await client.put(f"/api/places/{place_id}/reviews/mine/", headers=headers, json={"rating": 5, "text": "Хуб"})
    assert r.status_code == 200 and r.json()["is_mine"] is True
    r = await client.put(f"/api/places/{place_id}/reviews/mine/", headers=headers, json={"rating": 4})
    assert r.json()["rating"] == 4  # the same review is changed, not a second one
    r = await client.get(f"/api/places/{place_id}/", headers=headers)
    assert r.json()["rating"] == 4.0 and r.json()["reviews_count"] == 1 and r.json()["my_review"]["rating"] == 4
    r = await client.put(f"/api/places/{place_id}/reviews/mine/", json={"rating": 4})
    assert r.status_code == 401


async def test_suggested_place_waits_for_an_editor(client, user):
    headers, data = user
    r = await client.post("/api/places/", headers=headers, json={"category": "halal", "name": "Халял маркет",
                                                                  "region": "Москва", "address": "улица Мира 5"})
    assert r.status_code == 201 and r.json()["is_approved"] is False
    place_id = r.json()["id"]
    assert (await client.get(f"/api/places/{place_id}/")).status_code == 404  # guests do not see it yet
    assert (await client.get(f"/api/places/{place_id}/", headers=headers)).status_code == 200  # its author does


async def test_assistant_tools_for_travel():
    from app.assistant.tools import run_tool

    async with SessionLocal() as db:
        _, _, path = await run_tool(db, "navigate", {"page": "tickets", "tickets_from": "dyu", "tickets_to": "mow"})
        assert path == "/tickets?from=DYU&to=MOW"
        _, _, path = await run_tool(db, "navigate", {"page": "places", "places_category": "mosque", "places_region": "Москва"})
        assert path.startswith("/places?category=mosque&region=")
        text, error, _ = await run_tool(db, "flight_prices", {"origin": "MOW", "destination": "LED"})
        assert error
