from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

import app.db.types

revision: str = '0025'
down_revision: Union[str, Sequence[str], None] = '0024'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_REASON = "Маош надоданд."
COUNTERS = ("reviews_count", "paid_on_time", "paid_late", "not_paid")


def upgrade() -> None:
    with op.batch_alter_table('employer_reviews') as batch:
        batch.add_column(sa.Column('salary_paid', sa.String(length=10), nullable=False, server_default=""))
        batch.add_column(sa.Column('job_id', sa.Integer(), nullable=True))
        batch.create_foreign_key('fk_employer_reviews_job_id', 'jobs', ['job_id'], ['id'], ondelete='SET NULL')
    with op.batch_alter_table('blacklist_reports') as batch:
        batch.add_column(sa.Column('review_id', sa.Integer(), nullable=True))
        batch.create_foreign_key('fk_blacklist_reports_review_id', 'employer_reviews', ['review_id'], ['id'], ondelete='CASCADE')
    with op.batch_alter_table('employers') as batch:
        for name in COUNTERS:
            batch.add_column(sa.Column(name, sa.Integer(), nullable=False, server_default="0"))
        batch.add_column(sa.Column('rating', sa.Float(), nullable=True))

    bind = op.get_bind()
    reviews = sa.table("employer_reviews", sa.column("id", sa.Integer), sa.column("employer_id", sa.Integer),
                       sa.column("author_id", sa.Integer), sa.column("rating", sa.Integer), sa.column("text", sa.Text),
                       sa.column("salary_not_paid", sa.Boolean), sa.column("salary_paid", sa.String),
                       sa.column("created_at", app.db.types.UTCDateTime(timezone=True)))
    reports = sa.table("blacklist_reports", sa.column("id", sa.Integer), sa.column("employer_id", sa.Integer),
                       sa.column("author_id", sa.Integer), sa.column("review_id", sa.Integer),
                       sa.column("reason", sa.Text), sa.column("created_at", app.db.types.UTCDateTime(timezone=True)))
    employers = sa.table("employers", sa.column("id", sa.Integer), sa.column("reports_count", sa.Integer),
                         sa.column("rating", sa.Float), *[sa.column(name, sa.Integer) for name in COUNTERS])

    bind.execute(reviews.update().where(reviews.c.salary_not_paid.is_(True)).values(salary_paid="not_paid"))
    unpaid = bind.execute(sa.select(reviews).where(reviews.c.salary_paid == "not_paid")).mappings().all()
    for review in unpaid:
        taken = bind.execute(sa.select(reports.c.id).where(reports.c.employer_id == review["employer_id"],
                                                           reports.c.author_id == review["author_id"])).first()
        if taken is None:
            text = (review["text"] or "").strip()
            bind.execute(reports.insert().values(
                employer_id=review["employer_id"], author_id=review["author_id"], review_id=review["id"],
                reason=text if len(text) >= 10 else DEFAULT_REASON, created_at=review["created_at"]))

    stats = bind.execute(sa.select(
        reviews.c.employer_id, sa.func.count().label("total"), sa.func.avg(reviews.c.rating).label("rating"),
        *[sa.func.sum(sa.case((reviews.c.salary_paid == kind, 1), else_=0)).label(kind)
          for kind in ("on_time", "late", "not_paid")],
    ).group_by(reviews.c.employer_id)).mappings().all()
    for row in stats:
        bind.execute(employers.update().where(employers.c.id == row["employer_id"]).values(
            reviews_count=row["total"], rating=round(float(row["rating"]), 2), paid_on_time=row["on_time"] or 0,
            paid_late=row["late"] or 0, not_paid=row["not_paid"] or 0))
    counts = bind.execute(sa.select(reports.c.employer_id, sa.func.count().label("total"))
                          .group_by(reports.c.employer_id)).all()
    for employer_id, total in counts:
        bind.execute(employers.update().where(employers.c.id == employer_id).values(reports_count=total))


def downgrade() -> None:
    op.execute("DELETE FROM blacklist_reports WHERE review_id IS NOT NULL")
    with op.batch_alter_table('employers') as batch:
        batch.drop_column('rating')
        for name in reversed(COUNTERS):
            batch.drop_column(name)
    with op.batch_alter_table('blacklist_reports') as batch:
        batch.drop_constraint('fk_blacklist_reports_review_id', type_='foreignkey')
        batch.drop_column('review_id')
    with op.batch_alter_table('employer_reviews') as batch:
        batch.drop_constraint('fk_employer_reviews_job_id', type_='foreignkey')
        batch.drop_column('job_id')
        batch.drop_column('salary_paid')
