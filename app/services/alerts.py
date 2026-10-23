"""After an import: one notification per alert with the new jobs that match it."""
from sqlalchemy import func, select

from app.models import Job, JobAlert, User
from app.routers.jobs import filter_jobs, open_jobs
from app.services.notify import notify


def alert_filters(alert):
    """The alert as query parameters of the jobs list (?search=...&city=...)."""
    data = {"search": alert.search, "city": alert.city, "industry": alert.industry,
            "min_salary": str(alert.min_salary) if alert.min_salary else "",
            "housing_provided": "true" if alert.housing_provided else ""}
    return {key: value for key, value in data.items() if value}


async def notify_alerts(db, since):
    """Tells every alert about the jobs that appeared since this moment. Returns how many users were told."""
    new_jobs = open_jobs(select(Job).where(Job.created_at >= since))
    if not await db.scalar(select(func.count()).select_from(new_jobs.subquery())):
        return 0
    told = 0
    alerts = (await db.scalars(
        select(JobAlert).join(User, User.id == JobAlert.user_id).where(JobAlert.is_active.is_(True), User.is_active.is_(True))
    )).unique().all()
    for alert in alerts:
        matching = filter_jobs(new_jobs, alert_filters(alert))
        count = await db.scalar(select(func.count()).select_from(matching.subquery()))
        if not count:
            continue
        titles = ", ".join((await db.scalars(matching.with_only_columns(Job.title).order_by(Job.created_at.desc()).limit(3))).all())
        user = await db.get(User, alert.user_id)
        await notify(db, user, "Ҷойи кори нав",
                     f"{count} ҷойи нави кор аз рӯи ҷустуҷӯи шумо: {titles}{'…' if count > 3 else ''}", kind="job")
        told += 1
    return told
