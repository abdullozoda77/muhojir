from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

import app.db.types

revision: str = '0006'
down_revision: Union[str, Sequence[str], None] = '0005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('shops',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('owner_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('category', sa.String(length=20), nullable=False),
    sa.Column('origin', sa.String(length=10), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('city', sa.String(length=100), nullable=False),
    sa.Column('address', sa.String(length=255), nullable=False),
    sa.Column('lat', sa.Float(), nullable=True),
    sa.Column('lon', sa.Float(), nullable=True),
    sa.Column('phone', sa.String(length=16), nullable=False),
    sa.Column('whatsapp', sa.String(length=16), nullable=False),
    sa.Column('telegram', sa.String(length=40), nullable=False),
    sa.Column('opening_hours', sa.String(length=120), nullable=False),
    sa.Column('delivery', sa.Boolean(), nullable=False),
    sa.Column('logo', sa.String(length=100), nullable=False),
    sa.Column('status', sa.String(length=10), nullable=False),
    sa.Column('reject_reason', sa.Text(), nullable=False),
    sa.Column('created_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
    sa.Column('updated_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_shops_category', 'shops', ['category'])
    op.create_index('ix_shops_created_at', 'shops', ['created_at'])
    op.create_index('ix_shops_owner_id', 'shops', ['owner_id'])
    op.create_index('ix_shops_status', 'shops', ['status'])
    op.create_index('ix_shops_status_city', 'shops', ['status', 'city'])
    op.create_table('products',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('shop_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('price', sa.Integer(), nullable=False),
    sa.Column('unit', sa.String(length=10), nullable=False),
    sa.Column('photo', sa.String(length=100), nullable=False),
    sa.Column('in_stock', sa.Boolean(), nullable=False),
    sa.Column('created_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
    sa.Column('updated_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_products_created_at', 'products', ['created_at'])
    op.create_index('ix_products_shop_id', 'products', ['shop_id'])
    op.create_table('shop_reviews',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('shop_id', sa.Integer(), nullable=False),
    sa.Column('author_id', sa.Integer(), nullable=False),
    sa.Column('rating', sa.Integer(), nullable=False),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('created_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('shop_id', 'author_id', name='one_review_per_shop')
    )
    op.create_index('ix_shop_reviews_shop_id', 'shop_reviews', ['shop_id'])


def downgrade() -> None:
    op.drop_index('ix_shop_reviews_shop_id', table_name='shop_reviews')
    op.drop_table('shop_reviews')
    op.drop_index('ix_products_shop_id', table_name='products')
    op.drop_index('ix_products_created_at', table_name='products')
    op.drop_table('products')
    op.drop_index('ix_shops_status_city', table_name='shops')
    op.drop_index('ix_shops_status', table_name='shops')
    op.drop_index('ix_shops_owner_id', table_name='shops')
    op.drop_index('ix_shops_created_at', table_name='shops')
    op.drop_index('ix_shops_category', table_name='shops')
    op.drop_table('shops')
