import json
from pathlib import Path
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '0017'
down_revision: Union[str, Sequence[str], None] = '0016'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SEED = Path(__file__).resolve().parents[2] / "app" / "seed"

COLUMNS = {
    "document_types": [("title_ru", sa.String(150)), ("description_ru", sa.Text())],
    "guide_steps": [("title_ru", sa.String(200)), ("body_ru", sa.Text()), ("required_papers_ru", sa.Text()),
                    ("cost_note_ru", sa.String(200)), ("deadline_note_ru", sa.String(200)),
                    ("where_ru", sa.String(255)), ("example_ru", sa.Text())],
    "migration_centers": [("working_hours_ru", sa.String(100))],
    "law_news": [("title_ru", sa.String(255)), ("summary_ru", sa.String(500)), ("body_ru", sa.Text())],
    "exam_questions": [("explanation_ru", sa.Text())],
    "help_contacts": [("title_ru", sa.String(200)), ("description_ru", sa.Text())],
}

MATCH = {
    "document_types": ("slug", "title"),
    "guide_steps": ("id", "title"),
    "migration_centers": ("id", "working_hours"),
    "law_news": ("id", "title"),
    "exam_questions": ("id", "explanation"),
    "help_contacts": ("id", "title"),
}


def load(name):
    return json.loads((SEED / f"{name}.json").read_text(encoding="utf-8"))


def upgrade() -> None:
    for table, columns in COLUMNS.items():
        with op.batch_alter_table(table, schema=None) as batch_op:
            for name, kind in columns:
                batch_op.add_column(sa.Column(name, kind, nullable=False, server_default=""))

    russian = load("content_ru")
    bind = op.get_bind()
    for table, (key, guard) in MATCH.items():
        originals = {str(row[key]): row[guard] for row in load(table)}
        target = sa.table(table, sa.column(key), sa.column(guard), *(sa.column(name) for name, _ in COLUMNS[table]))
        for row_key, values in russian[table].items():
            if row_key not in originals:
                continue
            if isinstance(values, str):
                values = {"explanation_ru": values}
            key_value = int(row_key) if key == "id" else row_key
            bind.execute(
                target.update()
                .where(target.c[key] == key_value, target.c[guard] == originals[row_key])
                .values(**values)
            )


def downgrade() -> None:
    for table, columns in COLUMNS.items():
        with op.batch_alter_table(table, schema=None) as batch_op:
            for name, _ in columns:
                batch_op.drop_column(name)
