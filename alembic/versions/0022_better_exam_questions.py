import json
from pathlib import Path
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '0022'
down_revision: Union[str, Sequence[str], None] = '0021'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SEED = Path(__file__).resolve().parents[2] / "app" / "seed"
IDS = (9, 11, 13, 14, 55, 56, 61, 65)


def load(name):
    return json.loads((SEED / f"{name}.json").read_text(encoding="utf-8"))


def upgrade() -> None:
    questions = {row["id"]: row for row in load("exam_questions")}
    russian = load("content_ru")["exam_questions"]
    table = sa.table("exam_questions", sa.column("id", sa.Integer), sa.column("question", sa.String),
                     sa.column("options", sa.JSON), sa.column("answer", sa.Integer),
                     sa.column("explanation", sa.Text), sa.column("explanation_ru", sa.Text))
    bind = op.get_bind()
    for row_id in IDS:
        row = questions[row_id]
        bind.execute(table.update().where(table.c.id == row_id).values(
            question=row["question"], options=row["options"], answer=row["answer"],
            explanation=row["explanation"], explanation_ru=russian.get(str(row_id), "")))


def downgrade() -> None:
    pass
