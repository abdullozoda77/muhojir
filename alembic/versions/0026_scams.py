from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

import app.db.types

revision: str = '0026'
down_revision: Union[str, Sequence[str], None] = '0025'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'scam_reports',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('kind', sa.String(length=10), nullable=False),
        sa.Column('value', sa.String(length=200), nullable=False),
        sa.Column('key', sa.String(length=200), nullable=False),
        sa.Column('scheme', sa.String(length=10), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('city', sa.String(length=100), nullable=False),
        sa.Column('lost_amount', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=10), nullable=False),
        sa.Column('note', sa.Text(), nullable=False),
        sa.Column('created_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
        sa.Column('reviewed_at', app.db.types.UTCDateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_scam_reports_user_id', 'scam_reports', ['user_id'])
    op.create_index('ix_scam_reports_key', 'scam_reports', ['key'])
    op.create_index('ix_scam_reports_status', 'scam_reports', ['status'])
    op.create_index('ix_scam_reports_created_at', 'scam_reports', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_scam_reports_created_at', table_name='scam_reports')
    op.drop_index('ix_scam_reports_status', table_name='scam_reports')
    op.drop_index('ix_scam_reports_key', table_name='scam_reports')
    op.drop_index('ix_scam_reports_user_id', table_name='scam_reports')
    op.drop_table('scam_reports')
