"""All settings come from .env (or the environment). Without a .env everything works on a laptop:
SQLite database, emails printed in the console, tasks run at once, live notifications inside one process."""
from datetime import timedelta
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    app_title: str = "Muhojir API"
    secret_key: str = "change-me-in-env"
    debug: bool = True
    # SQLite by default; on a server for example postgresql+asyncpg://user:password@localhost/muhojir
    database_url: str = f"sqlite+aiosqlite:///{BASE_DIR / 'db.sqlite3'}"
    cors_allowed_origins: str = ""  # comma-separated; the site itself needs none (same address)
    https: bool = False  # behind nginx with a certificate: the admin login cookie only over HTTPS

    access_token_minutes: int = 60
    refresh_token_days: int = 30

    # Email (SMTP). Until host, user and password are all set, letters are only printed in the console.
    email_host: str = ""
    email_port: int = 587
    email_use_tls: bool = True
    email_use_ssl: bool = False
    email_host_user: str = ""
    email_host_password: str = ""
    default_from_email: str = ""

    # Redis: live notifications between several server processes (database 0 by default).
    redis_url: str = ""
    # Celery: emails in the background and the daily jobs. Empty = every task runs at once (no worker needed).
    celery_broker_url: str = ""

    # AI assistant: GEMINI_API_KEY (Google, has a free tier) first, otherwise ANTHROPIC_API_KEY (Claude).
    gemini_api_key: str = ""
    # The newest free models are the most often overloaded; these answer in 1-2 s and handle the tools well.
    gemini_model: str = "gemini-3.6-flash"
    gemini_fallback_models: str = "gemini-3.5-flash,gemini-3.8-flash,gemini-3.5-flash-lite"
    anthropic_api_key: str = ""
    # Air tickets: real prices from Travelpayouts / Aviasales (free token at https://www.travelpayouts.com).
    # Without it the tickets page still shows the airports and opens the search on aviasales.ru.
    travelpayouts_token: str = ""
    # Places directory: OpenStreetMap data through an Overpass server (comma-separated, tried in turn).
    overpass_urls: str = "https://maps.mail.ru/osm/tools/overpass/api/interpreter,https://overpass-api.de/api/interpreter"
    assistant_model: str = "claude-opus-5"
    assistant_effort: str = "low"  # low answers fastest

    @property
    def cors_origins(self):
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]

    @property
    def smtp_ready(self):
        return bool(self.email_host and self.email_host_user and self.email_host_password)

    @property
    def from_email(self):
        # Gmail and most SMTP servers only send "from" the account itself, so it is used by default.
        return self.default_from_email or f'"Muhojir" <{self.email_host_user or "noreply@muhojir.tj"}>'

    @property
    def gemini_models(self):
        fallbacks = [m.strip() for m in self.gemini_fallback_models.split(",") if m.strip()]
        return list(dict.fromkeys([self.gemini_model, *fallbacks]))


settings = Settings()

MEDIA_ROOT = BASE_DIR / "media"
PRIVATE_MEDIA_ROOT = BASE_DIR / "private_media"  # document photos and receipts: only through the API, to the owner

LOGIN_CODE_LIFETIME = timedelta(minutes=10)
LOGIN_CODE_MAX_ATTEMPTS = 5
RESEND_PAUSE = timedelta(minutes=1)  # a new code for the same email at most once a minute
# Days before a document runs out when the owner may get a reminder.
REMINDER_DAYS = (30, 7, 3, 1)
TIME_ZONE = "Europe/Moscow"
