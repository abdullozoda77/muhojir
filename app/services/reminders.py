from datetime import date

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models import ReminderLog, User, UserDocument
from app.services.notify import notify


def reminder_title(document, language="tg"):
    return (language == "ru" and document.document_type.title_ru) or document.document_type.title


def reminder_text(document, days, language="tg"):
    title = reminder_title(document, language)
    end = document.expires_at.strftime("%d.%m.%Y")
    if language == "ru":
        if days == 0:
            return f"Срок «{title}» истёк сегодня ({end}). Продлите как можно скорее — без действующего документа можно получить штраф."
        if days == 1:
            return f"Срок «{title}» истекает завтра ({end}). Продлите его вовремя."
        return f"Срок «{title}» истекает через {days} дн. ({end}). Продлите его вовремя."
    if days == 0:
        return f"Мӯҳлати «{title}» имрӯз ({end}) тамом шуд. Ҳарчи зудтар нав кунед — бе ҳуҷҷати амалкунанда ҷарима гирифтан мумкин аст."
    if days == 1:
        return f"Мӯҳлати «{title}» пагоҳ ({end}) тамом мешавад. Онро сари вақт нав кунед."
    return f"Мӯҳлати «{title}» пас аз {days} рӯз ({end}) тамом мешавад. Онро сари вақт нав кунед."


async def send_due_reminders(db, today=None):
    today = today or date.today()
    sent = 0
    documents = (await db.scalars(
        select(UserDocument).join(User, User.id == UserDocument.user_id)
        .where(UserDocument.expires_at >= today, User.is_active.is_(True))
    )).unique().all()
    for document in documents:
        days_left = (document.expires_at - today).days
        if days_left not in (document.remind_days_before, 1, 0):
            continue
        db.add(ReminderLog(user_document_id=document.id, expires_at=document.expires_at, days_before=days_left))
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            continue
        user = await db.get(User, document.user_id)
        await notify(db, user, reminder_title(document, user.language), reminder_text(document, days_left, user.language), kind="reminder")
        sent += 1
    return sent
