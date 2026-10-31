from datetime import date, timedelta

from app.services.stats import calendar, streaks, today, weekly


def test_streaks_count_days_in_a_row():
    now = today()
    days = {now, now - timedelta(days=1), now - timedelta(days=2), now - timedelta(days=10), now - timedelta(days=11)}
    assert streaks(days) == (3, 3)
    assert streaks({now - timedelta(days=1)}) == (1, 1)
    assert streaks({now - timedelta(days=5)}) == (0, 1)
    assert streaks(set()) == (0, 0)


def test_calendar_starts_on_monday_and_ends_today():
    days = calendar({today(): 2}, 30)
    assert date.fromisoformat(days[0]["date"]).weekday() == 0
    assert days[-1] == {"date": today().isoformat(), "count": 2}


def test_weekly_counts_and_running_total():
    now = today()
    weeks = weekly([now, now, now - timedelta(weeks=1), now - timedelta(weeks=40)], 4)
    assert len(weeks) == 4 and weeks[0]["total"] == 1 + weeks[0]["count"]
    assert weeks[-1]["count"] == 2 and weeks[-1]["total"] == 4


async def test_course_stats(client, user):
    headers, _ = user
    r = await client.get("/api/course/stats/")
    assert r.status_code == 401
    r = await client.get("/api/course/stats/", headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["lessons_done"] == 0 and data["streak"] == 0 and data["average_score"] is None
    for number, score in ((1, 80), (2, 100)):
        r = await client.post(f"/api/course/levels/1/lessons/{number}/complete/", headers=headers, json={"score": score})
        assert r.status_code == 200, r.text
    data = (await client.get("/api/course/stats/", headers=headers)).json()
    assert data["lessons_done"] == 2 and data["average_score"] == 90 and data["perfect"] == 1
    assert data["streak"] == 1 and data["active_days"] == 1 and data["this_week"] == 2
    assert data["levels"][0]["done"] == 2 and data["levels"][0]["average"] == 90
    assert data["recent"][0]["number"] in (1, 2) and data["days"][-1]["count"] == 2
    assert len(data["weeks"]) == 12 and data["weeks"][-1] == {**data["weeks"][-1], "count": 2, "total": 2}


async def test_activity(client, user):
    headers, _ = user
    assert (await client.get("/api/auth/activity/")).status_code == 401
    r = await client.post("/api/course/levels/1/lessons/1/complete/", headers=headers, json={"score": 70})
    assert r.status_code == 200
    r = await client.get("/api/auth/activity/", headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["totals"]["lessons"] == 1 and data["total"] >= 1
    assert data["member_days"] == 1 and data["streak"] == 1
    assert data["sections"]["lessons"] == 1 and data["recent"][0]["kind"] == "lessons"
