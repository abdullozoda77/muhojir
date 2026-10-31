from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '0015'
down_revision: Union[str, Sequence[str], None] = '0014'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('housing', schema=None) as batch_op:
        batch_op.add_column(sa.Column('source', sa.String(length=20), nullable=False, server_default='user'))
        batch_op.add_column(sa.Column('source_name', sa.String(length=120), nullable=False, server_default=''))
        batch_op.add_column(sa.Column('source_url', sa.String(length=300), nullable=False, server_default=''))
        batch_op.add_column(sa.Column('external_id', sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column('fingerprint', sa.String(length=40), nullable=False, server_default=''))
        batch_op.alter_column('owner_id',
               existing_type=sa.INTEGER(),
               nullable=True)
        batch_op.create_index(batch_op.f('ix_housing_external_id'), ['external_id'], unique=True)
        batch_op.create_index(batch_op.f('ix_housing_source'), ['source'], unique=False)
        batch_op.create_index(batch_op.f('ix_housing_fingerprint'), ['fingerprint'], unique=False)


def downgrade() -> None:
    op.execute("DELETE FROM housing WHERE owner_id IS NULL")
    with op.batch_alter_table('housing', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_housing_fingerprint'))
        batch_op.drop_index(batch_op.f('ix_housing_source'))
        batch_op.drop_index(batch_op.f('ix_housing_external_id'))
        batch_op.alter_column('owner_id',
               existing_type=sa.INTEGER(),
               nullable=False)
        batch_op.drop_column('fingerprint')
        batch_op.drop_column('external_id')
        batch_op.drop_column('source_url')
        batch_op.drop_column('source_name')
        batch_op.drop_column('source')
