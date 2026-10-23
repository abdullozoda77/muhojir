"""Limits on how often one visitor may do something (sending email codes, password tries, AI questions).
The counter is kept in Redis when REDIS_URL is set (shared by all server processes), otherwise in memory."""
import time
from collections import defaultdict

from fastapi import Request

from app.core.config import settings
from app.core.errors import ApiError

RATES = {
    "login_code": (5, 3600),  # emails with codes
    "login": (20, 3600),  # password tries: enough for typos, too few for guessing
    "assistant": (40, 3600),  # questions to the AI assistant (each one costs a model call)
}

_memory = defaultdict(list)
_redis = None


def _redis_client():
    global _redis
    if _redis is None and settings.redis_url:
        import redis.asyncio as redis

        _redis = redis.from_url(settings.redis_url)
    return _redis


def visitor(request: Request):
    user = getattr(request.state, "user", None)
    if user is not None:
        return f"user:{user.id}"
    forwarded = request.headers.get("x-forwarded-for", "")
    return "ip:" + (forwarded.split(",")[0].strip() or (request.client.host if request.client else "?"))


async def _hit(key, limit, window):
    """Counts this request; returns how many seconds to wait, or 0 when it is allowed."""
    now = time.time()
    client = _redis_client()
    if client is not None:
        try:
            async with client.pipeline(transaction=True) as pipe:
                pipe.zremrangebyscore(key, 0, now - window)
                pipe.zcard(key)
                pipe.zrange(key, 0, 0, withscores=True)
                _, count, oldest = await pipe.execute()
            if count >= limit:
                return int(oldest[0][1] + window - now) + 1 if oldest else window
            await client.zadd(key, {f"{now}": now})
            await client.expire(key, window)
            return 0
        except Exception:
            pass  # Redis is down: fall back to memory, never block the site because of the counter
    hits = [t for t in _memory[key] if t > now - window]
    if len(hits) >= limit:
        _memory[key] = hits
        return int(hits[0] + window - now) + 1
    hits.append(now)
    _memory[key] = hits
    return 0


def throttle(scope):
    """Depends(throttle("login")) on a route: 429 when the visitor did it too often."""

    async def check(request: Request):
        limit, window = RATES[scope]
        wait = await _hit(f"muhojir:throttle:{scope}:{visitor(request)}", limit, window)
        if wait:
            raise ApiError(f"Запрос был проигнорирован. Ожидается освобождение через {wait} секунд.", 429)

    return check
