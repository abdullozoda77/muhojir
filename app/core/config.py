from datetime import timedelta
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    app_title: str = "Muhojir API"
    secret_key: str = "change-me-in-env"
    debug: bool = True
    database_url: str = f"sqlite+aiosqlite:///{BASE_DIR / 'db.sqlite3'}"
    cors_allowed_origins: str = ""
    https: bool = False

    access_token_minutes: int = 60
    refresh_token_days: int = 30

    email_host: str = ""
    email_port: int = 587
    email_use_tls: bool = True
    email_use_ssl: bool = False
    email_host_user: str = ""
    email_host_password: str = ""
    default_from_email: str = ""

    redis_url: str = ""
    celery_broker_url: str = ""

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.6-flash"
    gemini_fallback_models: str = "gemini-3.5-flash,gemini-3.8-flash,gemini-3.5-flash-lite"
    anthropic_api_key: str = ""
    travelpayouts_token: str = ""
    google_client_id: str = ""
    overpass_urls: str = "https://maps.mail.ru/osm/tools/overpass/api/interpreter,https://overpass-api.de/api/interpreter"
    assistant_model: str = "claude-opus-5"
    assistant_effort: str = "low"

    @property
    def cors_origins(self):
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]

    @property
    def smtp_ready(self):
        return bool(self.email_host and self.email_host_user and self.email_host_password)

    @property
    def from_email(self):
        return self.default_from_email or f'"Muhojir" <{self.email_host_user or "noreply@muhojir.tj"}>'

    @property
    def gemini_models(self):
        fallbacks = [m.strip() for m in self.gemini_fallback_models.split(",") if m.strip()]
        return list(dict.fromkeys([self.gemini_model, *fallbacks]))


settings = Settings()

MEDIA_ROOT = BASE_DIR / "media"
PRIVATE_MEDIA_ROOT = BASE_DIR / "private_media"

LOGIN_CODE_LIFETIME = timedelta(minutes=10)
LOGIN_CODE_MAX_ATTEMPTS = 5
RESEND_PAUSE = timedelta(minutes=1)
REMINDER_DAYS = (30, 7, 3, 1)
TIME_ZONE = "Europe/Moscow"
