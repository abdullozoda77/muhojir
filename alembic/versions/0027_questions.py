from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

import app.db.types

revision: str = '0027'
down_revision: Union[str, Sequence[str], None] = '0026'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'questions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('topic', sa.String(length=10), nullable=False),
        sa.Column('title', sa.String(length=150), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('city', sa.String(length=100), nullable=False),
        sa.Column('answers_count', sa.Integer(), nullable=False),
        sa.Column('best_answer_id', sa.Integer(), nullable=True),
        sa.Column('is_hidden', sa.Boolean(), nullable=False),
        sa.Column('created_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
        sa.Column('active_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_questions_user_id', 'questions', ['user_id'])
    op.create_index('ix_questions_topic', 'questions', ['topic'])
    op.create_index('ix_questions_is_hidden', 'questions', ['is_hidden'])
    op.create_index('ix_questions_created_at', 'questions', ['created_at'])
    op.create_index('ix_questions_active_at', 'questions', ['active_at'])
    op.create_table(
        'answers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('question_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('likes', sa.Integer(), nullable=False),
        sa.Column('is_hidden', sa.Boolean(), nullable=False),
        sa.Column('created_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_answers_question_id', 'answers', ['question_id'])
    op.create_index('ix_answers_user_id', 'answers', ['user_id'])
    op.create_index('ix_answers_created_at', 'answers', ['created_at'])
    op.create_table(
        'answer_likes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('answer_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['answer_id'], ['answers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('answer_id', 'user_id', name='uq_answer_like'),
    )
    op.create_index('ix_answer_likes_answer_id', 'answer_likes', ['answer_id'])
    op.create_index('ix_answer_likes_user_id', 'answer_likes', ['user_id'])


def downgrade() -> None:
    op.drop_table('answer_likes')
    op.drop_table('answers')
    op.drop_table('questions')
