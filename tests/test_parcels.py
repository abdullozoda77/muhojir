from datetime import date, timedelta

from tests.conftest import set_role
from tests.test_feedback import register

SOON = (date.today() + timedelta(days=5)).isoformat()
TRIP = {"kind": "carry", "from_city": "Москва", "to_city": "Хуҷанд", "travel_date": SOON, "weight_kg": 10,
        "price_per_kg": 500, "description": "Ҳуҷҷат ва дору намебарам.", "phone": "+7 999 123-45-67"}


async def test_people_post_trips_and_parcels(client, user):
    editor, data = user
    traveller = await register(client, "parcel-traveller@example.com", "Аҳмад Солиев")
    assert (await client.post("/api/parcels/", json=TRIP)).status_code == 401
    assert (await client.post("/api/parcels/", headers=traveller, json={**TRIP, "phone": ""})).status_code == 400
    old = (date.today() - timedelta(days=1)).isoformat()
    r = await client.post("/api/parcels/", headers=traveller, json={**TRIP, "travel_date": old})
    assert "travel_date" in r.json()
    r = await client.post("/api/parcels/", headers=traveller, json=TRIP)
    assert r.status_code == 201, r.text
    trip = r.json()
    assert trip["mine"] and trip["phone"] == "+79991234567" and trip["kind_label"] == "Мебарам"
    r = await client.post("/api/parcels/", headers=traveller, json={**TRIP, "kind": "send", "to_city": "Кӯлоб", "price_per_kg": None})
    assert r.status_code == 201

    ids = lambda r: [p["id"] for p in r.json()["results"]]
    assert trip["id"] in ids(await client.get("/api/parcels/?kind=carry&to_city=хуҷанд"))
    assert trip["id"] not in ids(await client.get("/api/parcels/?kind=send"))
    assert (await client.get("/api/parcels/summary/")).json()["kinds"]["send"] >= 1

    await set_role(data["user"]["id"], "editor")
    assert (await client.patch(f"/api/parcels/{trip['id']}/", headers=traveller, json={"is_hidden": True})).status_code == 403
    assert (await client.patch(f"/api/parcels/{trip['id']}/", headers=editor, json={"is_hidden": True})).status_code == 200
    assert trip["id"] not in ids(await client.get("/api/parcels/"))
    other = await register(client, "parcel-other@example.com", "Ҷамшед Камолов")
    assert (await client.delete(f"/api/parcels/{trip['id']}/", headers=other)).status_code == 404
    assert (await client.delete(f"/api/parcels/{trip['id']}/", headers=traveller)).status_code == 204
