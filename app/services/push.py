import base64
import json
import logging
import os
import time
from functools import cache
from urllib.parse import urlsplit

import httpx
import jwt
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from sqlalchemy import select

import app.core.config as config
from app.core.config import settings
from app.models import PushSubscription

logger = logging.getLogger(__name__)

TTL = 24 * 60 * 60
GONE = (404, 410)


def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def unb64url(text):
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def load_key(text):
    text = text.strip()
    if text.startswith("-----"):
        return serialization.load_pem_private_key(text.encode(), password=None)
    return ec.derive_private_key(int.from_bytes(unb64url(text), "big"), ec.SECP256R1())


@cache
def private_key():
    if settings.vapid_private_key:
        return load_key(settings.vapid_private_key)
    path = config.PRIVATE_MEDIA_ROOT / "vapid.pem"
    if path.exists():
        return load_key(path.read_text())
    key = ec.generate_private_key(ec.SECP256R1())
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                       serialization.NoEncryption()))
    os.chmod(path, 0o600)
    return key


def raw_public(key):
    return key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)


def public_key():
    return b64url(raw_public(private_key().public_key()))


def hkdf(secret, salt, info, length):
    return HKDF(algorithm=hashes.SHA256(), length=length, salt=salt, info=info).derive(secret)


def encrypt(p256dh, auth, payload, salt=None, server_key=None):
    client_public = unb64url(p256dh)
    client_key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), client_public)
    server_key = server_key or ec.generate_private_key(ec.SECP256R1())
    server_public = raw_public(server_key.public_key())
    salt = salt or os.urandom(16)
    shared = server_key.exchange(ec.ECDH(), client_key)
    ikm = hkdf(shared, unb64url(auth), b"WebPush: info\x00" + client_public + server_public, 32)
    cek = hkdf(ikm, salt, b"Content-Encoding: aes128gcm\x00", 16)
    nonce = hkdf(ikm, salt, b"Content-Encoding: nonce\x00", 12)
    body = AESGCM(cek).encrypt(nonce, payload + b"\x02", None)
    return salt + (4096).to_bytes(4, "big") + bytes([len(server_public)]) + server_public + body


def vapid_header(endpoint):
    parts = urlsplit(endpoint)
    claims = {"aud": f"{parts.scheme}://{parts.netloc}", "exp": int(time.time()) + 12 * 60 * 60,
              "sub": settings.vapid_subject or settings.site_url}
    token = jwt.encode(claims, private_key(), algorithm="ES256")
    return f"vapid t={token}, k={public_key()}"


async def post(endpoint, body, headers):
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(endpoint, content=body, headers=headers)
    return response.status_code


async def send_one(subscription, data):
    body = encrypt(subscription.p256dh, subscription.auth, json.dumps(data, ensure_ascii=False).encode())
    headers = {"Authorization": vapid_header(subscription.endpoint), "Content-Encoding": "aes128gcm",
               "Content-Type": "application/octet-stream", "TTL": str(TTL), "Urgency": "normal"}
    try:
        return await post(subscription.endpoint, body, headers)
    except httpx.HTTPError as error:
        logger.warning("Push to %s failed: %s", subscription.endpoint[:60], error)
        return 0


async def send_to_user(db, user, title, message, url="/notifications"):
    subscriptions = (await db.scalars(select(PushSubscription).where(PushSubscription.user_id == user.id))).unique().all()
    sent, gone = 0, False
    for subscription in subscriptions:
        status = await send_one(subscription, {"title": title, "body": message, "url": url})
        if status in GONE:
            await db.delete(subscription)
            gone = True
        elif 200 <= status < 300:
            sent += 1
    if gone:
        await db.commit()
    return sent
