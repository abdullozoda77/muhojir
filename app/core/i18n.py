from contextvars import ContextVar

current_lang: ContextVar[str] = ContextVar("current_lang", default="tg")


def header_lang(value):
    return "ru" if (value or "").strip().lower().startswith("ru") else "tg"


def tr(obj, field):
    if current_lang.get() == "ru":
        value = getattr(obj, f"{field}_ru", "")
        if value:
            return value
    return getattr(obj, field)


class LanguageMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] not in ("http", "websocket"):
            return await self.app(scope, receive, send)
        raw = dict(scope.get("headers") or []).get(b"accept-language", b"").decode("latin-1")
        token = current_lang.set(header_lang(raw))
        try:
            await self.app(scope, receive, send)
        finally:
            current_lang.reset(token)
