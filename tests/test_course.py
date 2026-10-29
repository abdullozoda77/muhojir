from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import ExamAttempt, Notification
from app.services import course


def test_course_content_is_complete():
    levels = course.levels()
    assert levels
    for data in levels:
        assert data["title"] and len(data["lessons"]) == course.LESSONS_PER_LEVEL, data["level"]
        assert len(data["exam"]) >= course.EXAM_SIZE, data["level"]
        for number, lesson in enumerate(data["lessons"], start=1):
            where = f"level {data['level']} lesson {number}"
            assert lesson["title"] and lesson["theory"] and lesson["words"], where
            assert len(lesson["exercises"]) >= 4, where
            for exercise in lesson["exercises"]:
                if exercise["type"] == "choice":
                    assert 0 <= exercise["answer"] < len(exercise["options"]), where
                    assert len(set(exercise["options"])) == len(exercise["options"]), where
                else:
                    assert exercise["type"] == "build" and exercise["tg"] and exercise["answer"], where
        for q in data["exam"]:
            assert 0 <= q["answer"] < len(q["options"]), (data["level"], q["q"])
            assert len(set(q["options"])) == len(q["options"]), (data["level"], q["q"])


async def finish_lessons(client, headers, level):
    for number in range(1, course.LESSONS_PER_LEVEL + 1):
        r = await client.post(f"/api/course/levels/{level}/lessons/{number}/complete/", headers=headers, json={"score": 90})
        assert r.status_code == 200, r.text


async def answers_for(attempt_id, right=True):
    async with SessionLocal() as db:
        attempt = await db.get(ExamAttempt, attempt_id)
    result = []
    for item in attempt.questions:
        correct = item["order"].index(course.exam_question(attempt.level, item["i"])["answer"])
        result.append(correct if right else (correct + 1) % len(item["order"]))
    return result


async def test_lessons_are_open_to_guests(client):
    r = await client.get("/api/course/")
    assert r.status_code == 200
    first = r.json()["levels"][0]
    assert first["level"] == 1 and len(first["lessons"]) == 10 and first["exam"]["ready"] is False
    r = await client.get("/api/course/levels/1/lessons/1/")
    assert r.status_code == 200 and r.json()["exercises"]
    assert (await client.get("/api/course/levels/1/lessons/99/")).status_code == 404
    assert (await client.get("/api/course/levels/42/lessons/1/")).status_code == 404
    r = await client.post("/api/course/levels/1/lessons/1/complete/", json={"score": 100})
    assert r.status_code == 401


async def test_lessons_open_one_by_one(client, user):
    headers, _ = user
    assert (await client.get("/api/course/levels/1/lessons/2/", headers=headers)).status_code == 403
    assert (await client.get("/api/course/levels/1/lessons/2/")).status_code == 403
    r = await client.post("/api/course/levels/1/lessons/2/complete/", headers=headers, json={"score": 100})
    assert r.status_code == 403 and r.json()["code"] == "locked"
    await client.post("/api/course/levels/1/lessons/1/complete/", headers=headers, json={"score": 100})
    assert (await client.get("/api/course/levels/1/lessons/2/", headers=headers)).status_code == 200
    levels = (await client.get("/api/course/", headers=headers)).json()["levels"]
    assert [l["unlocked"] for l in levels[0]["lessons"][:3]] == [True, True, False]
    assert levels[1]["unlocked"] is False
    assert (await client.get("/api/course/levels/2/lessons/1/", headers=headers)).status_code == 403
    r = await client.post("/api/course/levels/2/exam/", headers=headers, json={"full_name": "Али Валиев"})
    assert r.status_code == 403


async def test_lesson_progress_keeps_best_score(client, user):
    headers, _ = user
    await client.post("/api/course/levels/1/lessons/1/complete/", headers=headers, json={"score": 100})
    r = await client.post("/api/course/levels/1/lessons/2/complete/", headers=headers, json={"score": 40})
    assert r.status_code == 400
    await client.post("/api/course/levels/1/lessons/2/complete/", headers=headers, json={"score": 95})
    r = await client.post("/api/course/levels/1/lessons/2/complete/", headers=headers, json={"score": 70})
    assert r.json()["score"] == 95
    lessons = (await client.get("/api/course/", headers=headers)).json()["levels"][0]["lessons"]
    assert lessons[1]["score"] == 95 and lessons[2]["score"] is None


async def pass_level(client, headers, level, name="Али Валиев"):
    await finish_lessons(client, headers, level)
    r = await client.post(f"/api/course/levels/{level}/exam/", headers=headers, json={"full_name": name})
    assert r.status_code == 201, r.text
    exam = r.json()
    r = await client.post(f"/api/course/exams/{exam['id']}/submit/", headers=headers,
                          json={"answers": await answers_for(exam["id"])})
    return exam, r.json()


async def test_level_exam_opens_next_level(client, user):
    headers, _ = user
    r = await client.post("/api/course/levels/1/exam/", headers=headers, json={"full_name": "Али Валиев"})
    assert r.status_code == 400
    await finish_lessons(client, headers, 1)
    r = await client.post("/api/course/levels/1/exam/", headers=headers, json={"full_name": "Али Валиев"})
    exam = r.json()
    assert r.status_code == 201 and len(exam["questions"]) == course.EXAM_SIZE and "answer" not in exam["questions"][0]
    again = await client.post("/api/course/levels/1/exam/", headers=headers, json={"full_name": "Али Валиев"})
    assert again.json()["id"] == exam["id"]
    r = await client.post(f"/api/course/exams/{exam['id']}/submit/", headers=headers,
                          json={"answers": await answers_for(exam["id"])})
    result = r.json()
    assert result["passed"] and result["percent"] == 100 and result["certificate"] is None and not result["final"]
    assert len(result["review"]) == course.EXAM_SIZE
    assert (await client.post(f"/api/course/exams/{exam['id']}/submit/", headers=headers, json={"answers": []})).status_code == 400
    assert (await client.post("/api/course/levels/1/exam/", headers=headers, json={"full_name": "Али"})).status_code == 400
    data = (await client.get("/api/course/", headers=headers)).json()
    assert data["levels"][0]["exam"]["passed"] and data["levels"][0]["exam"]["percent"] == 100
    assert data["levels"][1]["unlocked"] and data["certificate"] is None
    assert (await client.get("/api/course/certificates/", headers=headers)).json() == []


async def test_whole_course_gives_one_certificate(client, user):
    headers, data = user
    for level in range(1, course.LEVELS):
        _, result = await pass_level(client, headers, level)
        assert result["passed"] and result["certificate"] is None
    _, result = await pass_level(client, headers, course.LEVELS, name="  Али   Валиев ")
    assert result["final"] and result["passed"]
    certificate = result["certificate"]
    assert certificate["full_name"] == "Али Валиев" and certificate["number"].startswith("MJ-RU-")
    assert certificate["percent"] == 100 and certificate["levels"] == course.LEVELS and certificate["lessons"] == 70

    public = await client.get(f"/api/course/certificates/{certificate['code']}/")
    assert public.status_code == 200 and public.json()["number"] == certificate["number"]
    assert (await client.get("/api/course/certificates/nothing/")).status_code == 404
    mine = (await client.get("/api/course/certificates/", headers=headers)).json()
    assert [c["code"] for c in mine] == [certificate["code"]]
    overview = (await client.get("/api/course/", headers=headers)).json()
    assert overview["certificate"]["code"] == certificate["code"]
    async with SessionLocal() as db:
        titles = (await db.scalars(select(Notification.title).where(Notification.user_id == data["user"]["id"]))).all()
    assert titles.count("Сертификати нав!") == 1


async def test_failed_exam_waits_before_retry(client, user):
    headers, _ = user
    await finish_lessons(client, headers, 1)
    exam = (await client.post("/api/course/levels/1/exam/", headers=headers, json={"full_name": "Али Валиев"})).json()
    r = await client.post(f"/api/course/exams/{exam['id']}/submit/", headers=headers,
                          json={"answers": await answers_for(exam["id"], right=False)})
    result = r.json()
    assert not result["passed"] and result["certificate"] is None and result["wait_until"]
    r = await client.post("/api/course/levels/1/exam/", headers=headers, json={"full_name": "Али Валиев"})
    assert r.status_code == 429 and r.json()["wait_until"]
    level = (await client.get("/api/course/", headers=headers)).json()["levels"][0]
    assert level["exam"]["ready"] and level["exam"]["wait_until"]


async def test_exam_belongs_to_its_user(client, user):
    headers, _ = user
    await finish_lessons(client, headers, 1)
    exam = (await client.post("/api/course/levels/1/exam/", headers=headers, json={"full_name": "Али Валиев"})).json()
    r = await client.post("/api/auth/register/", json={"email": "other-course@example.com", "password": "Strong-pass-2026"})
    assert r.status_code == 201
    from tests.conftest import last_code
    r = await client.post("/api/auth/verify-email/", json={"email": "other-course@example.com", "code": last_code("other-course@example.com")})
    other = {"Authorization": f"Bearer {r.json()['access']}"}
    assert (await client.get(f"/api/course/exams/{exam['id']}/", headers=other)).status_code == 404
    assert (await client.post(f"/api/course/exams/{exam['id']}/submit/", headers=other, json={"answers": []})).status_code == 404
