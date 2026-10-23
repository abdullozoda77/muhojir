"""Emails (SMTP from .env): codes after sign-up and for a new password, and notifications.
Without SMTP settings the letter is only printed in the console (development)."""
import logging
import secrets
from email.message import EmailMessage
from email.utils import make_msgid

import aiosmtplib
from anyio import to_thread
from sqlalchemy import select

from app.core.config import LOGIN_CODE_LIFETIME, settings
from app.core.security import hash_password
from app.db.types import utcnow
from app.models import EmailCode

logger = logging.getLogger(__name__)

SUBJECTS = {"verify": "Тасдиқи почта", "reset": "Барқарор кардани парол"}
LINES = {"verify": "Рамзи тасдиқи почтаи шумо дар Muhojir", "reset": "Рамзи барқарор кардани парол дар Muhojir"}


def build_message(subject, body, to):
    """A plain-text email, kept like an ordinary personal one, because Gmail hides automatic-looking letters:
    plain text, and a Message-ID with the sender's own domain."""
    sender = settings.from_email
    domain = sender.rsplit("@", 1)[-1].strip(">").strip() or "localhost"
    message = EmailMessage()
    message["Subject"], message["From"], message["To"] = subject, sender, to
    message["Message-ID"] = make_msgid(domain=domain)
    message.set_content(body)
    return message


async def send_plain(subject, body, to):
    """Sends the email through the SMTP server from .env (async). Without SMTP settings it is only printed."""
    if not settings.smtp_ready:
        print(f"\n--- email to {to} ---\nSubject: {subject}\n\n{body}\n---\n", flush=True)
        return
    try:
        await aiosmtplib.send(
            build_message(subject, body, to),
            hostname=settings.email_host, port=settings.email_port,
            username=settings.email_host_user, password=settings.email_host_password,
            use_tls=settings.email_use_ssl, start_tls=settings.email_use_tls and not settings.email_use_ssl,
            timeout=15,
        )
    except aiosmtplib.SMTPException as error:
        raise OSError(f"SMTP: {error}") from error  # callers treat every mail problem as OSError


async def queue_email(subject, body, to):
    """Sends the email in the background (Celery). Without a queue (development), or when the queue itself is
    unreachable (Redis down), it is sent right here, so codes keep working. Raises OSError if SMTP fails then."""
    if settings.celery_broker_url:
        from app.worker import send_email

        try:
            await to_thread.run_sync(lambda: send_email.delay(subject, body, to))
            return
        except Exception:
            logger.warning("Email queue unavailable, sending directly", exc_info=True)
    await send_plain(subject, body, to)


async def send_code(db, email, purpose="verify"):
    """Makes a new code, saves its hash (replacing any older code for this email) and emails the code."""
    code = f"{secrets.randbelow(10**6):06d}"
    entry = await db.scalar(select(EmailCode).where(EmailCode.email == email))
    if entry is None:
        entry = EmailCode(email=email)
        db.add(entry)
    entry.purpose, entry.code_hash, entry.sent_at, entry.attempts = purpose, hash_password(code), utcnow(), 0
    await db.commit()
    if settings.debug:
        # Development only: the code is also shown in the server log, to test while email is slow or lost.
        print(f"\n*** {purpose} code for {email}: {code} ***\n", flush=True)
    minutes = int(LOGIN_CODE_LIFETIME.total_seconds() // 60)
    await queue_email(
        f"Muhojir — {SUBJECTS[purpose]}",
        f"Салом!\n\n{LINES[purpose]}: {code}\n\nРамз {minutes} дақиқа амал мекунад.\n"
        "Агар шумо ин корро накарда бошед, ин мактубро нодида гиред.\n\nMuhojir",
        email,
    )
