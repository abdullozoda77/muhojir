from datetime import date, timedelta

from sqlalchemy import select, update

from app.db.session import SessionLocal
from app.db.types import utcnow
from app.models import CheckResult, DocumentType, UserDocument


async def test_checks_list_results_and_papers(client, user):
    r = await client.get("/api/help/checks/")
    checks = r.json()
    assert r.status_code == 200 and len(checks) >= 6
    assert [c["order"] for c in checks] == sorted(c["order"] for c in checks)
    patent = next(c for c in checks if c["documents"] == ["patent"] and c["repeat_days"] == 30)
    assert patent["needs"] and patent["if_bad"] and patent["my_result"] is None and patent["my_documents"] == []
    assert any(c["website"] == "https://xn--b1aew.xn--p1ai/rkl" for c in checks)

    r = await client.get("/api/help/checks/", headers={"Accept-Language": "ru"})
    assert next(c for c in r.json() if c["id"] == patent["id"])["title"] == "Действителен ли патент"

    assert (await client.put(f"/api/help/checks/{patent['id']}/result/", json={"result": "ok"})).status_code == 401
    headers, data = user
    async with SessionLocal() as db:
        kind = await db.scalar(select(DocumentType).where(DocumentType.slug == "patent"))
        db.add(UserDocument(user_id=data["user"]["id"], document_type_id=kind.id, number="77 1234567",
                            issued_at=date.today(), expires_at=date.today() + timedelta(days=200)))
        await db.commit()

    r = await client.put(f"/api/help/checks/{patent['id']}/result/", headers=headers, json={"result": "maybe"})
    assert r.status_code == 400
    r = await client.put(f"/api/help/checks/{patent['id']}/result/", headers=headers, json={"result": "problem"})
    body = r.json()
    assert r.status_code == 200 and body["my_result"]["result"] == "problem" and body["my_result"]["is_due"] is False
    assert body["my_documents"][0]["number"] == "77 1234567"
    r = await client.put(f"/api/help/checks/{patent['id']}/result/", headers=headers, json={"result": "ok"})
    assert r.json()["my_result"]["result"] == "ok"

    async with SessionLocal() as db:
        await db.execute(update(CheckResult).where(CheckResult.contact_id == patent["id"])
                         .values(checked_at=utcnow() - timedelta(days=31)))
        await db.commit()
    mine = next(c for c in (await client.get("/api/help/checks/", headers=headers)).json() if c["id"] == patent["id"])
    assert mine["my_result"]["is_due"] is True
    other = next(c for c in (await client.get("/api/help/checks/")).json() if c["id"] == patent["id"])
    assert other["my_result"] is None and other["my_documents"] == []

    assert (await client.delete(f"/api/help/checks/{patent['id']}/result/", headers=headers)).status_code == 204
    assert (await client.put("/api/help/checks/999999/result/", headers=headers, json={"result": "ok"})).status_code == 404
