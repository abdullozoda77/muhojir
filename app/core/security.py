import gzip
import re
import uuid
from datetime import timedelta
from difflib import SequenceMatcher
from functools import lru_cache

import jwt
from anyio import to_thread
from pwdlib import PasswordHash

from app.core.config import BASE_DIR, settings
from app.db.types import utcnow

password_hash = PasswordHash.recommended()
ALGORITHM = "HS256"


def _hash(password):
    return password_hash.hash(password)


def _verify(password, hashed):
    if not hashed:
        return False
    try:
        return password_hash.verify(password, hashed)
    except Exception:
        return False


@lru_cache
def _common_passwords():
    path = BASE_DIR / "app" / "seed" / "common-passwords.txt.gz"
    with gzip.open(path, "rt", encoding="utf-8") as f:
        return {line.strip() for line in f}


def _similar(password, value, max_similarity=0.7):
    if not value:
        return False
    value_lower = value.lower()
    parts = [value_lower, *re.split(r"\W+", value_lower)]
    return any(
        part and SequenceMatcher(a=password.lower(), b=part).quick_ratio() >= max_similarity
        for part in parts
    )


def _problems(password, email=""):
    problems = []
    if _similar(password, email):
        problems.append("Введённый пароль слишком похож на email.")
    if len(password) < 8:
        problems.append("Введённый пароль слишком короткий. Он должен состоять из как минимум 8 символов.")
    if password.lower().strip() in _common_passwords():
        problems.append("Введённый пароль слишком широко распространён.")
    if password.isdigit():
        problems.append("Введённый пароль состоит только из цифр.")
    return problems


def warm_up():
    _common_passwords()


async def hash_password(password):
    return await to_thread.run_sync(_hash, password)


async def verify_password(password, hashed):
    return await to_thread.run_sync(_verify, password, hashed)


async def password_problems(password, email=""):
    return await to_thread.run_sync(_problems, password, email)


def _token(user_id, kind, lifetime):
    now = utcnow()
    payload = {"token_type": kind, "user_id": user_id, "jti": uuid.uuid4().hex, "iat": now, "exp": now + lifetime}
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def make_tokens(user_id):
    return {
        "refresh": _token(user_id, "refresh", timedelta(days=settings.refresh_token_days)),
        "access": _token(user_id, "access", timedelta(minutes=settings.access_token_minutes)),
    }


def read_token(token, kind):
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
    return payload if payload.get("token_type") == kind and "user_id" in payload else None
