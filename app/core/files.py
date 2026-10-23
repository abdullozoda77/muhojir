"""Private files: document photos and payment receipts. They are kept in PRIVATE_MEDIA_ROOT, which the web server
never serves; the API hands a file only to its owner. Names are random, so the original file name does not leak."""
import os
import uuid

import anyio
from fastapi import UploadFile

from app.core.config import PRIVATE_MEDIA_ROOT
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
