import asyncio

from celery import Celery
from celery.schedules import crontab

from app.core.config import TIME_ZONE, settings

celery = Celery("muhojir", broker=settings.celery_broker_url or "memory://")
celery.conf.update(
    timezone=TIME_ZONE,
    task_ignore_results=True,
    task_always_eager=not settings.celery_broker_url,
    beat_schedule={
        "daily-import-jobs": {"task": "app.worker.import_jobs", "schedule": crontab(hour=6, minute=0)},
        "import-housing": {"task": "app.worker.import_housing", "schedule": crontab(hour="7,13,19", minute=20)},
        "daily-reminders": {"task": "app.worker.send_reminders", "schedule": crontab(hour=6, minute=30)},
        "daily-flight-watches": {"task": "app.worker.check_flight_watches", "schedule": crontab(hour=7, minute=0)},
        "update-rates": {"task": "app.worker.update_rates", "schedule": crontab(hour="8,11,15", minute=10)},
        "weekly-import-places": {"task": "app.worker.import_places", "schedule": crontab(hour=3, minute=0, day_of_week=0)},
    },
)
app = celery


@celery.task(autoretry_for=(OSError,), retry_backoff=30, max_retries=3)
def send_email(subject, body, to):
    from app.services.emails import send_plain

    asyncio.run(send_plain(subject, body, to))


@celery.task
def import_jobs():
    from app.tasks import run_import_jobs

    asyncio.run(run_import_jobs())


@celery.task
def send_reminders():
    from app.tasks import run_send_reminders

    asyncio.run(run_send_reminders())


@celery.task
def check_flight_watches():
    from app.tasks import run_check_flight_watches

    asyncio.run(run_check_flight_watches())


@celery.task
def import_places():
    from app.tasks import run_import_places

    asyncio.run(run_import_places())


@celery.task(autoretry_for=(OSError,), retry_backoff=60, max_retries=3)
def update_rates():
    from app.tasks import run_update_rates

    asyncio.run(run_update_rates())


@celery.task
def import_housing():
    from app.tasks import run_import_housing

    asyncio.run(run_import_housing())
