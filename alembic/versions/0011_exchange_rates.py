from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

import app.db.types

revision: str = '0011'
down_revision: Union[str, Sequence[str], None] = '0010'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('exchange_rates',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('source', sa.String(length=10), nullable=False),
    sa.Column('day', sa.Date(), nullable=False),
    sa.Column('value', sa.Float(), nullable=False),
    sa.Column('fetched_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('source', 'day', name='one_rate_per_source_day')
    )
    with op.batch_alter_table('exchange_rates', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_exchange_rates_day'), ['day'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('exchange_rates', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_exchange_rates_day'))

    op.drop_table('exchange_rates')
