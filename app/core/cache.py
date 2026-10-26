import json
import time

from app.core.config import settings

_memory: dict[str, tuple[float, str]] = {}
_redis = None


def _client():
    global _redis
    if _redis is None and settings.redis_url:
        import redis.asyncio as redis

        _redis = redis.from_url(settings.redis_url)
    return _redis


async def get(key):
    client = _client()
    if client is not None:
        try:
            raw = await client.get(f"muhojir:cache:{key}")
            return json.loads(raw) if raw else None
        except Exception:
            pass
    expires, raw = _memory.get(key, (0, None))
    return json.loads(raw) if raw and expires > time.time() else None


async def put(key, value, seconds):
    raw = json.dumps(value, ensure_ascii=False, default=str)
    client = _client()
    if client is not None:
        try:
            await client.set(f"muhojir:cache:{key}", raw, ex=seconds)
            return
        except Exception:
            pass
    if len(_memory) > 2000:
        _memory.clear()
    _memory[key] = (time.time() + seconds, raw)
