"""Every test run gets its own SQLite database, made by the real migrations (so the seeded content is there:
document types, guides, 83 regions, news, 100 exam questions). Email is not sent; codes are read from the outbox."""
import os
import tempfile
from pathlib import Path

_tmp = tempfile.mkdtemp(prefix="muhojir-tests-")
os.environ.update({
    "DATABASE_URL": f"sqlite+aiosqlite:///{_tmp}/test.sqlite3",
    "SECRET_KEY": "tests-secret-key-that-is-long-enough-for-hs256",
    "DEBUG": "False",
    "GEMINI_API_KEY": "", "ANTHROPIC_API_KEY": "", "REDIS_URL": "", "CELERY_BROKER_URL": "", "EMAIL_HOST": "",
})

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

import app.core.config as config  # noqa: E402

config.PRIVATE_MEDIA_ROOT = Path(_tmp) / "private_media"
import app.core.files as files  # noqa: E402

files.PRIVATE_MEDIA_ROOT = config.PRIVATE_MEDIA_ROOT

from app.core import throttle  # noqa: E402
from app.main import app  # noqa: E402
from app.services import emails  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUTBOX = []


@pytest.fixture(scope="session", autouse=True)
def database():
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "alembic"))
    command.upgrade(cfg, "head")


@pytest.fixture(autouse=True)
def outbox(monkeypatch):
    """Letters go here instead of SMTP; the throttle counters start empty for every test."""
    OUTBOX.clear()
    throttle._memory.clear()
    async def fake_send(subject, body, to):
        OUTBOX.append({"subject": subject, "body": body, "to": to})

    monkeypatch.setattr(emails, "send_plain", fake_send)
    return OUTBOX


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


def last_code(email):
    import re

    for letter in reversed(OUTBOX):
        if letter["to"] == email:
            return re.search(r"\b(\d{6})\b", letter["body"]).group(1)
    raise AssertionError(f"no code sent to {email}")


_counter = [0]


@pytest.fixture
async def user(client):
    """A new confirmed migrant; returns (headers, data)."""
    _counter[0] += 1
    email = f"user{_counter[0]}@example.com"
    r = await client.post("/api/auth/register/", json={"email": email, "password": "Strong-pass-2026", "full_name": "Али Валиев"})
    assert r.status_code == 201, r.text
    r = await client.post("/api/auth/verify-email/", json={"email": email, "code": last_code(email)})
    assert r.status_code == 201, r.text
    data = r.json()
    return {"Authorization": f"Bearer {data['access']}"}, data


async def set_role(user_id, role):
    from sqlalchemy import update

    from app.db.session import SessionLocal
    from app.models import User

    async with SessionLocal() as db:
        await db.execute(update(User).where(User.id == user_id).values(role=role))
        await db.commit()
