from datetime import date, timedelta

from tests.conftest import set_role
from tests.test_feedback import register

TEAM = {"name": "Бригадаи Саид", "trade": "repair", "city": "Москва", "size": 5, "experience_years": 7,
        "price_note": "аз 1500 ₽ барои 1 м²", "description": "Таъмири пурраи хона.", "phone": "+7 999 111-22-33"}


async def test_masters_build_a_team_and_customers_hire_it(client, user):
    editor, data = user
    leader = await register(client, "brigade-leader@example.com", "Саид Раҳимов")
    master = await register(client, "brigade-master@example.com", "Фаррух Назаров")
    customer = await register(client, "brigade-customer@example.com", "Иван Петров")

    assert (await client.post("/api/brigades/", json=TEAM)).status_code == 401
    assert (await client.post("/api/brigades/", headers=leader, json={**TEAM, "phone": ""})).status_code == 400
    r = await client.post("/api/brigades/", headers=leader, json=TEAM)
    assert r.status_code == 201, r.text
    team = r.json()
    assert team["mine"] and team["members"] == 1 and team["phone"] == "+79991112233"

    ids = lambda r: [b["id"] for b in r.json()["results"]]
    assert team["id"] in ids(await client.get("/api/brigades/?trade=repair&city=моск&free=true"))
    assert team["id"] not in ids(await client.get("/api/brigades/?trade=welding"))
    guest = next(b for b in (await client.get("/api/brigades/")).json()["results"] if b["id"] == team["id"])
    assert guest["phone"] == ""
    summary = (await client.get("/api/brigades/summary/")).json()
    assert summary["total"] >= 1 and next(t for t in summary["trades"] if t["value"] == "repair")["count"] >= 1

    assert (await client.post(f"/api/brigades/{team['id']}/join/", headers=leader, json={})).status_code == 400
    r = await client.post(f"/api/brigades/{team['id']}/join/", headers=master, json={"skill": "Кафелгузор"})
    assert r.status_code == 201
    assert (await client.post(f"/api/brigades/{team['id']}/join/", headers=master, json={})).status_code == 400
    seen = (await client.get(f"/api/brigades/{team['id']}/", headers=customer)).json()
    assert [m["status"] for m in seen["team"]] == ["leader"]
    seen = (await client.get(f"/api/brigades/{team['id']}/", headers=leader)).json()
    pending = next(m for m in seen["team"] if m["status"] == "pending")
    assert pending["skill"] == "Кафелгузор"
    path = f"/api/brigades/{team['id']}/members/{pending['id']}/"
    assert (await client.patch(path, headers=master, json={"status": "accepted"})).status_code == 403
    assert (await client.patch(path, headers=leader, json={"status": "accepted"})).status_code == 200
    seen = (await client.get(f"/api/brigades/{team['id']}/", headers=master)).json()
    assert seen["my_status"] == "accepted" and seen["members"] == 2
    assert team["id"] in ids(await client.get("/api/brigades/?mine=true", headers=master))

    order = {"description": "Таъмири ошхона, 12 м².", "city": "Москва", "workers": 3, "budget": 80000, "phone": "+7 916 000-11-22"}
    assert (await client.post(f"/api/brigades/{team['id']}/orders/", headers=leader, json=order)).status_code == 400
    old = (date.today() - timedelta(days=2)).isoformat()
    r = await client.post(f"/api/brigades/{team['id']}/orders/", headers=customer, json={**order, "start_date": old})
    assert "start_date" in r.json()
    r = await client.post(f"/api/brigades/{team['id']}/orders/", headers=customer, json=order)
    assert r.status_code == 201, r.text
    sent = r.json()
    assert (await client.get("/api/brigades/summary/", headers=leader)).json()["incoming_new"] == 1
    incoming = (await client.get("/api/brigades/orders/", headers=leader)).json()["results"]
    assert incoming[0]["id"] == sent["id"] and incoming[0]["phone"] == "+79160001122" and incoming[0]["incoming"]
    assert (await client.get("/api/brigades/orders/?box=out", headers=customer)).json()["count"] == 1

    opath = f"/api/brigades/orders/{sent['id']}/"
    assert (await client.patch(opath, headers=customer, json={"status": "accepted"})).status_code == 403
    assert (await client.patch(opath, headers=leader, json={"status": "done"})).status_code == 400
    assert (await client.post(f"{opath}review/", headers=customer, json={"rating": 5})).status_code == 400
    assert (await client.patch(opath, headers=leader, json={"status": "accepted"})).json()["status"] == "accepted"
    assert (await client.delete(opath, headers=customer)).status_code == 400
    assert (await client.patch(opath, headers=leader, json={"status": "done"})).json()["status"] == "done"
    assert (await client.post(f"{opath}review/", headers=leader, json={"rating": 5})).status_code == 400
    r = await client.post(f"{opath}review/", headers=customer, json={"rating": 5, "text": "Кори тоза, сари вақт."})
    assert r.status_code == 201
    assert (await client.post(f"{opath}review/", headers=customer, json={"rating": 4})).status_code == 400
    seen = (await client.get(f"/api/brigades/{team['id']}/", headers=customer)).json()
    assert seen["rating"] == 5.0 and seen["reviews"] == 1 and seen["jobs_done"] == 1
    assert seen["review_list"][0]["text"] == "Кори тоза, сари вақт."

    assert (await client.patch(f"/api/brigades/{team['id']}/", headers=customer, json={"is_free": False})).status_code == 403
    r = await client.patch(f"/api/brigades/{team['id']}/", headers=leader, json={"is_free": False, "size": 6})
    assert r.status_code == 200 and r.json()["is_free"] is False and r.json()["size"] == 6
    assert (await client.patch(f"/api/brigades/{team['id']}/", headers=leader, json={"is_hidden": True})).status_code == 403
    await set_role(data["user"]["id"], "editor")
    assert (await client.patch(f"/api/brigades/{team['id']}/", headers=editor, json={"is_hidden": True})).status_code == 200
    assert team["id"] not in ids(await client.get("/api/brigades/"))
    assert (await client.get(f"/api/brigades/{team['id']}/", headers=customer)).status_code == 404
    assert (await client.delete(f"/api/brigades/{team['id']}/join/", headers=master)).status_code == 204
    assert (await client.delete(f"/api/brigades/{team['id']}/", headers=customer)).status_code == 404
    assert (await client.delete(f"/api/brigades/{team['id']}/", headers=leader)).status_code == 204
