import json
from pathlib import Path
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

import app.db.types

revision: str = '0024'
down_revision: Union[str, Sequence[str], None] = '0023'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SEED = Path(__file__).resolve().parents[2] / "app" / "seed"
NEW_COLUMNS = ("needs", "needs_ru", "if_bad", "if_bad_ru", "documents")


def upgrade() -> None:
    with op.batch_alter_table('help_contacts') as batch:
        for name in NEW_COLUMNS:
            kind = sa.String(length=100) if name == "documents" else sa.Text()
            batch.add_column(sa.Column(name, kind, nullable=False, server_default=""))
        batch.add_column(sa.Column('repeat_days', sa.Integer(), nullable=True))

    op.create_table(
        'check_results',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('contact_id', sa.Integer(), nullable=False),
        sa.Column('result', sa.String(length=10), nullable=False),
        sa.Column('checked_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['contact_id'], ['help_contacts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'contact_id', name='one_result_per_check'),
    )
    op.create_index('ix_check_results_user_id', 'check_results', ['user_id'])

    table = sa.table("help_contacts", *[sa.column(name) for name in (
        "id", "kind", "title", "title_ru", "website", "description", "description_ru", "phone", "region_id",
        "is_active", "order", "repeat_days", *NEW_COLUMNS)])
    bind = op.get_bind()
    for row in json.loads((SEED / "checks.json").read_text(encoding="utf-8")):
        row_id = row.pop("id", None)
        exists = row_id is not None and bind.execute(sa.select(table.c.id).where(table.c.id == row_id)).first()
        if exists:
            bind.execute(table.update().where(table.c.id == row_id).values(**row))
        elif not bind.execute(sa.select(table.c.id).where(table.c.kind == "mvd_check", table.c.website == row["website"])).first():
            row.setdefault("description", "")
            row.setdefault("description_ru", "")
            bind.execute(table.insert().values(kind="mvd_check", phone="", region_id=None, is_active=True, **row))


def downgrade() -> None:
    op.drop_index('ix_check_results_user_id', table_name='check_results')
    op.drop_table('check_results')
    with op.batch_alter_table('help_contacts') as batch:
        batch.drop_column('repeat_days')
        for name in reversed(NEW_COLUMNS):
            batch.drop_column(name)
