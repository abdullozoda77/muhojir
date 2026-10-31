import sys
import argparse
import asyncio
import getpass

from sqlalchemy import select

from app.core.security import hash_password, password_problems
from app.db.session import SessionLocal
from app.models import Job, Place, User
from app.tasks import (
    run_check_flight_watches, run_import_housing, run_import_jobs, run_import_places, run_send_reminders, run_update_rates,
)


async def create_superuser(email, password):
    async with SessionLocal() as db:
        user = await db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(email=email)
            db.add(user)
        user.password_hash = await hash_password(password)
        user.role, user.is_superuser, user.email_verified, user.is_active = "admin", True, True, True
        await db.commit()
    print(f"Admin {email} is ready: log in at /admin/")


async def has_jobs():
    async with SessionLocal() as db:
        return await db.scalar(select(Job.id).limit(1)) is not None


async def has_places():
    async with SessionLocal() as db:
        return await db.scalar(select(Place.id).where(Place.source == "osm").limit(1)) is not None


def main():
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)
    su = commands.add_parser("createsuperuser")
    su.add_argument("--email")
    jobs = commands.add_parser("import-jobs")
    jobs.add_argument("--limit", type=int, default=20)
    commands.add_parser("send-reminders")
    commands.add_parser("has-jobs")
    commands.add_parser("has-places")
    places = commands.add_parser("import-places")
    places.add_argument("--region", action="append")
    places.add_argument("--category", action="append")
    commands.add_parser("check-flights")
    commands.add_parser("update-rates")
    housing = commands.add_parser("import-housing")
    housing.add_argument("--channel", action="append")
    housing.add_argument("--pages", type=int, default=4)
    housing.add_argument("--no-photos", action="store_true")
    args = parser.parse_args()

    if args.command == "createsuperuser":
        email = (args.email or input("Email: ")).strip().lower()
        while True:
            password = getpass.getpass("Password: ")
            if password != getpass.getpass("Password (again): "):
                print("The passwords do not match.")
                continue
            problems = asyncio.run(password_problems(password, email))
            if problems:
                print(" ".join(problems))
                continue
            break
        asyncio.run(create_superuser(email, password))
    elif args.command == "import-jobs":
        asyncio.run(run_import_jobs(limit=args.limit))
    elif args.command == "send-reminders":
        asyncio.run(run_send_reminders())
    elif args.command == "import-places":
        asyncio.run(run_import_places(regions=args.region, categories=args.category))
    elif args.command == "check-flights":
        asyncio.run(run_check_flight_watches())
    elif args.command == "update-rates":
        asyncio.run(run_update_rates())
    elif args.command == "import-housing":
        asyncio.run(run_import_housing(channels=args.channel, pages=args.pages, with_photos=not args.no_photos))
    elif args.command == "has-places":
        sys.exit(0 if asyncio.run(has_places()) else 1)
    elif args.command == "has-jobs":
        sys.exit(0 if asyncio.run(has_jobs()) else 1)


if __name__ == "__main__":
    main()
