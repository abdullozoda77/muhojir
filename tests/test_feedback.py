from tests.conftest import last_code, set_role


async def register(client, email, name):
    await client.post("/api/auth/register/", json={"email": email, "password": "Strong-pass-2026", "full_name": name})
    r = await client.post("/api/auth/verify-email/", json={"email": email, "code": last_code(email)})
    return {"Authorization": f"Bearer {r.json()['access']}"}


async def test_only_logged_in_users_send_feedback(client):
    r = await client.post("/api/feedback/", json={"message": "Сайти хуб, ташаккур!"})
    assert r.status_code == 401


async def test_feedback_reaches_editors_and_the_reply_comes_back(client, user):
    editor, data = user
    await set_role(data["user"]["id"], "editor")
    sender = await register(client, "feedback@example.com", "Зарина Каримова")
    r = await client.post("/api/feedback/", headers=sender, json={"kind": "bug", "message": "хуб"})
    assert "message" in r.json()
    r = await client.post("/api/feedback/", headers=sender,
                          json={"kind": "idea", "rating": 5, "message": "Қурби доллар ҳам илова кунед", "page": "/"})
    assert r.status_code == 201, r.text
    feedback = r.json()
    assert feedback["status"] == "new" and "email" not in feedback
    r = await client.get("/api/auth/notifications/", headers=editor)
    assert any("Зарина" in n["message"] and "доллар" in n["message"] for n in r.json()["results"])
    r = await client.get("/api/feedback/", headers=sender)
    assert r.status_code == 403
    r = await client.get("/api/feedback/", headers=editor, params={"status": "new"})
    mine = next(f for f in r.json()["results"] if f["id"] == feedback["id"])
    assert mine["email"] == "feedback@example.com" and mine["page"] == "/"
    r = await client.patch(f"/api/feedback/{feedback['id']}/", headers=editor, json={"reply": "Ташаккур, ба наздикӣ!"})
    assert r.json()["status"] == "done" and r.json()["replied_at"]
    r = await client.get("/api/auth/notifications/", headers=sender)
    assert any("Ташаккур, ба наздикӣ!" in n["message"] for n in r.json()["results"])
    r = await client.get("/api/feedback/mine/", headers=sender)
    assert [f["reply"] for f in r.json()] == ["Ташаккур, ба наздикӣ!"]
