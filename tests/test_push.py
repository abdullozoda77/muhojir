import json
from datetime import timedelta

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy import select

from app.db.session import SessionLocal
from app.db.types import utcnow
from app.models import Employer, Job, PushSubscription, User
from app.services import push
from app.services.alerts import notify_alerts

ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc"


def browser_keys():
    key = ec.generate_private_key(ec.SECP256R1())
    public = key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    return key, push.b64url(public), push.b64url(b"0123456789abcdef")


def decrypt(key, auth, body):
    salt, length = body[:16], body[20]
    server_public, cipher = body[21:21 + length], body[21 + length:]
    client_public = key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    shared = key.exchange(ec.ECDH(), ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), server_public))
    ikm = push.hkdf(shared, push.unb64url(auth), b"WebPush: info\x00" + client_public + server_public, 32)
    cek = push.hkdf(ikm, salt, b"Content-Encoding: aes128gcm\x00", 16)
    nonce = push.hkdf(ikm, salt, b"Content-Encoding: nonce\x00", 12)
    plain = AESGCM(cek).decrypt(nonce, cipher, None)
    assert plain.endswith(b"\x02")
    return json.loads(plain[:-1])


@pytest.fixture
def sent(monkeypatch):
    calls = []

    async def fake_post(endpoint, body, headers):
        calls.append({"endpoint": endpoint, "body": body, "headers": headers})
        return 410 if "gone" in endpoint else 201

    monkeypatch.setattr(push, "post", fake_post)
    return calls


def test_encrypt_and_vapid():
    key, p256dh, auth = browser_keys()
    body = push.encrypt(p256dh, auth, json.dumps({"title": "Салом"}).encode())
    assert decrypt(key, auth, body) == {"title": "Салом"}
    header = push.vapid_header(ENDPOINT)
    token = header.split("t=")[1].split(",")[0]
    public = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), push.unb64url(push.public_key()))
    claims = jwt.decode(token, public, algorithms=["ES256"], audience="https://fcm.googleapis.com")
    assert claims["aud"] == "https://fcm.googleapis.com"


async def test_subscribe_and_unsubscribe(client, user, sent):
    headers, _ = user
    _, p256dh, auth = browser_keys()
    assert (await client.get("/api/push/")).status_code == 401
    r = await client.get("/api/push/", headers=headers)
    assert r.json()["devices"] == 0 and len(push.unb64url(r.json()["key"])) == 65
    bad = {"endpoint": "https://evil.example.com/x", "keys": {"p256dh": p256dh, "auth": auth}}
    assert (await client.post("/api/push/subscribe/", headers=headers, json=bad)).status_code == 400
    body = {"endpoint": ENDPOINT, "keys": {"p256dh": p256dh, "auth": auth}}
    r = await client.post("/api/push/subscribe/", headers=headers, json=body)
    assert r.status_code == 201 and r.json()["devices"] == 1
    r = await client.post("/api/push/subscribe/", headers=headers, json=body)
    assert r.json()["devices"] == 1
    assert (await client.post("/api/push/test/", headers=headers)).json() == {"sent": 1}
    assert sent[0]["headers"]["Content-Encoding"] == "aes128gcm"
    r = await client.post("/api/push/unsubscribe/", headers=headers, json={"endpoint": ENDPOINT})
    assert r.json()["devices"] == 0


async def test_job_alert_reaches_push_and_drops_dead_devices(client, user, sent):
    headers, data = user
    key, p256dh, auth = browser_keys()
    for endpoint in (ENDPOINT + "-alert", ENDPOINT + "-gone"):
        await client.post("/api/push/subscribe/", headers=headers,
                          json={"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth}})
    r = await client.post("/api/jobs/alerts/", headers=headers,
                          json={"city": "Москва", "industry": "construction", "min_salary": 80000})
    assert r.status_code == 201
    since = utcnow() - timedelta(minutes=1)
    async with SessionLocal() as db:
        employer = Employer(name="ООО Пуш", city="Москва", external_id="push-1")
        db.add(employer)
        await db.flush()
        db.add_all([
            Job(employer_id=employer.id, title="Арматурщик", description="", industry="construction", city="Москва",
                salary_from=95000, external_id="push-j1"),
            Job(employer_id=employer.id, title="Подсобник", description="", industry="construction", city="Москва",
                salary_from=40000, salary_to=50000, external_id="push-j2"),
        ])
        await db.commit()
        await notify_alerts(db, since)
        mine = [c for c in sent if c["endpoint"].startswith(ENDPOINT)]
        message = decrypt(key, auth, mine[0]["body"])
        assert "Арматурщик" in message["body"] and "Подсобник" not in message["body"]
        assert message["url"].startswith("/jobs?") and "min_salary=80000" in message["url"]
        left = (await db.scalars(select(PushSubscription.endpoint).where(
            PushSubscription.user_id == data["user"]["id"]))).all()
        assert left == [ENDPOINT + "-alert"]
        assert await db.get(User, data["user"]["id"])
