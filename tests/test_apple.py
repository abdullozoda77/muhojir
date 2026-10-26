import time
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core.config import settings
from app.services import apple

CLIENT_ID = "tj.muhojir.web"
PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(autouse=True)
def apple_keys(monkeypatch):
    monkeypatch.setattr(settings, "apple_client_id", CLIENT_ID)
    monkeypatch.setattr(apple.keys, "get_signing_key_from_jwt", lambda token: SimpleNamespace(key=PRIVATE_KEY.public_key()))


def apple_token(email="Apple.User@privaterelay.appleid.com", **extra):
    now = int(time.time())
    claims = {"iss": "https://appleid.apple.com", "aud": CLIENT_ID, "sub": "001.abc", "iat": now, "exp": now + 600,
              "email": email, "email_verified": "true", **extra}
    return jwt.encode(claims, PRIVATE_KEY, algorithm="RS256")


async def test_client_id_is_public(client):
    assert (await client.get("/api/auth/apple/")).json() == {"client_id": CLIENT_ID}


async def test_new_user_then_same_user(client):
    r = await client.post("/api/auth/apple/", json={"id_token": apple_token(), "full_name": "Нигина Каримова"})
    assert r.status_code == 201
    user = r.json()["user"]
    assert user["email"] == "apple.user@privaterelay.appleid.com" and user["full_name"] == "Нигина Каримова"
    r = await client.post("/api/auth/apple/", json={"id_token": apple_token()})
    assert r.status_code == 200 and r.json()["user"]["id"] == user["id"]


@pytest.mark.parametrize("extra", [{"aud": "someone.else"}, {"iss": "https://evil.example"}, {"exp": 1}, {"email_verified": "false"}])
async def test_bad_tokens(client, extra):
    r = await client.post("/api/auth/apple/", json={"id_token": apple_token(**extra)})
    assert r.status_code == 400


async def test_forged_signature(client):
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    token = jwt.encode({"iss": "https://appleid.apple.com", "aud": CLIENT_ID, "exp": int(time.time()) + 600, "email": "x@y.z"}, other, algorithm="RS256")
    assert (await client.post("/api/auth/apple/", json={"id_token": token})).status_code == 400


async def test_not_set_up(client, monkeypatch):
    monkeypatch.setattr(settings, "apple_client_id", "")
    assert (await client.post("/api/auth/apple/", json={"id_token": "x"})).status_code == 503
