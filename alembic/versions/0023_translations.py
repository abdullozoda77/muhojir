from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

import app.db.types

revision: str = '0023'
down_revision: Union[str, Sequence[str], None] = '0022'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'translations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('kind', sa.String(length=10), nullable=False),
        sa.Column('source_lang', sa.String(length=5), nullable=False),
        sa.Column('target_lang', sa.String(length=5), nullable=False),
        sa.Column('doc_type', sa.String(length=20), nullable=False),
        sa.Column('file', sa.String(length=100), nullable=False),
        sa.Column('file_name', sa.String(length=200), nullable=False),
        sa.Column('source_text', sa.Text(), nullable=False),
        sa.Column('result_text', sa.Text(), nullable=False),
        sa.Column('notarized', sa.Boolean(), nullable=False),
        sa.Column('phone', sa.String(length=30), nullable=False),
        sa.Column('note', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=10), nullable=False),
        sa.Column('price', sa.Integer(), nullable=True),
        sa.Column('editor_note', sa.Text(), nullable=False),
        sa.Column('result_file', sa.String(length=100), nullable=False),
        sa.Column('created_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
        sa.Column('updated_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_translations_user_id', 'translations', ['user_id'])
    op.create_index('ix_translations_kind', 'translations', ['kind'])
    op.create_index('ix_translations_status', 'translations', ['status'])
    op.create_index('ix_translations_created_at', 'translations', ['created_at'])


def downgrade() -> None:
    op.drop_table('translations')
