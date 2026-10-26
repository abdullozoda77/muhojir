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
            logger.exception("Email to %s failed", user.email)
    return notification
