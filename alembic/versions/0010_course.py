from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

import app.db.types

revision: str = '0010'
down_revision: Union[str, Sequence[str], None] = '0009'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('exam_attempts',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('level', sa.Integer(), nullable=False),
    sa.Column('full_name', sa.String(length=150), nullable=False),
    sa.Column('questions', sa.JSON(), nullable=False),
    sa.Column('answers', sa.JSON(), nullable=True),
    sa.Column('score', sa.Integer(), nullable=True),
    sa.Column('passed', sa.Boolean(), nullable=True),
    sa.Column('started_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
    sa.Column('ends_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
    sa.Column('finished_at', app.db.types.UTCDateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('exam_attempts', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_exam_attempts_user_id'), ['user_id'], unique=False)

    op.create_table('lesson_progress',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('level', sa.Integer(), nullable=False),
    sa.Column('number', sa.Integer(), nullable=False),
    sa.Column('score', sa.Integer(), nullable=False),
    sa.Column('completed_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'level', 'number', name='one_progress_per_lesson')
    )
    with op.batch_alter_table('lesson_progress', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_lesson_progress_user_id'), ['user_id'], unique=False)

    op.create_table('certificates',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('code', sa.String(length=16), nullable=False),
    sa.Column('number', sa.String(length=30), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('attempt_id', sa.Integer(), nullable=True),
    sa.Column('level', sa.Integer(), nullable=False),
    sa.Column('full_name', sa.String(length=150), nullable=False),
    sa.Column('percent', sa.Integer(), nullable=False),
    sa.Column('is_revoked', sa.Boolean(), nullable=False),
    sa.Column('issued_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['attempt_id'], ['exam_attempts.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('number'),
    sa.UniqueConstraint('user_id', 'level', name='one_certificate_per_level')
    )
    with op.batch_alter_table('certificates', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_certificates_code'), ['code'], unique=True)
        batch_op.create_index(batch_op.f('ix_certificates_user_id'), ['user_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('certificates', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_certificates_user_id'))
        batch_op.drop_index(batch_op.f('ix_certificates_code'))

    op.drop_table('certificates')
    with op.batch_alter_table('lesson_progress', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_lesson_progress_user_id'))

    op.drop_table('lesson_progress')
    with op.batch_alter_table('exam_attempts', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_exam_attempts_user_id'))

    op.drop_table('exam_attempts')
