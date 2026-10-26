from app.db.session import SessionLocal
from app.db.types import utcnow
from app.services.alerts import notify_alerts
from app.services.flights import check_watches
from app.services.places import import_places
from app.services.reminders import send_due_reminders
from app.services.trudvsem import import_jobs


async def run_import_jobs(log=print, **options):
    started = utcnow()
    async with SessionLocal() as db:
        counts = await import_jobs(db, log=log, **options)
        told = await notify_alerts(db, started)
    log(f"Jobs: {counts}; alerts sent to {told} users")
    return counts


async def run_send_reminders(log=print):
    async with SessionLocal() as db:
        sent = await send_due_reminders(db)
    log(f"Reminders sent: {sent}")
    return sent


async def run_import_places(log=print, **options):
    async with SessionLocal() as db:
        counts = await import_places(db, log=log, **options)
    log(f"Places: {counts}")
    return counts


async def run_check_flight_watches(log=print):
    async with SessionLocal() as db:
        told = await check_watches(db)
    log(f"Cheaper tickets: told {told} users")
    return told
