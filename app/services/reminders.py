from datetime import date

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models import ReminderLog, User, UserDocument
from app.services.notify import notify


def reminder_text(document, days):
    title = document.document_type.title
    end = document.expires_at.strftime("%d.%m.%Y")
    if days == 1:
        return f"Мӯҳлати «{title}» пагоҳ ({end}) тамом мешавад. Онро сари вақт нав кунед."
    return f"Мӯҳлати «{title}» пас аз {days} рӯз ({end}) тамом мешавад. Онро сари вақт нав кунед."


async def send_due_reminders(db, today=None):
    """Sends today's reminders: on the day the owner chose (remind_days_before) and the day before the end.
    Safe to run many times a day: ReminderLog remembers what was already sent. Returns how many were sent."""
    today = today or date.today()
    sent = 0
    documents = (await db.scalars(
        select(UserDocument).join(User, User.id == UserDocument.user_id)
        .where(UserDocument.expires_at > today, User.is_active.is_(True))
    )).unique().all()
    for document in documents:
        days_left = (document.expires_at - today).days
        if days_left not in (document.remind_days_before, 1):
            continue
        db.add(ReminderLog(user_document_id=document.id, expires_at=document.expires_at, days_before=days_left))
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            continue  # already sent today
        user = await db.get(User, document.user_id)
        await notify(db, user, document.document_type.title, reminder_text(document, days_left), kind="reminder")
        sent += 1
    return sent
