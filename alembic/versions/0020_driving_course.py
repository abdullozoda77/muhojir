from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

import app.db.types

revision: str = '0020'
down_revision: Union[str, Sequence[str], None] = '0019'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def course_column():
    return sa.Column('course', sa.String(length=10), nullable=False, server_default='ru')


def places_table(name, unique):
    return op.create_table(
        name,
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        *([course_column()] if unique == 'course' else []),
        sa.Column('level', sa.Integer(), nullable=False),
        sa.Column('number', sa.Integer(), nullable=False),
        sa.Column('index', sa.Integer(), nullable=False),
        sa.Column('right', sa.Integer(), nullable=False),
        sa.Column('updated_at', app.db.types.UTCDateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'course', name='one_place_per_course') if unique == 'course'
        else sa.UniqueConstraint('user_id'),
    )


def move_places(unique):
    places_table('course_places_new', unique)
    names = 'id, user_id, level, number, "index", "right", updated_at'
    op.execute(f'INSERT INTO course_places_new ({names}) SELECT {names} FROM course_places')
    op.drop_table('course_places')
    op.rename_table('course_places_new', 'course_places')
    if op.get_bind().dialect.name == 'postgresql':
        op.execute("SELECT setval(pg_get_serial_sequence('course_places', 'id'), "
                   "COALESCE(MAX(id), 0) + 1, false) FROM course_places")


def upgrade() -> None:
    with op.batch_alter_table('lesson_progress', schema=None) as batch_op:
        batch_op.add_column(course_column())
        batch_op.drop_constraint('one_progress_per_lesson', type_='unique')
        batch_op.create_unique_constraint('one_progress_per_lesson', ['user_id', 'course', 'level', 'number'])

    with op.batch_alter_table('exam_attempts', schema=None) as batch_op:
        batch_op.add_column(course_column())

    with op.batch_alter_table('certificates', schema=None) as batch_op:
        batch_op.add_column(course_column())
        batch_op.drop_constraint('one_certificate_per_level', type_='unique')
        batch_op.create_unique_constraint('one_certificate_per_level', ['user_id', 'course', 'level'])

    move_places('course')


def downgrade() -> None:
    op.execute("DELETE FROM course_places WHERE course <> 'ru'")
    op.execute("DELETE FROM certificates WHERE course <> 'ru'")
    op.execute("DELETE FROM exam_attempts WHERE course <> 'ru'")
    op.execute("DELETE FROM lesson_progress WHERE course <> 'ru'")
    move_places('user')

    with op.batch_alter_table('certificates', schema=None) as batch_op:
        batch_op.drop_constraint('one_certificate_per_level', type_='unique')
        batch_op.create_unique_constraint('one_certificate_per_level', ['user_id', 'level'])
        batch_op.drop_column('course')

    with op.batch_alter_table('exam_attempts', schema=None) as batch_op:
        batch_op.drop_column('course')

    with op.batch_alter_table('lesson_progress', schema=None) as batch_op:
        batch_op.drop_constraint('one_progress_per_lesson', type_='unique')
        batch_op.create_unique_constraint('one_progress_per_lesson', ['user_id', 'level', 'number'])
        batch_op.drop_column('course')
