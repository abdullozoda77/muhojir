"""Private files: document photos and payment receipts. They are kept in PRIVATE_MEDIA_ROOT, which the web server
never serves; the API hands a file only to its owner. Names are random, so the original file name does not leak."""
import os
import uuid

import anyio
from fastapi import UploadFile

from app.core.config import MEDIA_ROOT, PRIVATE_MEDIA_ROOT
from app.core.errors import FieldError

MAX_FILE_MB = 10
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}


async def save_private(file: UploadFile, folder, field):
    """Checks and saves an uploaded file; returns its name inside PRIVATE_MEDIA_ROOT, e.g. documents/ab12….jpg."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in EXTENSIONS:
        allowed = ", ".join(e.lstrip(".") for e in sorted(EXTENSIONS))
        raise FieldError(field, f"Расширение файлов “{ext.lstrip('.')}” не поддерживается. Разрешенные расширения: {allowed}.")
    data = await file.read(MAX_FILE_MB * 1024 * 1024 + 1)
    if not data:
        raise FieldError(field, "Загруженный файл пуст.")
    if len(data) > MAX_FILE_MB * 1024 * 1024:
        raise FieldError(field, f"The file is too big. The limit is {MAX_FILE_MB} MB.")
    name = f"{folder}/{uuid.uuid4().hex}{ext}"
    path = anyio.Path(PRIVATE_MEDIA_ROOT / name)
    await path.parent.mkdir(parents=True, exist_ok=True)
    await path.write_bytes(data)  # in a worker thread, so a slow disk never blocks other requests
    return name


async def delete_private(name):
    if name:
        await anyio.Path(PRIVATE_MEDIA_ROOT / name).unlink(missing_ok=True)


def private_path(name):
    return PRIVATE_MEDIA_ROOT / name if name else None


# --- Profile photos: public (shown on the site), in MEDIA_ROOT/avatars. The site makes them small before upload.

MAX_AVATAR_MB = 3
IMAGE_TYPES = {b"\xff\xd8\xff": ".jpg", b"\x89PNG": ".png"}


def image_ext(data):
    """The real type of the picture from its first bytes (not from the file name); None if it is not one."""
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    return next((ext for magic, ext in IMAGE_TYPES.items() if data.startswith(magic)), None)


async def save_avatar(file: UploadFile, field="avatar"):
    data = await file.read(MAX_AVATAR_MB * 1024 * 1024 + 1)
    if not data:
        raise FieldError(field, "Загруженный файл пуст.")
    if len(data) > MAX_AVATAR_MB * 1024 * 1024:
        raise FieldError(field, f"The photo is too big. The limit is {MAX_AVATAR_MB} MB.")
    ext = image_ext(data)
    if ext is None:
        raise FieldError(field, "Upload a photo: JPG, PNG or WEBP.")
    name = f"avatars/{uuid.uuid4().hex}{ext}"
    path = anyio.Path(MEDIA_ROOT / name)
    await path.parent.mkdir(parents=True, exist_ok=True)
    await path.write_bytes(data)
    return name


async def delete_avatar(name):
    if name and name.startswith("avatars/"):
        await anyio.Path(MEDIA_ROOT / name).unlink(missing_ok=True)
