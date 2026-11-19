from app.services import stats


async def test_monthly_patent_report(client, user):
    headers, _ = user
    year = stats.today().year
    assert (await client.get("/api/money/report/")).status_code == 401
    assert (await client.get("/api/money/remittances/", headers=headers)).status_code == 404

    doc = (await client.post("/api/documents/my-documents/", headers=headers,
                             json={"document_type": 1, "region": 1, "expires_at": f"{year + 1}-01-31"})).json()
    for paid_at, amount in ((f"{year}-01-05", "7500"), (f"{year}-01-25", "2500"), (f"{year}-03-05", "7500"),
                            (f"{year - 1}-12-05", "7000")):
        r = await client.post("/api/documents/payments/", headers=headers,
                              data={"document": doc["id"], "amount": amount, "paid_at": paid_at})
        assert r.status_code == 201, r.text

    report = (await client.get("/api/money/report/", headers=headers)).json()
    assert report["year"] == year and year - 1 in report["years"]
    assert report["months"][0] == {"month": 1, "paid": "10000.00", "payments": 2}
    assert report["months"][1] == {"month": 2, "paid": "0.00", "payments": 0}
    assert report["total"] == "17500.00" and report["payments"] == 3
    assert len(report["documents"]) == 1 and report["documents"][0]["paid"] == "17500.00"

    last_year = (await client.get(f"/api/money/report/?year={year - 1}", headers=headers)).json()
    assert last_year["total"] == "7000.00" and last_year["months"][11]["payments"] == 1

    other, _ = await other_user(client)
    assert (await client.get("/api/money/report/", headers=other)).json()["total"] == "0.00"


async def other_user(client):
    from tests.conftest import last_code

    email = "money-other@example.com"
    await client.post("/api/auth/register/", json={"email": email, "password": "Strong-pass-2026", "full_name": "Дигар"})
    data = (await client.post("/api/auth/verify-email/", json={"email": email, "code": last_code(email)})).json()
    return {"Authorization": f"Bearer {data['access']}"}, data
