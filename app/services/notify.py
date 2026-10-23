"""One place that tells a user something: a notification in the app (live in open tabs), plus an email when
they allow it."""
import logging

from app.models import Notification
from app.services.emails import queue_email
from app.services.live import push_new

logger = logging.getLogger(__name__)


async def notify(db, user, title, message, kind="system"):
    notification = Notification(user_id=user.id, kind=kind, title=title, message=message)
    db.add(notification)
    await db.commit()
    await push_new(db, notification)
    if user.email_reminders and user.email:
        try:
            await queue_email(f"Muhojir — {title}", message, user.email)
        except OSError:
            # The notification in the app is already saved; a mail server problem must not stop the others.
            logger.exception("Email to %s failed", user.email)
    return notification
