from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

import app.db.types

revision: str = '0009'
down_revision: Union[str, Sequence[str], None] = '0008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('legal_questions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_legal_questions_user_id'))
    op.drop_table('legal_questions')


def downgrade() -> None:
    op.create_table('legal_questions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('document_type_id', sa.Integer(), nullable=True),
    sa.Column('question', sa.Text(), nullable=False),
    sa.Column('status', sa.String(length=10), nullable=False),
    sa.Column('answer', sa.Text(), nullable=False),
    sa.Column('answered_by_id', sa.Integer(), nullable=True),
    sa.Column('answered_at', app.db.types.UTCDateTime(timezone=True), nullable=True),
    sa.Column('created_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['answered_by_id'], ['users.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['document_type_id'], ['document_types.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('legal_questions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_legal_questions_user_id'), ['user_id'], unique=False)
