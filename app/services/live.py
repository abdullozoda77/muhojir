import asyncio
import json
import logging
from collections import defaultdict

from fastapi import WebSocket
from fastapi.encoders import jsonable_encoder
from sqlalchemy import func, select

from app.core.config import settings
from app.models import Notification

logger = logging.getLogger(__name__)
CHANNEL = "muhojir:live"


class Hub:
    def __init__(self):
        self.sockets: dict[int, set[WebSocket]] = defaultdict(set)
        self.listener = None

    def add(self, user_id, socket):
        self.sockets[user_id].add(socket)

    def remove(self, user_id, socket):
        self.sockets[user_id].discard(socket)
        if not self.sockets[user_id]:
            self.sockets.pop(user_id, None)

    async def deliver(self, user_id, message):
        message = jsonable_encoder(message)
        for socket in list(self.sockets.get(user_id, ())):
            try:
                await socket.send_json(message)
            except Exception:
                self.remove(user_id, socket)

    async def publish(self, user_id, message):
        if settings.redis_url:
            try:
                import redis.asyncio as redis

                async with redis.from_url(settings.redis_url) as client:
                    await client.publish(CHANNEL, json.dumps({"user_id": user_id, "message": jsonable_encoder(message)}))
                return
            except Exception:
                logger.exception("Live notification to user %s failed (Redis)", user_id)
        await self.deliver(user_id, message)

    async def listen(self):
        import redis.asyncio as redis

        while True:
            try:
                async with redis.from_url(settings.redis_url) as client, client.pubsub() as pubsub:
                    await pubsub.subscribe(CHANNEL)
                    async for item in pubsub.listen():
                        if item.get("type") != "message":
                            continue
                        data = json.loads(item["data"])
                        await self.deliver(data["user_id"], data["message"])
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Live notifications: Redis connection lost, retrying in 5 s")
                await asyncio.sleep(5)


hub = Hub()


def notification_json(n):
    return {"id": n.id, "kind": n.kind, "title": n.title, "message": n.message, "is_read": n.is_read, "created_at": n.created_at}


async def unread_count(db, user_id):
    return await db.scalar(select(func.count()).where(Notification.user_id == user_id, Notification.is_read.is_(False)))


async def push_new(db, notification):
    try:
        await hub.publish(notification.user_id, {
            "type": "notification",
            "notification": notification_json(notification),
            "unread": await unread_count(db, notification.user_id),
        })
    except Exception:
        logger.exception("Live notification failed")


async def push_count(db, user_id):
    try:
        await hub.publish(user_id, {"type": "unread", "unread": await unread_count(db, user_id)})
    except Exception:
        logger.exception("Live notification failed")
