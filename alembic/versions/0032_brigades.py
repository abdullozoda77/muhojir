from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

import app.db.types

revision: str = '0032'
down_revision: Union[str, Sequence[str], None] = '0031'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'brigades',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('trade', sa.String(length=20), nullable=False),
        sa.Column('city', sa.String(length=100), nullable=False),
        sa.Column('size', sa.Integer(), nullable=False),
        sa.Column('experience_years', sa.Integer(), nullable=True),
        sa.Column('price_note', sa.String(length=120), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('phone', sa.String(length=16), nullable=False),
        sa.Column('whatsapp', sa.String(length=16), nullable=False),
        sa.Column('telegram', sa.String(length=40), nullable=False),
        sa.Column('is_free', sa.Boolean(), nullable=False),
        sa.Column('is_hidden', sa.Boolean(), nullable=False),
        sa.Column('created_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    for column in ('user_id', 'trade', 'city', 'is_free', 'is_hidden', 'created_at'):
        op.create_index(f'ix_brigades_{column}', 'brigades', [column])

    op.create_table(
        'brigade_members',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('brigade_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('skill', sa.String(length=80), nullable=False),
        sa.Column('status', sa.String(length=10), nullable=False),
        sa.Column('created_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['brigade_id'], ['brigades.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('brigade_id', 'user_id', name='uq_brigade_member'),
    )
    for column in ('brigade_id', 'user_id', 'status'):
        op.create_index(f'ix_brigade_members_{column}', 'brigade_members', [column])

    op.create_table(
        'brigade_orders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('brigade_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('city', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('workers', sa.Integer(), nullable=True),
        sa.Column('budget', sa.Integer(), nullable=True),
        sa.Column('phone', sa.String(length=16), nullable=False),
        sa.Column('status', sa.String(length=10), nullable=False),
        sa.Column('created_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['brigade_id'], ['brigades.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    for column in ('brigade_id', 'user_id', 'status', 'created_at'):
        op.create_index(f'ix_brigade_orders_{column}', 'brigade_orders', [column])

    op.create_table(
        'brigade_reviews',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('brigade_id', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('rating', sa.SmallInteger(), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('created_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['brigade_id'], ['brigades.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['order_id'], ['brigade_orders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('order_id'),
    )
    for column in ('brigade_id', 'user_id', 'created_at'):
        op.create_index(f'ix_brigade_reviews_{column}', 'brigade_reviews', [column])


def downgrade() -> None:
    op.drop_table('brigade_reviews')
    op.drop_table('brigade_orders')
    op.drop_table('brigade_members')
    op.drop_table('brigades')
