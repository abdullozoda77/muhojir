from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '0008'
down_revision: Union[str, Sequence[str], None] = '0007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('places') as batch:
        batch.add_column(sa.Column('proof', sa.String(length=100), server_default='', nullable=False))
        batch.add_column(sa.Column('reject_reason', sa.Text(), server_default='', nullable=False))


def downgrade() -> None:
    with op.batch_alter_table('places') as batch:
        batch.drop_column('reject_reason')
        batch.drop_column('proof')
