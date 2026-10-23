from datetime import timedelta

from app.db.session import SessionLocal
from app.db.types import utcnow
from app.models import Employer, Job, JobAlert, Notification
from app.services.alerts import notify_alerts


async def make_jobs():
    async with SessionLocal() as db:
        good = Employer(name="ООО Строй", city="Москва", external_id="t-1")
        bad = Employer(name="Обман", city="Москва", external_id="t-2", is_blacklisted=True)
        db.add_all([good, bad])
        await db.flush()
        db.add_all([
            Job(employer_id=good.id, title="Курьер", description="доставка", industry="delivery", city="Москва",
                salary_from=90000, housing_provided=True, external_id="j-1"),
            Job(employer_id=good.id, title="Грузчик", description="склад", industry="warehouse", city="Казань",
                salary_from=50000, salary_to=60000, external_id="j-2"),
            Job(employer_id=bad.id, title="Курьер обман", description="", industry="delivery", city="Москва", external_id="j-3"),
            Job(employer_id=good.id, title="Старое", description="", industry="other", city="Москва", external_id="j-4",
                expires_at=utcnow() - timedelta(days=1)),
        ])
        await db.commit()


async def test_jobs_filters_saved_reviews_alerts(client, user):
    await make_jobs()
    headers, data = user
    r = await client.get("/api/jobs/jobs/", params={"page_size": 100})
    titles = [j["title"] for j in r.json()["results"]]
    assert "Курьер" in titles and "Курьер обман" not in titles and "Старое" not in titles  # blacklisted and expired hidden
    r = await client.get("/api/jobs/jobs/", params={"search": "курьер", "city": "москва", "housing_provided": "true"})
    assert [j["title"] for j in r.json()["results"]] == ["Курьер"]
    job = r.json()["results"][0]
    assert job["industry_label"] == "Расонидан" and job["is_saved"] is False and job["employer"]["name"] == "ООО Строй"
    r = await client.get("/api/jobs/jobs/", params={"min_salary": 55000, "page_size": 100})
    assert {j["title"] for j in r.json()["results"]} >= {"Курьер", "Грузчик"}

    assert (await client.post(f"/api/jobs/jobs/{job['id']}/save/", headers=headers)).json() == {"is_saved": True}
    r = await client.get("/api/jobs/jobs/", headers=headers, params={"saved": "true"})
    assert r.json()["count"] == 1 and r.json()["results"][0]["is_saved"] is True
    r = await client.get("/api/jobs/jobs/", params={"saved": "true"})
    assert r.json()["count"] == 0

    r = await client.post("/api/jobs/reviews/", headers=headers, json={"employer": job["employer"]["id"], "rating": 1, "salary_not_paid": True})
    assert r.status_code == 201 and r.json()["author_name"] == "Али"
    r = await client.post("/api/jobs/reviews/", headers=headers, json={"employer": job["employer"]["id"], "rating": 5})
    assert "employer" in r.json()

    r = await client.post("/api/jobs/alerts/", headers=headers, json={"search": "курьер", "city": "Москва"})
    assert r.status_code == 201
    since = utcnow() - timedelta(minutes=5)
    async with SessionLocal() as db:
        told = await notify_alerts(db, since)
        assert told >= 1
        from sqlalchemy import select

        note = await db.scalar(select(Notification).where(Notification.user_id == data["user"]["id"], Notification.kind == "job"))
        assert "Курьер" in note.message
    r = await client.get("/api/auth/notifications/unread-count/", headers=headers)
    assert r.json()["count"] >= 1
