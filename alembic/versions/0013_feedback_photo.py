from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '0013'
down_revision: Union[str, Sequence[str], None] = '0012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('feedback', schema=None) as batch_op:
        batch_op.add_column(sa.Column('photo', sa.String(length=100), nullable=False, server_default=''))


def downgrade() -> None:
    with op.batch_alter_table('feedback', schema=None) as batch_op:
        batch_op.drop_column('photo')
