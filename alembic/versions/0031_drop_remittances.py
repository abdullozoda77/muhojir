from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

import app.db.types

revision: str = '0031'
down_revision: Union[str, Sequence[str], None] = '0030'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table('remittances')


def downgrade() -> None:
    op.create_table(
        'remittances',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('fee', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('service', sa.String(length=20), nullable=False),
        sa.Column('recipient', sa.String(length=100), nullable=False),
        sa.Column('sent_at', sa.Date(), nullable=False),
        sa.Column('note', sa.String(length=255), nullable=False),
        sa.Column('created_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_remittances_user_id', 'remittances', ['user_id'])
    op.create_index('ix_remittances_sent_at', 'remittances', ['sent_at'])
