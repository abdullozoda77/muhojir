from tests.conftest import last_code

EMAIL = "auth@example.com"
PASSWORD = "Strong-pass-2026"


async def test_signup_login_and_tokens(client, outbox):
    r = await client.post("/api/auth/register/", json={"email": "Auth@Example.com ", "password": PASSWORD, "full_name": "Нигина"})
    assert r.status_code == 201 and r.json() == {"detail": "Code sent.", "email": EMAIL}
    assert outbox[-1]["subject"] == "Muhojir — Тасдиқи почта"

    r = await client.post("/api/auth/login/", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 403 and r.json()["code"] == "not_verified"

    r = await client.post("/api/auth/verify-email/", json={"email": EMAIL, "code": "000000"})
    assert r.json() == {"detail": "Wrong code."}
    r = await client.post("/api/auth/verify-email/", json={"email": EMAIL, "code": last_code(EMAIL)})
    assert r.status_code == 201
    assert r.json()["user"]["email"] == EMAIL and r.json()["user"]["role"] == "migrant"

    r = await client.post("/api/auth/register/", json={"email": EMAIL, "password": PASSWORD})
    assert r.json()["code"] == "registered"

    r = await client.post("/api/auth/login/", json={"email": EMAIL, "password": "wrong-password"})
    assert r.status_code == 400 and r.json() == {"detail": "Wrong email or password."}
    r = await client.post("/api/auth/login/", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200
    tokens = r.json()

    r = await client.post("/api/auth/token/refresh/", json={"refresh": tokens["refresh"]})
    assert r.status_code == 200
    r = await client.post("/api/auth/token/refresh/", json={"refresh": tokens["refresh"]})
    assert r.status_code == 401  # a refresh token works only once

    r = await client.post("/api/auth/logout/", json={"refresh": "broken"})
    assert r.status_code == 400


async def test_password_rules_and_code_format(client):
    r = await client.post("/api/auth/register/", json={"email": "rules@example.com", "password": "12345678"})
    assert r.status_code == 400
    assert "Введённый пароль состоит только из цифр." in r.json()["password"]
    assert "Введённый пароль слишком широко распространён." in r.json()["password"]
    r = await client.post("/api/auth/register/", json={"email": "not-an-email", "password": PASSWORD})
    assert r.json() == {"email": ["Введите правильный адрес электронной почты."]}
    r = await client.post("/api/auth/verify-email/", json={"email": "rules@example.com", "code": "12"})
    assert r.json() == {"code": ["The code is 6 digits."]}


async def test_forgot_and_reset_password(client, user, outbox):
    headers, data = user
    email = data["user"]["email"]
    r = await client.post("/api/auth/password/forgot/", json={"email": "nobody@example.com"})
    assert r.json() == {"detail": "If this email is registered, a code was sent."}
    r = await client.post("/api/auth/password/forgot/", json={"email": email})
    assert r.status_code == 200
    sent = len(outbox)
    r = await client.post("/api/auth/password/forgot/", json={"email": email})
    # The same answer (nobody learns who has an account), but no second letter within a minute.
    assert r.status_code == 200 and len(outbox) == sent
    r = await client.post("/api/auth/password/reset/", json={"email": email, "code": last_code(email), "password": "New-strong-pass-1"})
    assert r.status_code == 200
    r = await client.post("/api/auth/login/", json={"email": email, "password": "New-strong-pass-1"})
    assert r.status_code == 200


async def test_profile(client, user):
    headers, _ = user
    r = await client.get("/api/auth/profile/")
    assert r.status_code == 401
    r = await client.patch("/api/auth/profile/", headers=headers, json={"phone": "8 (999) 000-11-22", "city": "Казань", "language": "ru"})
    assert r.json()["phone"] == "+79990001122" and r.json()["language"] == "ru"
    r = await client.patch("/api/auth/profile/", headers=headers, json={"language": "en"})
    assert r.status_code == 400 and "language" in r.json()
    r = await client.get("/api/auth/profile/", headers={"Authorization": "Bearer broken"})
    assert r.status_code == 401


async def test_login_is_throttled(client):
    for _ in range(20):
        await client.post("/api/auth/login/", json={"email": "x@example.com", "password": "x"})
    r = await client.post("/api/auth/login/", json={"email": "x@example.com", "password": "x"})
    assert r.status_code == 429
