"""Celery: emails in the background and the daily jobs on schedule (Celery Beat): vacancies, reminders,
ticket price alerts, and every week the places from OpenStreetMap.
Run on the server:  celery -A app.worker worker  and  celery -A app.worker beat
Without CELERY_BROKER_URL nothing has to run: emails are sent at once and the daily jobs are started from cron
or by hand (python -m app.cli import-jobs / send-reminders)."""
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
        # Real vacancies from «Работа России» (and alerts about new ones), then the document reminders.
        "daily-import-jobs": {"task": "app.worker.import_jobs", "schedule": crontab(hour=6, minute=0)},
        "daily-reminders": {"task": "app.worker.send_reminders", "schedule": crontab(hour=6, minute=30)},
        # Ticket price alerts, and once a week fresh places from OpenStreetMap (Sunday night).
        "daily-flight-watches": {"task": "app.worker.check_flight_watches", "schedule": crontab(hour=7, minute=0)},
        "weekly-import-places": {"task": "app.worker.import_places", "schedule": crontab(hour=3, minute=0, day_of_week=0)},
    },
)
app = celery  # `celery -A app.worker` finds it


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
