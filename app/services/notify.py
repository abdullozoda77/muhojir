import logging

from sqlalchemy import or_, select

from app.models import Notification, User
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


WELCOME_TITLE = "Хуш омадед ба Muhojir!"
WELCOME_TEXT = (
    "Ҳуҷҷатҳои худро (патент, бақайдгирӣ, шиноснома) дар «Ҳуҷҷатҳои ман» илова кунед — пеш аз тамом шудани "
    "мӯҳлат ба шумо хабар медиҳем. Инчунин дар сайт кор, чиптаҳои арзон ва ҷойҳои муфид дар Русия ҳаст."
)
PASSWORD_TITLE = "Пароли шумо иваз шуд"
PASSWORD_TEXT = "Пароли ҳисоби шумо ҳозир иваз карда шуд. Агар ин шумо набошед, фавран паролро аз нав барқарор кунед."


async def welcome(db, user):
    return await notify(db, user, WELCOME_TITLE, WELCOME_TEXT)


async def notify_editors(db, title, message, skip=None):
    editors = (await db.scalars(select(User).where(
        User.is_active.is_(True), or_(User.role.in_(("editor", "admin")), User.is_superuser.is_(True))))).all()
    for editor in editors:
        if skip is None or editor.id != skip.id:
            await notify(db, editor, title, message)
