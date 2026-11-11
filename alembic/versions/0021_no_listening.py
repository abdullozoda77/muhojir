import json
from pathlib import Path
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '0021'
down_revision: Union[str, Sequence[str], None] = '0020'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SEED = Path(__file__).resolve().parents[2] / "app" / "seed"


def upgrade() -> None:
    questions = {row["id"]: row["question"]
                 for row in json.loads((SEED / "exam_questions.json").read_text(encoding="utf-8"))}
    table = sa.table("exam_questions", sa.column("id", sa.Integer), sa.column("question", sa.String),
                     sa.column("listen_text", sa.Text))
    bind = op.get_bind()
    rows = bind.execute(sa.select(table.c.id, table.c.listen_text).where(table.c.listen_text != "")).all()
    for row_id, text in rows:
        question = questions.get(row_id)
        if not question or text not in question:
            question = f"Прочитайте: «{text}»"
        bind.execute(table.update().where(table.c.id == row_id).values(question=question[:500]))
    with op.batch_alter_table("exam_questions", schema=None) as batch_op:
        batch_op.drop_column("listen_text")


def downgrade() -> None:
    with op.batch_alter_table("exam_questions", schema=None) as batch_op:
        batch_op.add_column(sa.Column("listen_text", sa.Text(), nullable=False, server_default=""))
