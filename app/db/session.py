"""The database connection. On SQLite lower() only knows Latin letters, so a search for «москва» would not find
«Москва»; it is replaced with Python's lower(), which knows every alphabet (Cyrillic, Tajik). SQLAlchemy's
ilike() is lower(x) LIKE lower(y) on SQLite, so every search ignores case. PostgreSQL does not need this."""
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(settings.database_url, pool_pre_ping=True)

if engine.dialect.name == "sqlite":
    @event.listens_for(engine.sync_engine, "connect")
    def _sqlite_setup(connection, record):
        connection.create_function("lower", 1, lambda s: s.lower() if isinstance(s, str) else s, deterministic=True)
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db():
    async with SessionLocal() as session:
        yield session
