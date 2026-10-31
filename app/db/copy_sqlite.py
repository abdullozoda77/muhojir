from sqlalchemy import Integer, String, func, inspect, select, text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings
from app.db.base import Base
import app.models

BATCH = 500


async def _version(conn):
    return await conn.scalar(text("SELECT version_num FROM alembic_version"))


async def copy_sqlite_to_postgres(sqlite_path):
    source = create_async_engine(f"sqlite+aiosqlite:///{sqlite_path}")
    target = create_async_engine(settings.database_url)
    if target.dialect.name != "postgresql":
        raise SystemExit("DATABASE_URL must point to PostgreSQL.")
    tables = Base.metadata.sorted_tables
    try:
        async with source.connect() as src, target.begin() as dst:
            src_version, dst_version = await _version(src), await _version(dst)
            if src_version != dst_version:
                raise SystemExit(f"Migrations differ: SQLite {src_version}, PostgreSQL {dst_version}. Run alembic upgrade head on both.")

            src_tables = set(await src.run_sync(lambda c: inspect(c).get_table_names()))
            unknown = src_tables - {t.name for t in tables} - {"alembic_version"}
            if unknown:
                raise SystemExit(f"SQLite has tables the models do not know: {', '.join(sorted(unknown))}")

            too_long = []
            for table in tables:
                for column in table.columns:
                    if isinstance(column.type, String) and column.type.length:
                        count = await src.scalar(select(func.count()).where(func.length(column) > column.type.length))
                        if count:
                            too_long.append(f"{table.name}.{column.name} ({count} rows over {column.type.length})")
            if too_long:
                raise SystemExit("Values too long for PostgreSQL: " + "; ".join(too_long))

            await dst.execute(text("TRUNCATE " + ", ".join(f'"{t.name}"' for t in tables) + " RESTART IDENTITY CASCADE"))

            report = []
            for table in tables:
                copied = 0
                result = await src.stream(select(table))
                async for rows in result.partitions(BATCH):
                    await dst.execute(table.insert(), [dict(row._mapping) for row in rows])
                    copied += len(rows)
                in_target = await dst.scalar(select(func.count()).select_from(table))
                if in_target != copied:
                    raise SystemExit(f"{table.name}: copied {copied}, but PostgreSQL has {in_target}.")
                report.append((table.name, copied))

                pk = list(table.primary_key.columns)
                if len(pk) == 1 and isinstance(pk[0].type, Integer):
                    await dst.execute(text(
                        f"SELECT setval(pg_get_serial_sequence('\"{table.name}\"', '{pk[0].name}'), "
                        f"COALESCE(MAX(\"{pk[0].name}\"), 1), MAX(\"{pk[0].name}\") IS NOT NULL) FROM \"{table.name}\""
                    ))
    finally:
        await source.dispose()
        await target.dispose()

    for name, count in report:
        print(f"{name}: {count}")
    print(f"Done: {sum(c for _, c in report)} rows in {len(report)} tables copied from {sqlite_path}.")
