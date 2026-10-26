import json
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

SEED = Path(__file__).resolve().parents[2] / "app" / "seed"
TABLES = [
    ("document_types", "document_types", ()),
    ("guide_steps", "guide_steps", ()),
    ("regions", "regions", ("patent_monthly_price",)),
    ("migration_centers", "migration_centers", ()),
    ("law_news", "law_news", ("published_at", "created_at")),
    ("exam_questions", "exam_questions", ()),
    ("help_contacts", "help_contacts", ()),
]


def load(name):
    return json.loads((SEED / f"{name}.json").read_text(encoding="utf-8"))


def when(value):
    if not value:
        return None
    moment = datetime.fromisoformat(value)
    moment = moment.replace(tzinfo=timezone.utc) if moment.tzinfo is None else moment.astimezone(timezone.utc)
    return moment.replace(tzinfo=None) if op.get_bind().dialect.name == "sqlite" else moment


def upgrade():
    meta = sa.MetaData()
    meta.reflect(bind=op.get_bind(), only=[t for t, _, _ in TABLES] + ["law_news_document_types"])
    links = []
    for table_name, file_name, special in TABLES:
        table = meta.tables[table_name]
        rows = []
        for row in load(file_name):
            if table_name == "law_news":
                links += [{"law_news_id": row["id"], "document_type_id": t} for t in row.pop("document_types")]
                row["created_by_id"] = None
            for column in special:
                row[column] = Decimal(row[column]) if column == "patent_monthly_price" else when(row[column])
            rows.append({key: value for key, value in row.items() if key in table.c})
        op.bulk_insert(table, rows)
    op.bulk_insert(meta.tables["law_news_document_types"], links)
    if op.get_bind().dialect.name == "postgresql":
        for table_name, _, _ in TABLES:
            op.execute(f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), COALESCE(MAX(id), 1)) FROM {table_name}")


def downgrade():
    for table_name in ["law_news_document_types", *reversed([t for t, _, _ in TABLES])]:
        op.execute(f"DELETE FROM {table_name}")
