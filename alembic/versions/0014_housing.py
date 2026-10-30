from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

import app.db.types

revision: str = '0014'
down_revision: Union[str, Sequence[str], None] = '0013'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('housing',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('owner_id', sa.Integer(), nullable=False),
    sa.Column('kind', sa.String(length=10), nullable=False),
    sa.Column('title', sa.String(length=120), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('city', sa.String(length=100), nullable=False),
    sa.Column('address', sa.String(length=255), nullable=False),
    sa.Column('metro', sa.String(length=100), nullable=False),
    sa.Column('price', sa.Integer(), nullable=False),
    sa.Column('period', sa.String(length=10), nullable=False),
    sa.Column('rooms', sa.Integer(), nullable=True),
    sa.Column('places', sa.Integer(), nullable=True),
    sa.Column('for_whom', sa.String(length=10), nullable=False),
    sa.Column('registration', sa.Boolean(), nullable=False),
    sa.Column('utilities_included', sa.Boolean(), nullable=False),
    sa.Column('no_deposit', sa.Boolean(), nullable=False),
    sa.Column('phone', sa.String(length=16), nullable=False),
    sa.Column('whatsapp', sa.String(length=16), nullable=False),
    sa.Column('telegram', sa.String(length=40), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('status', sa.String(length=10), nullable=False),
    sa.Column('reject_reason', sa.Text(), nullable=False),
    sa.Column('created_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
    sa.Column('updated_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('housing', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_housing_created_at'), ['created_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_housing_kind'), ['kind'], unique=False)
        batch_op.create_index(batch_op.f('ix_housing_owner_id'), ['owner_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_housing_price'), ['price'], unique=False)
        batch_op.create_index(batch_op.f('ix_housing_status'), ['status'], unique=False)
        batch_op.create_index('ix_housing_status_city', ['status', 'city'], unique=False)

    op.create_table('housing_photos',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('housing_id', sa.Integer(), nullable=False),
    sa.Column('file', sa.String(length=100), nullable=False),
    sa.Column('created_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['housing_id'], ['housing.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('housing_photos', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_housing_photos_housing_id'), ['housing_id'], unique=False)



def downgrade() -> None:
    with op.batch_alter_table('housing_photos', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_housing_photos_housing_id'))

    op.drop_table('housing_photos')
    with op.batch_alter_table('housing', schema=None) as batch_op:
        batch_op.drop_index('ix_housing_status_city')
        batch_op.drop_index(batch_op.f('ix_housing_status'))
        batch_op.drop_index(batch_op.f('ix_housing_price'))
        batch_op.drop_index(batch_op.f('ix_housing_owner_id'))
        batch_op.drop_index(batch_op.f('ix_housing_kind'))
        batch_op.drop_index(batch_op.f('ix_housing_created_at'))

    op.drop_table('housing')
