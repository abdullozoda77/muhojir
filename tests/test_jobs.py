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
    assert "Курьер" in titles and "Курьер обман" not in titles and "Старое" not in titles
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


async def test_blacklist_reports(client, user):
    async with SessionLocal() as db:
        employer = Employer(name="Плохой работодатель", city="Москва", external_id="b-1")
        db.add(employer)
        await db.flush()
        job = Job(employer_id=employer.id, title="Разнорабочий", description="", industry="other", city="Москва", external_id="bj-1")
        db.add(job)
        await db.commit()
        job_id, employer_id = job.id, employer.id
    headers, _ = user

    assert (await client.post(f"/api/jobs/jobs/{job_id}/blacklist/", json={"reason": "Не заплатили за месяц работы"})).status_code == 401
    r = await client.post(f"/api/jobs/jobs/{job_id}/blacklist/", headers=headers, json={"reason": "коротко"})
    assert r.status_code == 400 and "reason" in r.json()
    r = await client.post(f"/api/jobs/jobs/{job_id}/blacklist/", headers=headers, json={"reason": "Не заплатили за месяц работы"})
    assert r.status_code == 201 and r.json()["is_mine"] and r.json()["job"]["title"] == "Разнорабочий"
    r = await client.post(f"/api/jobs/jobs/{job_id}/blacklist/", headers=headers, json={"reason": "Не заплатили за два месяца"})
    report_id = r.json()["id"]

    job_json = (await client.get(f"/api/jobs/jobs/{job_id}/")).json()
    assert job_json["employer"]["reports_count"] == 1
    r = await client.get("/api/jobs/blacklist/")
    company = next(e for e in r.json()["results"] if e["id"] == employer_id)
    assert company["reports_count"] == 1 and company["reports"][0]["reason"] == "Не заплатили за два месяца"
    assert company["reports"][0]["is_mine"] is False and company["reports"][0]["author_name"] == "Али"
    r = await client.get("/api/jobs/blacklist/reports/", params={"employer": employer_id})
    assert r.json()["count"] == 1

    assert (await client.delete(f"/api/jobs/blacklist/reports/{report_id}/", headers=headers)).status_code == 204
    assert (await client.get(f"/api/jobs/jobs/{job_id}/")).json()["employer"]["reports_count"] == 0
    r = await client.get("/api/jobs/blacklist/", params={"page_size": 100})
    assert employer_id not in [e["id"] for e in r.json()["results"]]


async def test_reviews_salary_paid_feed_blacklist(client, user):
    async with SessionLocal() as db:
        employer = Employer(name="Склад Плюс", city="Казань", external_id="r-1")
        other = Employer(name="Другая", city="Казань", external_id="r-2")
        db.add_all([employer, other])
        await db.flush()
        job = Job(employer_id=employer.id, title="Кладовщик", description="", industry="warehouse", city="Казань", external_id="rj-1")
        foreign = Job(employer_id=other.id, title="Чужая", description="", industry="other", city="Казань", external_id="rj-2")
        db.add_all([job, foreign])
        await db.commit()
        job_id, foreign_id, employer_id = job.id, foreign.id, employer.id
    headers, _ = user

    r = await client.post("/api/jobs/reviews/", headers=headers, json={"employer": employer_id, "job": foreign_id, "rating": 2})
    assert r.status_code == 400 and "job" in r.json()
    r = await client.post("/api/jobs/reviews/", headers=headers,
                          json={"employer": employer_id, "job": job_id, "rating": 1, "salary_paid": "not_paid"})
    review = r.json()
    assert r.status_code == 201 and review["salary_paid"] == "not_paid" and review["salary_not_paid"] is True
    assert review["job"] == {"id": job_id, "title": "Кладовщик"}

    company = (await client.get(f"/api/jobs/jobs/{job_id}/")).json()["employer"]
    assert company["reports_count"] == 1 and company["not_paid"] == 1 and company["reviews_count"] == 1 and company["rating"] == 1
    r = await client.get("/api/jobs/blacklist/reports/", params={"employer": employer_id})
    report = r.json()["results"][0]
    assert report["from_review"] is True and report["reason"] == "Маош надоданд." and report["job"]["id"] == job_id
    r = await client.delete(f"/api/jobs/blacklist/reports/{report['id']}/", headers=headers)
    assert r.status_code == 400

    r = await client.patch(f"/api/jobs/reviews/{review['id']}/", headers=headers,
                           json={"text": "Два месяца не платили зарплату"})
    reports = (await client.get("/api/jobs/blacklist/reports/", params={"employer": employer_id})).json()["results"]
    assert reports[0]["reason"] == "Два месяца не платили зарплату"

    r = await client.patch(f"/api/jobs/reviews/{review['id']}/", headers=headers, json={"salary_paid": "late", "rating": 3})
    assert r.json()["salary_paid"] == "late" and r.json()["salary_not_paid"] is False
    company = (await client.get(f"/api/jobs/employers/{employer_id}/")).json()
    assert company["reports_count"] == 0 and company["paid_late"] == 1 and company["not_paid"] == 0 and company["rating"] == 3

    r = await client.patch(f"/api/jobs/reviews/{review['id']}/", headers=headers, json={"salary_not_paid": True})
    assert r.json()["salary_paid"] == "not_paid"
    r = await client.post(f"/api/jobs/jobs/{job_id}/blacklist/", headers=headers, json={"reason": "Забрали паспорт и не платили"})
    assert r.json()["from_review"] is False
    r = await client.patch(f"/api/jobs/reviews/{review['id']}/", headers=headers, json={"salary_paid": "on_time"})
    company = (await client.get(f"/api/jobs/employers/{employer_id}/")).json()
    assert company["reports_count"] == 1 and company["paid_on_time"] == 1

    assert (await client.delete(f"/api/jobs/reviews/{review['id']}/", headers=headers)).status_code == 204
    company = (await client.get(f"/api/jobs/employers/{employer_id}/")).json()
    assert company["reviews_count"] == 0 and company["rating"] is None and company["reports_count"] == 1

    r = await client.post("/api/jobs/reviews/", headers=headers, json={"employer": employer_id, "rating": 1, "salary_paid": "not_paid"})
    assert r.status_code == 201
    company = (await client.get(f"/api/jobs/employers/{employer_id}/")).json()
    assert company["reports_count"] == 1 and company["not_paid"] == 1
    assert (await client.delete(f"/api/jobs/reviews/{r.json()['id']}/", headers=headers)).status_code == 204
    assert (await client.get(f"/api/jobs/employers/{employer_id}/")).json()["reports_count"] == 1
