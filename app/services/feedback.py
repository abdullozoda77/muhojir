from app.db.types import utcnow
from app.services.notify import notify

REPLY_TITLE = "Ҷавоб ба фикри шумо"


async def send_reply(db, feedback):
    user, message, reply = feedback.user, feedback.message, feedback.reply
    feedback.replied_at = utcnow()
    feedback.status = "done"
    await db.commit()
    await notify(db, user, REPLY_TITLE, f"Шумо навишта будед: «{message[:200]}»\n\nҶавоби Muhojir: {reply}")
