import pytest

from app.core.config import settings
from app.routers import auth
from tests.conftest import last_code

CLIENT_ID = "test-client.apps.googleusercontent.com"


@pytest.fixture
def google(monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", CLIENT_ID)
    claims = {}

    def fake_verify(credential):
        return dict(claims) if credential == "good" else None

    monkeypatch.setattr(auth, "verify_google_token", fake_verify)
    return claims


def google_claims(email, **extra):
    return {"iss": "https://accounts.google.com", "email": email, "email_verified": True, "name": "Алӣ Валиев", **extra}


async def test_client_id_is_public(client, google):
    r = await client.get("/api/auth/google/")
    assert r.json() == {"client_id": CLIENT_ID}


async def test_new_user_is_created(client, google):
    google.update(google_claims("New.Google@Gmail.com"))
    r = await client.post("/api/auth/google/", json={"credential": "good"})
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["email"] == "new.google@gmail.com" and body["user"]["full_name"] == "Алӣ Валиев"
    assert body["access"] and body["refresh"]

    r = await client.post("/api/auth/login/", json={"email": "new.google@gmail.com", "password": ""})
    assert r.status_code in (400, 422)

    r = await client.post("/api/auth/google/", json={"credential": "good"})
    assert r.status_code == 200 and r.json()["user"]["id"] == body["user"]["id"]


async def test_unconfirmed_account_is_taken_over_without_old_password(client, google):
    email = "squat@example.com"
    await client.post("/api/auth/register/", json={"email": email, "password": "Strong-pass-2026"})
    google.update(google_claims(email))
    r = await client.post("/api/auth/google/", json={"credential": "good"})
    assert r.status_code == 200 and r.json()["user"]["email"] == email
    r = await client.post("/api/auth/login/", json={"email": email, "password": "Strong-pass-2026"})
    assert r.status_code == 400


async def test_confirmed_account_keeps_its_password(client, google):
    email = "keeps@example.com"
    await client.post("/api/auth/register/", json={"email": email, "password": "Strong-pass-2026"})
    await client.post("/api/auth/verify-email/", json={"email": email, "code": last_code(email)})
    google.update(google_claims(email))
    assert (await client.post("/api/auth/google/", json={"credential": "good"})).status_code == 200
    r = await client.post("/api/auth/login/", json={"email": email, "password": "Strong-pass-2026"})
    assert r.status_code == 200


async def test_bad_token(client, google):
    r = await client.post("/api/auth/google/", json={"credential": "bad"})
    assert r.status_code == 400


async def test_not_set_up(client, monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", "")
    r = await client.post("/api/auth/google/", json={"credential": "good"})
    assert r.status_code == 503


def test_verify_rejects_unverified_email(monkeypatch):
    from app.services import google as service

    monkeypatch.setattr(settings, "google_client_id", CLIENT_ID)
    seen = {}

    def fake(credential, request, audience):
        seen["audience"] = audience
        return google_claims("x@gmail.com", email_verified=False)

    monkeypatch.setattr(service.id_token, "verify_oauth2_token", fake)
    assert service.verify_google_token("t") is None
    assert seen["audience"] == CLIENT_ID
