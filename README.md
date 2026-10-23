# Muhojir — FastAPI

A platform for Tajik migrants in Russia: documents and their deadlines, 2026 patent prices for every region,
step-by-step guides, real vacancies from «Работа России», exam practice (100 questions), law news, live
notifications, an AI assistant that answers questions and opens pages of the site, **air tickets between
Tajikistan and Russia** (both ways: prices from Aviasales, a calendar of prices, alerts when a ticket gets cheaper)
and a **map of useful places** (migration centers, notaries, the embassy, mosques, Tajik cafes, halal shops... from
OpenStreetMap, with ratings, reviews, "near me" and suggestions of new places).

Everything is async: FastAPI, the database (SQLAlchemy asyncio), email (aiosmtplib), outside APIs (httpx), files
(anyio) and the AI models.

This is the FastAPI version of the Django project [muhojir.tj](https://github.com/abdullozoda77/muhojir.tj):
the same React site, design and API addresses, with a new backend.

| Part | Django version | This version |
|---|---|---|
| API | Django REST Framework | FastAPI + Pydantic |
| Database | Django ORM, migrations | SQLAlchemy 2 (async), Alembic |
| Login | SimpleJWT | PyJWT: access 60 min, refresh 30 days, rotated and revoked on logout |
| Admin panel | Django admin | SQLAdmin at `/admin/` (roles: editor, admin) |
| Live notifications | Channels | FastAPI WebSocket `/ws/notifications/` (+ Redis between processes) |
| Background | Celery | Celery (emails, 06:00 vacancies, 06:30 reminders) |
| API docs | drf-yasg | `/swagger/` and `/redoc/` |

## Run on a laptop

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/alembic upgrade head              # tables + the site's content (guides, prices, news, questions)
.venv/bin/python -m app.cli createsuperuser # an admin for /admin/
.venv/bin/python -m app.cli import-jobs     # real vacancies (a few minutes)
.venv/bin/python -m app.cli import-places   # real places for the map (about 20 minutes)
cd frontend && npm install && npm run dev   # site http://localhost:5175, API http://localhost:8002
```

Without a `.env` everything works: SQLite, the codes are printed in the API console instead of being emailed,
background tasks run at once. To send real emails or turn on the AI assistant, copy `.env.example` to `.env`
and fill it in.

## Tests

```bash
.venv/bin/python -m pytest
```

Each run makes its own database with the real migrations and checks sign-up, login, tokens, documents with
photos, payments, roles, jobs and alerts, reminders and the AI assistant's tools.

## Structure

```
app/
  main.py            the FastAPI app: routers, errors, /media, the admin panel
  core/              settings, security (passwords, JWT), who is asking, pages, request limits, files
  models/            SQLAlchemy tables: accounts, documents, jobs, help
  schemas/           request and response shapes
  routers/           /api/auth, /api/documents, /api/jobs, /api/flights, /api/places, /api/help, /api/assistant,
                     /ws/notifications
  services/          emails, notifications, live push, reminders, vacancy import, job alerts, ticket prices
                     (Travelpayouts), places import (OpenStreetMap / Overpass)
  assistant/         the AI assistant: what it knows, its tools, Gemini and Claude
  admin/             SQLAdmin views, roles and the start page with the numbers
  worker.py          Celery tasks and schedule
  cli.py             createsuperuser, import-jobs, send-reminders
  seed/              the site's content (from the Django version), loaded by migration 0002
alembic/             migrations
frontend/            the React site (Vite + Tailwind)
deploy/              server setup: nginx, systemd, setup.sh / update.sh
tests/               pytest
```

## Roles

- **migrant**: their documents, payments, saved jobs, alerts, reviews of companies.
- **editor**: also the site's content (news, guides, exam questions, help sites, centers, patent prices), in the
  admin panel and through the API.
- **admin**: everything, including users, roles and the blacklist of companies.

## Server

Site: **https://king.tj** (also http://31.25.238.204:8050). nginx on port 8050 and on 80/443 for king.tj,
uvicorn on 127.0.0.1:8051, Redis database 15. setup.sh takes king.tj from the old Django Muhojir (it stays on
port 8040 only) and uses the certificate already issued for king.tj. First install (as root):

```bash
sudo -u romin git clone https://github.com/abdullozoda77/muhojir.git /home/romin/muhojir-api
bash /home/romin/muhojir-api/deploy/setup.sh
cd /home/romin/muhojir-api && sudo -u romin .venv/bin/python -m app.cli createsuperuser
```

Updates: `bash /home/romin/muhojir-api/deploy/update.sh`.
