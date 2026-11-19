from datetime import timedelta

from app.services import stats


async def test_remittances_and_monthly_report(client, user):
    headers, _ = user
    year = stats.today().year
    assert (await client.get("/api/money/report/")).status_code == 401
    services = (await client.get("/api/money/services/")).json()
    assert {"value": "korona", "label": "Золотая Корона"} in services

    bad = await client.post("/api/money/remittances/", headers=headers, json={"amount": 0})
    assert bad.status_code == 400
    future = (stats.today() + timedelta(days=2)).isoformat()
    assert (await client.post("/api/money/remittances/", headers=headers,
                              json={"amount": 100, "sent_at": future})).status_code == 400
    assert (await client.post("/api/money/remittances/", headers=headers,
                              json={"amount": 100, "service": "bitcoin"})).status_code == 400

    jan = f"{year}-01-10"
    for body in ({"amount": 20000, "fee": 200, "service": "korona", "recipient": "Модар", "sent_at": jan},
                 {"amount": 15000, "service": "alif", "sent_at": jan},
                 {"amount": 5000, "service": "korona", "sent_at": f"{year - 1}-12-30"}):
        r = await client.post("/api/money/remittances/", headers=headers, json=body)
        assert r.status_code == 201, r.text
    first = r.json()

    doc = (await client.post("/api/documents/my-documents/", headers=headers,
                             json={"document_type": 1, "region": 1, "expires_at": f"{year + 1}-01-31"})).json()
    r = await client.post("/api/documents/payments/", headers=headers,
                          data={"document": doc["id"], "amount": "7500", "paid_at": f"{year}-01-05"})
    assert r.status_code == 201, r.text

    report = (await client.get("/api/money/report/", headers=headers)).json()
    assert report["year"] == year and year - 1 in report["years"]
    january = report["months"][0]
    assert january == {"month": 1, "sent": "35000.00", "fees": "200.00", "patent": "7500.00", "transfers": 2, "payments": 1}
    assert report["totals"] == {"sent": "35000.00", "fees": "200.00", "patent": "7500.00"}
    assert [s["service"] for s in report["services"]] == ["korona", "alif"]

    last_year = (await client.get(f"/api/money/report/?year={year - 1}", headers=headers)).json()
    assert last_year["totals"]["sent"] == "5000.00" and last_year["months"][11]["transfers"] == 1
    listed = (await client.get("/api/money/remittances/", headers=headers)).json()
    assert [r["amount"] for r in listed] == ["15000.00", "20000.00"] and listed[1]["service_label"] == "Золотая Корона"

    other, _ = await other_user(client)
    assert (await client.delete(f"/api/money/remittances/{first['id']}/", headers=other)).status_code == 404
    assert (await client.get("/api/money/report/", headers=other)).json()["totals"]["sent"] == "0.00"
    assert (await client.delete(f"/api/money/remittances/{first['id']}/", headers=headers)).status_code == 204


async def other_user(client):
    from tests.conftest import last_code

    email = "money-other@example.com"
    await client.post("/api/auth/register/", json={"email": email, "password": "Strong-pass-2026", "full_name": "Дигар"})
    data = (await client.post("/api/auth/verify-email/", json={"email": email, "code": last_code(email)})).json()
    return {"Authorization": f"Bearer {data['access']}"}, data
