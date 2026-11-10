from app.db.session import SessionLocal
from app.models import ExamAttempt
from app.services.course import DRIVE


def test_driving_content_is_complete():
    levels = DRIVE.levels()
    assert len(levels) == DRIVE.total_levels == 5
    for data in levels:
        assert data["title"] and len(data["lessons"]) == DRIVE.lessons_per_level, data["level"]
        assert len(data["exam"]) >= DRIVE.exam_size - DRIVE.exam_from_lessons, data["level"]
        for lesson in data["lessons"]:
            assert lesson["title"] and lesson["theory"] and lesson["words"], lesson["title"]
            assert len(lesson["exercises"]) == 7, lesson["title"]
            for exercise in lesson["exercises"]:
                assert 0 <= exercise["answer"] < len(exercise["options"]), exercise["q"]
                assert len(set(exercise["options"])) == len(exercise["options"]), exercise["q"]
        for q in data["exam"]:
            assert 0 <= q["answer"] < len(q["options"]), q["q"]
        first = DRIVE.pick_exam(data["level"])
        assert len(first) == len(set(first)) == DRIVE.exam_size


async def right_answers(attempt_id):
    async with SessionLocal() as db:
        attempt = await db.get(ExamAttempt, attempt_id)
    return [item["order"].index(DRIVE.exam_question(attempt.level, item["i"])["answer"]) for item in attempt.questions]


async def pass_level(client, headers, level):
    for number in range(1, DRIVE.lessons_per_level + 1):
        r = await client.post(f"/api/drive/levels/{level}/lessons/{number}/complete/", headers=headers, json={"score": 90})
        assert r.status_code == 200, r.text
    r = await client.post(f"/api/drive/levels/{level}/exam/", headers=headers, json={"full_name": "Али Валиев"})
    assert r.status_code == 201, r.text
    exam = r.json()
    assert exam["minutes"] == DRIVE.exam_minutes and len(exam["questions"]) == DRIVE.exam_size
    r = await client.post(f"/api/drive/exams/{exam['id']}/submit/", headers=headers,
                          json={"answers": await right_answers(exam["id"])})
    return r.json()


async def test_driving_course_is_separate_from_russian(client, user):
    headers, _ = user
    data = (await client.get("/api/drive/", headers=headers)).json()
    assert data["course"] == "drive" and len(data["levels"]) == 5 and data["pass_percent"] == 90
    r = await client.post("/api/drive/levels/1/lessons/1/complete/", headers=headers, json={"score": 60})
    assert r.status_code == 400
    await client.post("/api/drive/levels/1/lessons/1/complete/", headers=headers, json={"score": 100})
    await client.put("/api/drive/place/", headers=headers, json={"level": 1, "number": 2, "index": 2, "right": 2})
    drive = (await client.get("/api/drive/", headers=headers)).json()
    russian = (await client.get("/api/course/", headers=headers)).json()
    assert drive["levels"][0]["lessons"][0]["score"] == 100 and drive["place"]["number"] == 2
    assert russian["levels"][0]["lessons"][0]["score"] is None and russian["place"] is None
    assert (await client.get("/api/course/levels/1/lessons/2/", headers=headers)).status_code == 403
    await client.put("/api/course/place/", headers=headers, json={"level": 1, "number": 1, "index": 1})
    assert (await client.get("/api/drive/", headers=headers)).json()["place"]["number"] == 2


async def test_driving_course_gives_its_own_certificate(client, user):
    headers, _ = user
    for level in range(1, DRIVE.total_levels):
        result = await pass_level(client, headers, level)
        assert result["passed"] and result["certificate"] is None and not result["final"]
    result = await pass_level(client, headers, DRIVE.total_levels)
    certificate = result["certificate"]
    assert result["final"] and certificate["number"].startswith("MJ-PDD-") and certificate["course"] == "drive"
    assert certificate["levels"] == 5 and certificate["lessons"] == 25
    public = (await client.get(f"/api/course/certificates/{certificate['code']}/")).json()
    assert public["course"] == "drive"
    assert (await client.get("/api/course/", headers=headers)).json()["certificate"] is None
    assert (await client.get("/api/drive/", headers=headers)).json()["certificate"]["code"] == certificate["code"]


async def test_driving_exam_cannot_be_sent_to_russian_course(client, user):
    headers, _ = user
    for number in range(1, DRIVE.lessons_per_level + 1):
        await client.post(f"/api/drive/levels/1/lessons/{number}/complete/", headers=headers, json={"score": 90})
    exam = (await client.post("/api/drive/levels/1/exam/", headers=headers, json={"full_name": "Али Валиев"})).json()
    assert (await client.get(f"/api/course/exams/{exam['id']}/", headers=headers)).status_code == 404
    assert (await client.get(f"/api/drive/exams/{exam['id']}/", headers=headers)).status_code == 200
