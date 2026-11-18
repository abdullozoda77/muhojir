from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

import app.db.types

revision: str = '0028'
down_revision: Union[str, Sequence[str], None] = '0027'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'parcels',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('kind', sa.String(length=10), nullable=False),
        sa.Column('from_city', sa.String(length=100), nullable=False),
        sa.Column('to_city', sa.String(length=100), nullable=False),
        sa.Column('travel_date', sa.Date(), nullable=False),
        sa.Column('weight_kg', sa.Integer(), nullable=True),
        sa.Column('price_per_kg', sa.Integer(), nullable=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('phone', sa.String(length=16), nullable=False),
        sa.Column('whatsapp', sa.String(length=16), nullable=False),
        sa.Column('telegram', sa.String(length=40), nullable=False),
        sa.Column('is_hidden', sa.Boolean(), nullable=False),
        sa.Column('created_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    for column in ('user_id', 'kind', 'from_city', 'to_city', 'travel_date', 'is_hidden', 'created_at'):
        op.create_index(f'ix_parcels_{column}', 'parcels', [column])


def downgrade() -> None:
    op.drop_table('parcels')
