import asyncio
import time

import httpx

from app.core import cache

URL = "https://nominatim.openstreetmap.org/search"
HEADERS = {"User-Agent": "Muhojir/1.0 (https://king.tj)"}
CACHE_SECONDS = 7 * 24 * 3600
GAP = 1.1

_lock = asyncio.Lock()
_last = 0.0


class GeocodeUnavailable(Exception):
    pass


def short_name(item):
    parts = [p.strip() for p in item.get("display_name", "").split(",") if p.strip()]
    return ", ".join(parts[:4])


async def search(query, lang="ru"):
    global _last
    query = " ".join(query.split())[:200]
    key = f"geocode:{lang}:{query.lower()}"
    cached = await cache.get(key)
    if cached is not None:
        return cached
    params = {"q": query, "format": "jsonv2", "limit": 6, "accept-language": lang, "countrycodes": "ru,tj"}
    async with _lock:
        wait = _last + GAP - time.monotonic()
        if wait > 0:
            await asyncio.sleep(wait)
        try:
            async with httpx.AsyncClient(timeout=10, headers=HEADERS) as client:
                response = await client.get(URL, params=params)
                response.raise_for_status()
                items = response.json()
        except (httpx.HTTPError, ValueError) as error:
            raise GeocodeUnavailable() from error
        finally:
            _last = time.monotonic()
    results = [{"name": short_name(i), "full_name": i.get("display_name", ""), "lat": round(float(i["lat"]), 6),
                "lon": round(float(i["lon"]), 6), "kind": i.get("type", "")} for i in items if i.get("lat") and i.get("lon")]
    await cache.put(key, results, CACHE_SECONDS)
    return results
