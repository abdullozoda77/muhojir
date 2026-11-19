from tests.conftest import set_role
from tests.test_feedback import register

QUESTION = {"topic": "documents", "title": "Патентро дар Москва чанд рӯз месозанд?", "body": "Ҳуҷҷатҳо тайёранд.", "city": "Москва"}


async def test_people_ask_answer_like_and_choose_the_best(client, user):
    asker, _ = user
    helper = await register(client, "qa-helper@example.com", "Фарҳод Раҳимов")
    other = await register(client, "qa-other@example.com", "Ҷамшед Камолов")
    assert (await client.post("/api/questions/", json=QUESTION)).status_code == 401
    assert (await client.post("/api/questions/", headers=asker, json={**QUESTION, "title": "Кӯтоҳ"})).status_code == 400
    r = await client.post("/api/questions/", headers=asker, json=QUESTION)
    assert r.status_code == 201, r.text
    question = r.json()
    assert question["mine"] and question["topic_label"] == "Ҳуҷҷатҳо ва патент"
    assert question["id"] in [q["id"] for q in (await client.get("/api/questions/?show=unanswered")).json()["results"]]

    r = await client.post(f"/api/questions/{question['id']}/answers/", headers=asker, json={"body": "Ҷавоби худам ба худам"})
    assert r.status_code == 400 and r.json()["detail"] == "You cannot answer your own question."
    r = await client.post(f"/api/questions/{question['id']}/answers/", headers=helper, json={"body": "Одатан 10 рӯзи корӣ."})
    assert r.status_code == 201, r.text
    answer = r.json()
    r = await client.get("/api/auth/notifications/", headers=asker)
    assert any(n["title"] == "Ба саволи шумо ҷавоб доданд" for n in r.json()["results"])
    assert question["id"] not in [q["id"] for q in (await client.get("/api/questions/?show=unanswered")).json()["results"]]
    assert [q["id"] for q in (await client.get("/api/questions/?search=корӣ")).json()["results"]] == [question["id"]]

    assert (await client.post(f"/api/questions/answers/{answer['id']}/like/", headers=helper)).status_code == 400
    r = await client.post(f"/api/questions/answers/{answer['id']}/like/", headers=other)
    assert r.json() == {"id": answer["id"], "likes": 1, "liked": True}
    assert (await client.post(f"/api/questions/answers/{answer['id']}/best/", headers=other)).status_code == 403
    r = await client.post(f"/api/questions/answers/{answer['id']}/best/", headers=asker)
    assert r.json()["best_answer_id"] == answer["id"]
    r = await client.get("/api/auth/notifications/", headers=helper)
    assert any(n["title"] == "Ҷавоби шумо беҳтарин интихоб шуд" for n in r.json()["results"])

    detail = (await client.get(f"/api/questions/{question['id']}/", headers=other)).json()
    assert detail["solved"] and detail["answers_count"] == 1 and not detail["can_choose_best"]
    assert detail["answers"][0]["best"] and detail["answers"][0]["liked"] and not detail["answers"][0]["can_delete"]
    assert (await client.get("/api/questions/summary/")).json()["topics"]["documents"] == 1

    assert (await client.delete(f"/api/questions/answers/{answer['id']}/", headers=other)).status_code == 404
    assert (await client.delete(f"/api/questions/answers/{answer['id']}/", headers=helper)).status_code == 204
    detail = (await client.get(f"/api/questions/{question['id']}/")).json()
    assert detail["answers"] == [] and not detail["solved"] and detail["answers_count"] == 0


async def test_editors_hide_questions(client, user):
    editor, data = user
    asker = await register(client, "qa-asker@example.com", "Аҳмад Солиев")
    question = (await client.post("/api/questions/", headers=asker, json=QUESTION)).json()
    assert (await client.patch(f"/api/questions/{question['id']}/", headers=asker, json={"is_hidden": True})).status_code == 403
    await set_role(data["user"]["id"], "editor")
    assert (await client.patch(f"/api/questions/{question['id']}/", headers=editor, json={"is_hidden": True})).status_code == 200
    assert question["id"] not in [q["id"] for q in (await client.get("/api/questions/")).json()["results"]]
    assert (await client.get(f"/api/questions/{question['id']}/")).status_code == 404
    assert (await client.post(f"/api/questions/{question['id']}/answers/", headers=asker, json={"body": "Ҷавоби ман"})).status_code == 404
    assert (await client.get("/api/questions/?show=mine")).status_code == 401
    assert (await client.delete(f"/api/questions/{question['id']}/", headers=asker)).status_code == 204
