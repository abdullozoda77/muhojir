from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

import app.db.types

revision: str = '0007'
down_revision: Union[str, Sequence[str], None] = '0006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('shop_proofs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('shop_id', sa.Integer(), nullable=False),
    sa.Column('kind', sa.String(length=10), nullable=False),
    sa.Column('file', sa.String(length=100), nullable=False),
    sa.Column('created_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_shop_proofs_shop_id', 'shop_proofs', ['shop_id'])
    with op.batch_alter_table('shops') as batch:
        batch.drop_column('origin')


def downgrade() -> None:
    with op.batch_alter_table('shops') as batch:
        batch.add_column(sa.Column('origin', sa.String(length=10), server_default='tj', nullable=False))
    op.drop_index('ix_shop_proofs_shop_id', table_name='shop_proofs')
    op.drop_table('shop_proofs')
