"""Workers put companies on the blacklist themselves: blacklist_reports and employers.reports_count.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-26 12:50:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

import app.db.types

revision: str = '0004'
down_revision: Union[str, Sequence[str], None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('employers') as batch:
        batch.add_column(sa.Column('reports_count', sa.Integer(), server_default='0', nullable=False))
    op.create_table('blacklist_reports',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('employer_id', sa.Integer(), nullable=False),
    sa.Column('job_id', sa.Integer(), nullable=True),
    sa.Column('author_id', sa.Integer(), nullable=False),
    sa.Column('reason', sa.Text(), nullable=False),
    sa.Column('created_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['employer_id'], ['employers.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('employer_id', 'author_id', name='one_report_per_employer')
    )
    op.create_index('ix_blacklist_reports_employer_id', 'blacklist_reports', ['employer_id'])
    op.create_index('ix_blacklist_reports_created_at', 'blacklist_reports', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_blacklist_reports_created_at', table_name='blacklist_reports')
    op.drop_index('ix_blacklist_reports_employer_id', table_name='blacklist_reports')
    op.drop_table('blacklist_reports')
    with op.batch_alter_table('employers') as batch:
        batch.drop_column('reports_count')
