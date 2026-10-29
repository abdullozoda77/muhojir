from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

import app.db.types

revision: str = '0012'
down_revision: Union[str, Sequence[str], None] = '0011'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('feedback',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('kind', sa.String(length=10), nullable=False),
    sa.Column('rating', sa.Integer(), nullable=True),
    sa.Column('message', sa.Text(), nullable=False),
    sa.Column('page', sa.String(length=200), nullable=False),
    sa.Column('status', sa.String(length=10), nullable=False),
    sa.Column('reply', sa.Text(), nullable=False),
    sa.Column('replied_at', app.db.types.UTCDateTime(timezone=True), nullable=True),
    sa.Column('created_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('feedback', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_feedback_created_at'), ['created_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_feedback_status'), ['status'], unique=False)
        batch_op.create_index(batch_op.f('ix_feedback_user_id'), ['user_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('feedback', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_feedback_user_id'))
        batch_op.drop_index(batch_op.f('ix_feedback_status'))
        batch_op.drop_index(batch_op.f('ix_feedback_created_at'))

    op.drop_table('feedback')
