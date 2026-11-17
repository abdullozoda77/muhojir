from app.models import scam_key
from tests.conftest import last_code, set_role


async def register(client, email, name):
    await client.post("/api/auth/register/", json={"email": email, "password": "Strong-pass-2026", "full_name": name})
    r = await client.post("/api/auth/verify-email/", json={"email": email, "code": last_code(email)})
    return {"Authorization": f"Bearer {r.json()['access']}"}


def test_keys_ignore_how_the_value_is_written():
    assert scam_key("phone", "8 (999) 123-45-67") == scam_key("phone", "+79991234567") == "79991234567"
    assert scam_key("telegram", "https://t.me/Patent_Fast") == scam_key("telegram", "@patent_fast") == "patent_fast"
    assert scam_key("website", "https://www.Patent-Bystro.ru/order?x=1") == "patent-bystro.ru"
    assert scam_key("card", "2202 2000 1111 2222") == "2202200011112222"


async def test_report_is_hidden_until_an_editor_approves_it(client, user):
    editor, data = user
    await set_role(data["user"]["id"], "editor")
    sender = await register(client, "scam@example.com", "Ҷамшед Раҳимов")
    report = {"kind": "phone", "value": "8 999 123-45-67", "scheme": "patent",
              "description": "Барои патенти тез 15 000 рубл гирифт ва телефонро хомӯш кард.", "city": "Москва",
              "lost_amount": 15000}
    r = await client.post("/api/scams/", json=report)
    assert r.status_code == 401
    r = await client.post("/api/scams/", headers=sender, json={**report, "description": "кӯтоҳ"})
    assert "description" in r.json()
    r = await client.post("/api/scams/", headers=sender, json=report)
    assert r.status_code == 201, r.text
    scam = r.json()
    assert scam["status"] == "pending"
    r = await client.post("/api/scams/", headers=sender, json=report)
    assert "value" in r.json()

    r = await client.get("/api/scams/check/", params={"q": "+7 (999) 123 45 67"})
    assert r.json()["found"] is False
    r = await client.get("/api/scams/")
    assert r.json()["count"] == 0
    r = await client.get("/api/auth/notifications/", headers=editor)
    assert any("79991234567" in n["message"] or "999 123-45-67" in n["message"] for n in r.json()["results"])

    r = await client.get("/api/scams/review/", headers=sender)
    assert r.status_code == 403
    r = await client.get("/api/scams/review/", headers=editor, params={"status": "pending"})
    assert [s["id"] for s in r.json()["results"]] == [scam["id"]]
    r = await client.patch(f"/api/scams/{scam['id']}/", headers=editor, json={"status": "approved"})
    assert r.json()["status"] == "approved"

    r = await client.get("/api/scams/check/", params={"q": "+7 (999) 123 45 67"})
    found = r.json()
    assert found["found"] is True and found["results"][0]["city"] == "Москва" and "status" not in found["results"][0]
    r = await client.get("/api/scams/", params={"search": "89991234567"})
    assert r.json()["results"][0]["reports"] == 1
    r = await client.get("/api/auth/notifications/", headers=sender)
    assert any("тасдиқ шуд" in n["message"] for n in r.json()["results"])
    r = await client.get("/api/scams/mine/", headers=sender)
    assert r.json()[0]["status"] == "approved"
    r = await client.delete(f"/api/scams/{scam['id']}/", headers=sender)
    assert r.status_code == 404


async def test_check_needs_something_to_search(client):
    r = await client.get("/api/scams/check/", params={"q": "ab"})
    assert r.status_code == 400 and "q" in r.json()
