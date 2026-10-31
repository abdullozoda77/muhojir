# Muhojir — documentation of every file

**Language:** English · [Тоҷикӣ](DOCUMENTATION.tg.md) · [Русский](DOCUMENTATION.ru.md)

Muhojir is a platform for Tajik migrants in Russia: documents and their deadlines, patent prices for every
region, step-by-step guides, real vacancies from «Работа России» with a workers' blacklist of employers, exam
practice, law news, live notifications, an AI assistant, air tickets between Tajikistan and Russia and a map of
useful places.

The code has no comments: everything that explains it is in this file. Each section below is one folder; each
file has **what it is for** and a table of its functions, classes and components with what they do.

## How the project is built

| Part | Technology |
|---|---|
| API | FastAPI + Pydantic, everything async |
| Database | SQLAlchemy 2 (asyncio), Alembic migrations; SQLite (or PostgreSQL via `DATABASE_URL`) |
| Login | email + password, 6-digit email codes, JWT (access 60 min, refresh 30 days, rotated and revoked on logout) |
| Admin panel | SQLAdmin at `/admin/`, roles `migrant` / `editor` / `admin` |
| Live notifications | WebSocket `/ws/notifications/` (+ Redis between processes) |
| Background tasks | Celery + Redis: emails, job import (06:00), reminders (06:30), ticket price alerts |
| Outside services | «Работа России» (jobs), Travelpayouts/Aviasales (tickets), OpenStreetMap (places), Gemini / Claude (assistant), NBT and CBR (rouble rate) |
| Site | React 19, React Router 7, Vite, Tailwind CSS, motion, lucide icons, MapLibre; installable PWA with offline mode |
| Languages | the site is written in Tajik; `translations.js` holds Russian |

## How a request goes

1. The React site (`frontend/src`) calls `/api/...` through `api.js`, which adds the JWT token.
2. `app/main.py` sends it to a router in `app/routers/`; `app/core/deps.py` finds the user from the token.
3. The router checks the body with a schema from `app/schemas/`, reads and writes tables from `app/models/`,
   uses `app/services/` for bigger logic and answers with JSON (lists are paged by `app/core/pagination.py`).
4. Slow work (emails, imports, reminders) goes to Celery (`app/tasks.py`, `app/worker.py`).

## Run, test, deploy

```bash
.venv/bin/alembic upgrade head        # tables + content
cd frontend && npm run dev            # site :5175, API :8002
.venv/bin/python -m pytest            # tests
```

Deploy: build the site on the laptop (`npm run build`), copy `frontend/dist` to the server, run
`SKIP_BUILD=1 bash deploy/update.sh` there (it pulls the code, migrates the database and restarts the services).

## What still has comments

Only text that is not code commentary: `.env.example` and `alembic.ini` (instructions for whoever fills them in),
the template `alembic/script.py.mako`, the `.env` and nginx templates that `deploy/setup.sh` writes on the server,
and the AI assistant's instructions in `app/assistant/knowledge.py` (they are strings the model reads).
The API pages `/swagger/` and `/redoc/` no longer show long descriptions of endpoints: those are here now.

## Contents

- Root files — 5 files
- Backend — the FastAPI application (`app/`) — 4 files
- `app/core/` — settings, security, request helpers — 9 files
- `app/db/` — database connection and column types — 3 files
- `app/models/` — database tables (SQLAlchemy) — 11 files
- `app/schemas/` — request bodies and JSON answers — 5 files
- `app/routers/` — the API endpoints — 12 files
- `app/services/` — business logic used by routers and background tasks — 14 files
- `app/assistant/` — the AI assistant — 3 files
- `app/admin/` — the admin panel (SQLAdmin, `/admin/`) — 2 files
- `app/admin/templates/` — admin panel pages — 1 files
- `alembic/` — database migrations — 1 files
- `alembic/versions/` — the migrations, in order — 12 files
- `tests/` — automated tests (pytest) — 12 files
- `deploy/` — putting the site on the server — 6 files
- Frontend — the React site (`frontend/`) — 4 files
- `frontend/scripts/` — 1 files
- `frontend/public/` — files served as they are — 4 files
- `frontend/src/` — app core: routing, API, login, languages, helpers — 14 files
- `frontend/src/components/` — reusable parts of pages — 27 files
- `frontend/src/pages/` — one file per page of the site — 27 files


---

## Root files

### `.env.example`

**What it is for:** Copy to .env and fill in. Without .env the project still runs on a laptop (SQLite, emails in the console).

### `README.md`

**What it is for:** The short project overview: what the platform does, how to run it on a laptop, tests, structure.

Muhojir — FastAPI

### `alembic.ini`

**What it is for:** Alembic settings: where the migrations are (the database address comes from app settings).

A generic, single database configuration.

### `pytest.ini`

**What it is for:** pytest settings (asyncio mode, test paths).

### `requirements.txt`

**What it is for:** Python packages of the backend.


---

## Backend — the FastAPI application (`app/`)

### `app/cli.py`

**What it is for:** Commands: python -m app.cli createsuperuser an admin account for /admin/ (asks for email and password) python -m app.cli import-jobs [--limit 20] real vacancies from «Работа России» now python -m app.cli send-reminders today's document reminders now python -m app.cli import-places [--region Москва] [--category mosque] real places from OpenStreetMap python -m app.cli check-flights ticket price alerts now python -m app.cli has-jobs exit code 0 if there are vacancies (used by deploy/setup.sh) python -m app.cli update-rates the official rouble to somoni rate now python -m app.cli import-housing [--channel name] [--pages 4] [--no-photos] housing listings from Telegram channels now

| Name | Kind | What it does |
|---|---|---|
| `create_superuser(email, password)` | async function | — |
| `has_jobs()` | async function | — |
| `has_places()` | async function | — |
| `main()` | function | — |

### `app/main.py`

**What it is for:** Muhojir on FastAPI: a platform for Tajik migrants in Russia (documents and deadlines, patent prices, guides, real jobs, exam practice, an AI assistant). The React site in frontend/ talks to this API. Run for development: uvicorn app.main:app --reload --port 8002 (or `npm run dev` in frontend/, which starts both) API docs: /swagger/ and /redoc/

| Name | Kind | What it does |
|---|---|---|
| `lifespan(app)` | async function | — |

### `app/tasks.py`

**What it is for:** The daily jobs, as plain async functions: used by the Celery worker and by the command line (app/cli.py).

| Name | Kind | What it does |
|---|---|---|
| `run_import_jobs(log)` | async function | New vacancies from «Работа России», then alerts about the new ones. |
| `run_send_reminders(log)` | async function | — |
| `run_import_places(log)` | async function | Real places from OpenStreetMap (migration centers, notaries, mosques, Tajik cafes...). |
| `run_check_flight_watches(log)` | async function | — |
| `run_update_rates(log)` | async function | Fetches today's official rouble to somoni rate (NBT and CBR). |
| `run_import_housing(log, **options)` | async function | Imports housing listings from Telegram channels (app/services/housing_import.py). |

### `app/worker.py`

**What it is for:** Celery: emails in the background and the daily jobs on schedule (Celery Beat): vacancies, reminders, ticket price alerts, housing from Telegram channels three times a day, and every week the places from OpenStreetMap. Run on the server: celery -A app.worker worker and celery -A app.worker beat Without CELERY_BROKER_URL nothing has to run: emails are sent at once and the daily jobs are started from cron or by hand (python -m app.cli import-jobs / send-reminders).

| Name | Kind | What it does |
|---|---|---|
| `send_email(subject, body, to)` | function · `Celery task` | — |
| `import_jobs()` | function | — |
| `send_reminders()` | function | — |
| `check_flight_watches()` | function | — |
| `update_rates()` | function | Celery task: the official rate, at 08:10, 11:10 and 15:10. |
| `import_housing()` | function | Celery task: housing from Telegram at 07:20, 13:20 and 19:20. |
| `import_places()` | function | — |


---

## `app/core/` — settings, security, request helpers

### `app/core/cache.py`

**What it is for:** A small cache for answers of outside services (ticket prices): in Redis when REDIS_URL is set (shared by all server processes), otherwise in this process's memory.

| Name | Kind | What it does |
|---|---|---|
| `_client()` | function | — |
| `get(key)` | async function | — |
| `put(key, value, seconds)` | async function | — |

### `app/core/config.py`

**What it is for:** All settings come from .env (or the environment). Without a .env everything works on a laptop: SQLite database, emails printed in the console, tasks run at once, live notifications inside one process. GOOGLE_CLIENT_ID (OAuth client ID of type "Web application") turns on sign in with Google; while it is empty the button is hidden.

| Name | Kind | What it does |
|---|---|---|
| `Settings` | class | — |
| &nbsp;&nbsp;↳ `cors_origins()` | method | — |
| &nbsp;&nbsp;↳ `smtp_ready()` | method | — |
| &nbsp;&nbsp;↳ `from_email()` | method | — |
| &nbsp;&nbsp;↳ `gemini_models()` | method | — |

### `app/core/crud.py`

**What it is for:** The routes of a simple list that everyone reads and staff change (guides, regions, news, exam questions...): GET list/ (paged, filtered), GET <id>/, and for staff POST list/, PUT/PATCH <id>/, DELETE <id>/.

| Name | Kind | What it does |
|---|---|---|
| `add_content_routes(router, path)` | function | query(request, user) -> the select() of what this visitor may see, already filtered by the query string. writer: a dependency that lets only staff in. check(db, obj, data): extra validation before saving (async). before_save(obj, data, user, created): fills fields like published_at (sync). |
| `apply_ordering(request, query, allowed, default)` | function | ?ordering=expires_at or ?ordering=-created_at, like DRF's OrderingFilter. |

### `app/core/deps.py`

**What it is for:** Who is asking. Like the Django version: no Authorization header = a guest; a broken or expired token = 401, so the site refreshes its token and asks again.

| Name | Kind | What it does |
|---|---|---|
| `optional_user(request, db)` | async function | — |
| `current_user(user)` | async function | — |
| `editor_user(user)` | async function | — |
| `admin_user(user)` | async function | — |

### `app/core/errors.py`

**What it is for:** Errors in the same shape as the Django REST Framework version, which the site already understands: {"detail": "..."} (sometimes with "code"), or {"field": ["message", ...]} for wrong form fields.

| Name | Kind | What it does |
|---|---|---|
| `ApiError` | class | raise ApiError("Wrong code.") -> 400 {"detail": "Wrong code."} |
| `FieldError` | class | raise FieldError("expires_at", "The end date must be after the issue date.") -> 400 {"expires_at": [...]} |
| `_message(error)` | function | — |
| `api_error_handler(request, error)` | async function | — |
| `validation_error_handler(request, error)` | async function | — |
| `http_error_handler(request, error)` | async function | — |

### `app/core/files.py`

**What it is for:** Private files: document photos and payment receipts. They are kept in PRIVATE_MEDIA_ROOT, which the web server never serves; the API hands a file only to its owner. Names are random, so the original file name does not leak.

| Name | Kind | What it does |
|---|---|---|
| `save_private(file, folder, field)` | async function | Checks and saves an uploaded file; returns its name inside PRIVATE_MEDIA_ROOT, e.g. documents/ab12….jpg. |
| `delete_private(name)` | async function | — |
| `private_path(name)` | function | — |
| `image_ext(data)` | function | The real type of the picture from its first bytes (not from the file name); None if it is not one. |
| `save_avatar(file, field)` | async function | — |
| `save_image(file, folder, field, max_mb)` | async function | Checks a public picture by its bytes (JPG, PNG, WEBP, size) and saves it in MEDIA_ROOT/folder. |
| `store_image(data, folder)` | async function | Saves picture bytes (JPG, PNG, WEBP) in MEDIA_ROOT/folder and returns the name, or None if it is not a picture. Used by save_image and the housing import. |
| `delete_image(name, folder)` | async function | Deletes a picture, only inside that folder. |
| `delete_avatar(name)` | async function | — |

### `app/core/pagination.py`

**What it is for:** Lists come in pages, like the Django version: {"count", "next", "previous", "results"}. ?page=2&page_size=50 (10 by default, 100 at most).

| Name | Kind | What it does |
|---|---|---|
| `Page` | class | — |
| &nbsp;&nbsp;↳ `respond(db, query, to_dict)` | method | query: a select(...) of the rows; to_dict(row) -> the JSON of one row. |

### `app/core/security.py`

**What it is for:** Passwords, email codes and JWT tokens. Tokens work like the Django version (SimpleJWT): an access token for 60 minutes and a refresh token for 30 days. Each refresh gives a new pair and blocks the old refresh token, and logout blocks it too (RevokedToken).

| Name | Kind | What it does |
|---|---|---|
| `hash_password(password)` | function | — |
| `verify_password(password, hashed)` | function | — |
| `_common_passwords()` | function | — |
| `_similar(password, value, max_similarity)` | function | — |
| `password_problems(password, email)` | function | — |
| `_token(user_id, kind, lifetime)` | function | — |
| `make_tokens(user_id)` | function | — |
| `read_token(token, kind)` | function | The token's payload, or None when it is broken, expired or of the other kind. |

### `app/core/throttle.py`

**What it is for:** Limits on how often one visitor may do something (sending email codes, password tries, AI questions). The counter is kept in Redis when REDIS_URL is set (shared by all server processes), otherwise in memory.

| Name | Kind | What it does |
|---|---|---|
| `_redis_client()` | function | — |
| `visitor(request)` | function | — |
| `_hit(key, limit, window)` | async function | Counts this request; returns how many seconds to wait, or 0 when it is allowed. |
| `throttle(scope)` | function | Depends(throttle("login")) on a route: 429 when the visitor did it too often. |


---

## `app/db/` — database connection and column types

### `app/db/base.py`

**What it is for:** The declarative Base that every SQLAlchemy model inherits from.

| Name | Kind | What it does |
|---|---|---|
| `Base` | class | — |

### `app/db/session.py`

**What it is for:** The database connection. On SQLite lower() only knows Latin letters, so a search for «москва» would not find «Москва»; it is replaced with Python's lower(), which knows every alphabet (Cyrillic, Tajik). SQLAlchemy's ilike() is lower(x) LIKE lower(y) on SQLite, so every search ignores case. PostgreSQL does not need this.

| Name | Kind | What it does |
|---|---|---|
| `get_db()` | async function | — |

### `app/db/types.py`

**What it is for:** Times are kept in UTC. SQLite has no time zones and gives naive datetimes back, so this type always returns aware UTC datetimes, the same on SQLite and PostgreSQL.

| Name | Kind | What it does |
|---|---|---|
| `utcnow()` | function | — |
| `UTCDateTime` | class | — |
| &nbsp;&nbsp;↳ `process_bind_param(value, dialect)` | method | — |
| &nbsp;&nbsp;↳ `process_result_value(value, dialect)` | method | — |


---

## `app/models/` — database tables (SQLAlchemy)

### `app/models/__init__.py`

**What it is for:** All tables; importing this module registers every model with Base (Alembic and the admin need that).

### `app/models/accounts.py`

**What it is for:** Database tables of accounts: users and their roles, email codes, notifications and revoked refresh tokens.

| Name | Kind | What it does |
|---|---|---|
| `User` | class · table `users` | migrant: documents, reminders, payments, reviews of companies. editor: also the site's content (news, guides, exam questions, help sites, centers, patent prices), in the admin panel and through the API; no access to users, their documents or payments. admin: everything, including users, roles and the blacklist of companies. |
| &nbsp;&nbsp;↳ `is_admin()` | method | — |
| &nbsp;&nbsp;↳ `is_editor()` | method | Editors manage the site's content; admins too. |
| `EmailCode` | class · table `email_codes` | A 6-digit code sent by email: to confirm the email after sign-up ("verify") or to set a new password ("reset"). Only a hash is stored, like a password; asking for a new code replaces the old one. |
| `Notification` | class · table `notifications` | — |
| `RevokedToken` | class · table `revoked_tokens` | Refresh tokens that can not be used again: after logout, and the old one after each refresh. |

### `app/models/documents.py`

**What it is for:** Database tables of migrants' papers: document types, guide steps, regions with patent prices, the user's documents, payments, reminder logs, law news and exam questions.

| Name | Kind | What it does |
|---|---|---|
| `add_months(day, months)` | function | add_months(date(2026, 1, 31), 1) -> date(2026, 2, 28): the same day next month, or the month's last day. |
| `DocumentType` | class · table `document_types` | A kind of paper a migrant needs: patent, migration registration, migration card, insurance, medical check. |
| `GuideStep` | class · table `guide_steps` | One step of the step-by-step guide for a document type. |
| `Region` | class · table `regions` | A region of Russia with its monthly patent price (the NDFL advance). Editors update prices each January. |
| `UserDocument` | class · table `user_documents` | A document the user holds, with its end date. Reminders are sent before it runs out. |
| &nbsp;&nbsp;↳ `days_left()` | method | — |
| &nbsp;&nbsp;↳ `status()` | method | — |
| `Payment` | class · table `payments` | A payment for a document, e.g. the monthly patent tax, with a photo of the receipt (the receipts archive). A new payment moves the document's end date forward by the months paid; deleting it does not move it back. |
| `MigrationCenter` | class · table `migration_centers` | A migration center where papers are handed in. Editors add them; the site shows them by region. |
| `ReminderLog` | class · table `reminder_logs` | Remembers which reminders were already sent, so the daily job never sends the same one twice. The end date is part of the key: after the user renews a document, its reminders start again. |
| `LawNews` | class · table `law_news` | News about migration law, written in Tajik. |
| `ExamQuestion` | class · table `exam_questions` | A practice question for the exam in Russian language, history and law that is needed for the patent. options is a list of answers; answer is the number (from 0) of the right one. A listening question has listen_text: the site reads it aloud in Russian before the question. |

### `app/models/feedback.py`

**What it is for:** Table of users' feedback about the site.

| Name | Kind | What it does |
|---|---|---|
| `FEEDBACK_KINDS` | const | Kinds of feedback: idea, bug (something broken on the site), praise, other. |
| `FEEDBACK_STATUSES` | const | new (not read yet), read, done (answered). |
| `Feedback` | class · table `feedback` | Feedback of a logged-in user: kind, rating 1-5 (optional), message, the page it was sent from, status, an editor's reply and when it was sent, and an optional photo (private file in private_media/feedback/). |

### `app/models/housing.py`

**What it is for:** Tables of housing listings (beds, rooms, flats, hostels) that people post for migrants, and their photos.

| Name | Kind | What it does |
|---|---|---|
| `HOUSING_KINDS` | const | bed (a bed in a shared room), room, flat (the whole flat), hostel. |
| `HOUSING_FOR` | const | Who may live there: any, men, women, family. |
| `HOUSING_PERIODS` | const | The price is per month or per day. |
| `HOUSING_STATUSES` | const | pending (waits for an editor), approved, rejected. |
| `Housing` | class · table `housing` | A listing (posted by a user, or imported: source telegram, source_name «@channel», source_url to the original, external_id of the post, fingerprint against doubles, no owner): kind, title, description, city, address, metro, price and period, rooms, free places, for whom, registration (the landlord registers the migrant), utilities included, no deposit, phone/WhatsApp/Telegram, is_active (false = already rented, hidden), status, reject_reason. kind_label and for_whom_label give the Tajik names. |
| `HousingPhoto` | class · table `housing_photos` | A photo of a listing (public file in media/housing/), deleted together with the listing. |

### `app/models/jobs.py`

**What it is for:** Database tables of work: employers, jobs (imported from «Работа России»), reviews of employers, workers' blacklist reports, saved jobs and job alerts.

| Name | Kind | What it does |
|---|---|---|
| `default_job_expiry()` | function | — |
| `Employer` | class · table `employers` | The company of imported job ads, found again by its code on the source site (external_id). Admins verify real companies and put the ones that don't pay wages on the blacklist. |
| `Job` | class · table `jobs` | — |
| &nbsp;&nbsp;↳ `industry_label()` | method | — |
| `EmployerReview` | class · table `employer_reviews` | A worker's review of an employer. salary_not_paid marks complaints that feed the blacklist. |
| `BlacklistReport` | class · table `blacklist_reports` | A worker puts a job's company on the blacklist, with the reason. Everyone sees the reports at once; the jobs stay visible with a warning. Admins check them and may blacklist the company for real (Employer.is_blacklisted hides its jobs) or delete a false report. |
| `SavedJob` | class · table `saved_jobs` | A job the user saved to look at later. |
| `JobAlert` | class · table `job_alerts` | "Tell me about new jobs like these": the filters of the jobs page, kept. After each import the user gets one notification with the new jobs that match (see services/alerts.py). Empty fields mean "any". |
| &nbsp;&nbsp;↳ `industry_label()` | method | — |

### `app/models/market.py`

**What it is for:** Database tables of the shops section: Tajik shops, cafes and bakeries in Russia, their products, reviews and the owner's proof that the shop is real.

| Name | Kind | What it does |
|---|---|---|
| `SHOP_CATEGORIES` | const | Kinds of shops (grocery, meat, bakery, sweets, cafe, clothes, home, other) with Tajik labels. |
| `SHOP_STATUSES` | const | draft (proofs not sent yet), pending (waits for an editor), approved (seen by everyone), rejected. |
| `PROOF_KINDS` | const | Kinds of proof: place (the shop or market stall), goods (shelves with goods), document (ИП, lease, patent). |
| `REQUIRED_PROOFS` | const | place and goods are required to send a shop for checking. |
| `PRODUCT_UNITS` | const | What the price is for: piece, kg, litre, bunch, box, portion. |
| `Shop` | class · table `shops` | A shop of a user (owner): name, kind, city, address, location (lat, lon), phone/WhatsApp/Telegram, hours, delivery, logo. A new shop is a draft; the owner adds proofs and the location and sends it, then an editor approves it; reject_reason tells the owner what to fix. |
| `Product` | class · table `products` | A product of a shop: name, price in roubles, unit, photo, in stock or not. |
| `ShopProof` | class · table `shop_proofs` | A private proof file of a shop (photo or PDF in PRIVATE_MEDIA_ROOT); only the owner and editors can open it. |
| `ShopReview` | class · table `shop_reviews` | A buyer's rating (1-5) and words about a shop; one per person per shop. |


### `app/models/places.py`

**What it is for:** Database tables of the places directory (map of useful places) and their reviews.

| Name | Kind | What it does |
|---|---|---|
| `Place` | class · table `places` | A useful place on the map. Most come from OpenStreetMap (source "osm", refreshed by the import); users may suggest new ones (source "user") with a pin on the map and a photo; they appear after an editor approves them. proof is the private photo (place-proofs/), reject_reason is set when an editor rejects the suggestion. |
| `PlaceReview` | class · table `place_reviews` | A visitor's rating (1-5) and words about a place; one per person per place. |

### `app/models/rates.py`

**What it is for:** Table of the official rouble to somoni rate, one row per source and day.

| Name | Kind | What it does |
|---|---|---|
| `RATE_SOURCES` | const | Sources: nbt (National Bank of Tajikistan) and cbr (Central Bank of Russia). |
| `ExchangeRate` | class · table `exchange_rates` | The official rate of one day: value = how many somoni for 1 rouble. One row per source and day (one_rate_per_source_day). |

### `app/models/course.py`

**What it is for:** Tables of the Russian course: lesson progress, level exams and the course certificate.

| Name | Kind | What it does |
|---|---|---|
| `LessonProgress` | class · table `lesson_progress` | A finished lesson of a user (level, number, best score in %). One row per user and lesson. |
| `ExamAttempt` | class · table `exam_attempts` | One try of a level exam: the questions with their shuffled option order, the answers, right answers count, passed, start, deadline and finish time. A passed attempt opens the next level. |
| `Certificate` | class · table `certificates` | The one certificate for the whole course, issued after the level 7 exam. code is the public check code, number looks like MJ-RU-2026-00001, percent is the average of the best results of all levels. Editors can revoke it (is_revoked). |

### `app/models/support.py`

**What it is for:** Database tables of help: help sites and contacts (embassy, hotline, lawyers).

| Name | Kind | What it does |
|---|---|---|
| `HelpContact` | class · table `help_contacts` | Where a migrant can get help: official sites to read about the patent, the embassy, a hotline, a lawyer, or the official MVD check page. Editors add them (with real, checked links). |

### `app/models/travel.py`

**What it is for:** Database tables of air tickets: airports (TJ and RU) and price alerts (flight watches).

| Name | Kind | What it does |
|---|---|---|
| `Airport` | class · table `airports` | An airport in Tajikistan (TJ) or Russia (RU). city_code groups the airports of one city (Moscow: MOW), so a search can be "any airport of Moscow". |
| `FlightWatch` | class · table `flight_watches` | "Tell me when a ticket on this route gets cheaper than max_price": checked every day (services/flights.py). month is "2026-11"; after that month the watch switches itself off. |


---

## `app/schemas/` — request bodies and JSON answers

### `app/schemas/accounts.py`

**What it is for:** Request bodies (Pydantic) and JSON answers of sign-up, login, passwords and the profile.

| Name | Kind | What it does |
|---|---|---|
| `EmailIn` | class | — |
| `RegisterIn` | class | — |
| `LoginIn` | class | — |
| `CodeIn` | class | — |
| &nbsp;&nbsp;↳ `six_digits(value)` | method | — |
| `ResetPasswordIn` | class | — |
| `GoogleIn` | class | Google's ID token from the sign-in button. |
| `RefreshIn` | class | — |
| `ProfileIn` | class | — |
| &nbsp;&nbsp;↳ `phone_format(value)` | method | — |
| `NotificationIn` | class | — |
| `user_json(user)` | function | — |

### `app/schemas/common.py`

**What it is for:** Shared helpers for request bodies: the Form base class, email and phone normalising.

| Name | Kind | What it does |
|---|---|---|
| `_email(value)` | function | — |
| `normalize_phone(value)` | function | "+7 (999) 123-45-67" -> "+79991234567". Russian (+7) and Tajik (+992) numbers are the usual ones, but any international number with 10-15 digits is accepted. |
| `Form` | class | Request bodies: unknown fields are ignored (like DRF), surrounding spaces of text are trimmed. |

### `app/schemas/documents.py`

**What it is for:** Request bodies and JSON answers of documents, document types, guide steps, regions, payments, news and exam questions.

| Name | Kind | What it does |
|---|---|---|
| `money(value)` | function | Decimals go out as text, "10000.00", like Django REST Framework. |
| `day(value)` | function | — |
| `DocumentTypeIn` | class | — |
| `DocumentTypePatch` | class | — |
| `document_type_json(t)` | function | — |
| `GuideStepIn` | class | — |
| `GuideStepPatch` | class | — |
| `guide_step_json(s)` | function | — |
| `RegionIn` | class | — |
| `RegionPatch` | class | — |
| `region_json(r)` | function | — |
| `CenterIn` | class | — |
| `CenterPatch` | class | — |
| `center_json(c)` | function | — |
| `NewsIn` | class | — |
| `NewsPatch` | class | — |
| `news_json(n)` | function | — |
| `ExamQuestionIn` | class | — |
| `ExamQuestionPatch` | class | — |
| `exam_question_json(q)` | function | — |
| `UserDocumentIn` | class | — |
| `UserDocumentPatch` | class | — |
| `user_document_json(d)` | function | — |
| `payment_json(p)` | function | — |

### `app/schemas/housing.py`

**What it is for:** Request bodies and the JSON answer of /api/housing/.

| Name | Kind | What it does |
|---|---|---|
| `HousingIn` | class | A new listing with confirmed; phones are normalized, Telegram checked (as for shops); at least one contact is required. |
| `HousingPatch` | class | The same fields, all optional, plus is_active. |
| `housing_json(h, viewer)` | function | A listing with photos, the owner's first name (for imported ones the channel) and is_mine, source, source_name, source_url; reject_reason only for the owner and editors. |

### `app/schemas/jobs.py`

**What it is for:** JSON answers of employers, jobs, reviews and blacklist reports, and the request bodies of reviews, reports and job alerts.

| Name | Kind | What it does |
|---|---|---|
| `employer_short_json(e)` | function | — |
| `employer_json(e)` | function | — |
| `job_json(job, is_saved)` | function | — |
| `review_json(review, viewer)` | function | — |
| `report_json(report, viewer)` | function | — |
| `ReportIn` | class | — |
| `ReviewIn` | class | — |
| `ReviewPatch` | class | — |
| `AlertIn` | class | — |
| `AlertPatch` | class | — |
| `alert_json(a)` | function | — |

### `app/schemas/market.py`

**What it is for:** Request bodies and JSON answers of /api/market/.

| Name | Kind | What it does |
|---|---|---|
| `media(name)` | function | A stored file name -> its /media/ address (or None). |
| `owner_name(user)` | function | Only the first name is shown to others. |
| `shop_json(shop, avg, n, products, viewer)` | function | A shop with rating, number of reviews and products; reject_reason only for the owner and editors. |
| `shop_map_json(shop)` | function | An approved shop as a pin on the places map: name, kind, city, address, lat, lon, hours, logo (no contacts). |
| `shop_short_json(shop)` | function | A shop inside a product of the common product list. |
| `product_json(product, with_shop)` | function | A product; with_shop adds its shop. |
| `review_json(review, viewer)` | function | A shop review. |
| `proof_json(proof)` | function | A proof: kind, label, whether it is a PDF (the file itself comes from its own endpoint). |
| `clean_phone(value)` | function | Empty or +7… form. |
| `clean_telegram(value)` | function | Takes @name, t.me/name or a link and keeps the bare username. |
| `ShopFields` | class | Shared checks of phone, WhatsApp and Telegram. |
| `ShopIn` | class | A new shop; at least one contact is required. |
| `ShopPatch` | class | Changing a shop (only the sent fields). |
| `ModerateIn` | class | An editor's decision: approved, or rejected with a reason. |
| `ProductIn` | class | A new product. |
| `ProductPatch` | class | Changing a product. |
| `ReviewIn` | class | Rating 1-5 and text. |


---

## `app/routers/` — the API endpoints

### `app/routers/assistant.py`

**What it is for:** AI assistant of the site: answers about migration and the site, and opens pages for the visitor. GET tells whether the assistant is set up; POST sends the conversation and returns {"reply", "navigate" (a page address to open, or null), "refused", "truncated"}. POST /api/assistant/ needs login since 2026-10-29 (guests get 401).

| Name | Kind | What it does |
|---|---|---|
| `ChatMessage` | class | — |
| `Chat` | class | — |
| &nbsp;&nbsp;↳ `last_from_user(messages)` | method | — |
| `site_language(request, user)` | function | — |
| `status()` | async function · `GET /api/assistant/` | — |
| `chat(data, request, db, user)` | async function · `POST /api/assistant/` | — |

### `app/routers/auth.py`

**What it is for:** Sign-up and login with an email and a password: 1. POST /api/auth/register/ {email, password, full_name} -> account made, a 6-digit code goes to the email 2. POST /api/auth/verify-email/ {email, code} -> email confirmed, JWT tokens given 3. POST /api/auth/login/ {email, password} -> JWT tokens (only once the email is confirmed) Forgot the password: POST password/forgot/ {email} sends a code, POST password/reset/ {email, code, password}. resend-code/ {email} sends the sign-up code again. Then: token/refresh/, logout/, profile/, notifications/. Sign in with Google: GET google/ -> {client_id}, POST google/ {credential} -> JWT tokens.

| Name | Kind | What it does |
|---|---|---|
| `check_password_rules(password, email)` | function | — |
| `logged_in(user, status)` | function | — |
| `jsonable(data)` | function | — |
| `email_code(db, email, purpose)` | async function | Sends a code unless one was sent less than a minute ago. Raises ApiError (429 wait / 503 mail down). |
| `use_code(db, email, code, purpose)` | async function | Checks the code; a right code works only once. Raises ApiError when it is wrong or old. |
| `user_by_email(db, email)` | async function | — |
| `register(data, db)` | async function · `POST /api/auth/register/` | Step 1 of sign-up: email, password and name. The account waits until the email is confirmed. |
| `verify_email(data, db)` | async function · `POST /api/auth/verify-email/` | Step 2 of sign-up: the code from the email. Confirms the email and logs in. A new account gets the welcome notification. |
| `resend_code(data, db)` | async function · `POST /api/auth/resend-code/` | Sends the sign-up code again (only to accounts that are not confirmed yet). |
| `login(data, db)` | async function · `POST /api/auth/login/` | Email + password. An account whose email is not confirmed yet gets a new code instead of tokens. |
| `social_login(db, email, full_name)` | async function | Logs in the account with this email or makes a new one without a password (201). An account whose email was never confirmed loses its old password, because whoever set it did not own the address. Blocked = 403. A new account gets the welcome notification. |
| `google_settings()` | async function · `GET /api/auth/google/` | The client ID for Google's button; an empty string means sign in with Google is off. |
| `google_login(data, db)` | async function · `POST /api/auth/google/` | Sign in with Google: checks the ID token, then social_login. No GOOGLE_CLIENT_ID = 503, bad token = 400. |
| `forgot_password(data, db)` | async function · `POST /api/auth/password/forgot/` | Sends a code for a new password. Answers the same whether the email is registered or not, so nobody can use it to find out who has an account. |
| `reset_password(data, db)` | async function · `POST /api/auth/password/reset/` | The code from the email and a new password. Also confirms the email, and logs in. Sends «Your password was changed». |
| `revoke(db, payload)` | async function | Blocks a refresh token. Returns False if it was blocked already. |
| `refresh_token(data, db)` | async function · `POST /api/auth/token/refresh/` | A new access token and a new refresh token; the old refresh token stops working. |
| `logout(data, db)` | async function · `POST /api/auth/logout/` | Log out: the refresh token goes on the blacklist, so it can not be used again. |
| `profile(user)` | async function · `GET /api/auth/profile/` | — |
| `update_profile(data, user, db)` | async function · `PATCH /api/auth/profile/` | Change name, phone, city, language, email reminders. |
| `upload_avatar(user, db, avatar)` | async function · `POST /api/auth/profile/avatar/` | The profile photo (JPG, PNG or WEBP, up to 3 MB); it replaces the old one. |
| `remove_avatar(user, db)` | async function · `DELETE /api/auth/profile/avatar/` | — |
| `my_notifications(user)` | function | — |
| `notifications(user, db, page, kind, is_read, search)` | async function · `GET /api/auth/notifications/` | — |
| `unread_notifications(user, db)` | async function · `GET /api/auth/notifications/unread-count/` | — |
| `read_all(user, db)` | async function · `POST /api/auth/notifications/read-all/` | — |
| `get_notification(db, user, notification_id)` | async function | — |
| `notification(notification_id, user, db)` | async function · `GET /api/auth/notifications/{notification_id}/` | — |
| `update_notification(notification_id, data, user, db)` | async function · `PATCH /api/auth/notifications/{notification_id}/` | — |
| `delete_notification(notification_id, user, db)` | async function · `DELETE /api/auth/notifications/{notification_id}/` | — |

### `app/routers/course.py`

**What it is for:** /api/course/: the Russian course. Lessons open one by one (lesson N after lesson N-1, a new level after the exam of the previous level). Level exams are graded on the server: 20 random questions from the level's pool with shuffled options, 30 minutes (+1 minute grace), 80% to pass, a new try 1 hour after a failed one. Passing the level 7 exam gives the course certificate; anyone can check it by its code.

| Name | Kind | What it does |
|---|---|---|
| `GET /api/course/` | async function | All levels with lessons, the user's scores, which lessons are open, exam state of each level (ready, passed, percent, wait_until, open) and the user's certificate. Works for guests too. |
| `GET /api/course/levels/{level}/lessons/{number}/` | async function | One lesson: theory, words and exercises. 403 with code «locked» if the previous lesson is not finished. |
| `POST /api/course/levels/{level}/lessons/{number}/complete/` | async function | Saves the lesson score (at least 60%); the best score is kept. |
| `POST /api/course/levels/{level}/exam/` | async function | Starts the level exam (all 10 lessons needed, previous level passed) or returns the open one. full_name is the name for the certificate. 429 with wait_until after a failed try. |
| `GET /api/course/exams/{attempt_id}/` | async function | The questions of an open exam (without answers). |
| `POST /api/course/exams/{attempt_id}/submit/` | async function | Grades the answers and returns the result with a review; after level 7 also the certificate. |
| `GET /api/course/certificates/` | async function | The user's certificate (a list with 0 or 1 item). |
| `GET /api/course/certificates/{code}/` | async function | Public check of a certificate by its code. |

### `app/routers/documents.py`

**What it is for:** /api/documents/: document types and their guides, patent prices by region, migration centers, law news and exam questions (everyone reads, editors change); and the user's own documents and payments (only their own).

| Name | Kind | What it does |
|---|---|---|
| `param(request, name)` | function | — |
| `int_param(request, name)` | function | — |
| `search(query, request)` | function | ?search=words in any of these columns, case does not matter (Cyrillic too). |
| `not_found(name, value)` | function | — |
| `must_exist(db, model, value, field)` | async function | — |
| `document_types_query(request, user)` | function | — |
| `guide_steps_query(request, user)` | function | — |
| `check_step(db, step, data)` | async function | — |
| `regions_query(request, user)` | function | — |
| `centers_query(request, user)` | function | — |
| `check_center(db, center, data)` | async function | — |
| `news_query(request, user)` | function | — |
| `check_news(db, news, data)` | async function | — |
| `news_before_save(news, data, user, created)` | function | — |
| `exam_query(request, user)` | function | — |
| `check_question(db, question, data)` | async function | — |
| `my_documents(user)` | function | — |
| `my_document(db, user, document_id)` | async function | — |
| `check_document(db, document)` | async function | — |
| `list_my_documents(request, user, db, page)` | async function · `GET /api/documents/my-documents/` | — |
| `create_my_document(data, user, db)` | async function · `POST /api/documents/my-documents/` | — |
| `get_my_document(document_id, user, db)` | async function · `GET /api/documents/my-documents/{document_id}/` | — |
| `change_document(document_id, data, user, db, partial)` | async function | — |
| `put_my_document(document_id, data, user, db)` | async function · `PUT /api/documents/my-documents/{document_id}/` | — |
| `patch_my_document(document_id, data, user, db)` | async function · `PATCH /api/documents/my-documents/{document_id}/` | — |
| `delete_my_document(document_id, user, db)` | async function · `DELETE /api/documents/my-documents/{document_id}/` | — |
| `document_photo(document_id, user, db)` | async function · `GET /api/documents/my-documents/{document_id}/photo/` | The photo of the document: only for its owner. |
| `upload_document_photo(document_id, user, db, photo)` | async function · `POST /api/documents/my-documents/{document_id}/photo/` | — |
| `delete_document_photo(document_id, user, db)` | async function · `DELETE /api/documents/my-documents/{document_id}/photo/` | — |
| `my_payments(user)` | function | — |
| `my_payment(db, user, payment_id)` | async function | — |
| `list_payments(request, user, db, page)` | async function · `GET /api/documents/payments/` | — |
| `create_payment(user, db, document, amount, months, paid_at, note, receipt)` | async function · `POST /api/documents/payments/` | A payment for one of my documents. Its end date moves forward by the months paid. |
| `get_payment(payment_id, user, db)` | async function · `GET /api/documents/payments/{payment_id}/` | — |
| `delete_payment(payment_id, user, db)` | async function · `DELETE /api/documents/payments/{payment_id}/` | Deleting a payment does not move the document's end date back. |
| `payment_receipt(payment_id, user, db)` | async function · `GET /api/documents/payments/{payment_id}/receipt/` | — |

### `app/routers/feedback.py`

**What it is for:** /api/feedback/: users send feedback about the site (logged in only), editors read and answer it.

| Name | Kind | What it does |
|---|---|---|
| `FeedbackIn` | class | kind, rating (1-5 or empty), message (5-3000 characters), page. |
| `FeedbackPatch` | class | status and/or reply (editors). |
| `feedback_json(f, viewer)` | function | JSON of feedback; editors also see the name, email and page of the author; photo is the address of the photo or null. |
| `send_feedback(request, db, user)` | async function · `POST /api/feedback/` | Takes JSON or a form (multipart) with an optional photo (jpg, png, webp; up to 10 MB). Saves the feedback and notifies editors. 10 per hour per user. |
| `feedback_photo(feedback_id, db, user)` | async function · `GET /api/feedback/{feedback_id}/photo/` | The photo of feedback: only its author and editors, others get 404. |
| `my_feedback(db, user)` | async function · `GET /api/feedback/mine/` | The user's own feedback with the replies. |
| `list_feedback(request, db, user, page)` | async function · `GET /api/feedback/` | Editors: all feedback, newest first; ?status= and ?kind=. |
| `update_feedback(feedback_id, data, db, user)` | async function · `PATCH /api/feedback/{feedback_id}/` | Editors: change the status or reply; a reply notifies the author. |

### `app/routers/flights.py`

**What it is for:** /api/flights/: air tickets between Tajikistan and Russia (both ways): airports, prices for a month with the cheapest price of every day, and price alerts ("tell me when it is cheaper than ...").

| Name | Kind | What it does |
|---|---|---|
| `airport_json(a)` | function | — |
| `airports(db, country)` | async function · `GET /api/flights/airports/` | All airports (not paged: there are about 30). ?country=TJ or ?country=RU. |
| `country_of(db, code, field)` | async function | A code is an airport (SVO) or a city (MOW). Returns TJ or RU; unknown codes are refused. |
| `check_route(db, origin, destination)` | async function | — |
| `check_month(month)` | function | — |
| `prices(db, origin, destination, month, direct)` | async function · `GET /api/flights/prices/` | The one-way tickets of the month (cheapest first) and a calendar {day: cheapest price}. enabled=false means no TRAVELPAYOUTS_TOKEN: then only search_url (aviasales.ru) is given. |
| `codes_of(db, code)` | async function | A city code (MOW) → the city and all its airports (MOW, SVO, DME, VKO, ZIA); an airport → itself. |
| `day_prices(db, origin, destination, day, direct)` | async function · `GET /api/flights/day/` | All tickets of one day: every airport of both cities, direct and with transfers, merged without repeats, cheapest first. ?day=YYYY-MM-DD. |
| `WatchIn` | class | — |
| &nbsp;&nbsp;↳ `upper(value)` | method | — |
| `watch_json(w)` | function | — |
| `list_watches(db, user)` | async function · `GET /api/flights/watches/` | — |
| `create_watch(data, db, user)` | async function · `POST /api/flights/watches/` | — |
| `my_watch(db, user, watch_id)` | async function | — |
| `delete_watch(watch_id, db, user)` | async function · `DELETE /api/flights/watches/{watch_id}/` | — |

### `app/routers/housing.py`

**What it is for:** /api/housing/: housing listings for migrants. Anyone logged in posts a listing; it is shown to everyone only after an editor approves it. Search and filters like the jobs page.

| Name | Kind | What it does |
|---|---|---|
| `housing_filters(query, request)` | function | ?search= (title, description, address, metro), ?city=, ?kind=, ?for_whom= (also shows listings for any), ?period=, ?min_price=, ?max_price=, ?registration=, ?utilities_included=, ?no_deposit=, ?with_photos=, ?source= (user or telegram). |
| `list_housing(request, db, user, page)` | async function · `GET /api/housing/` | Approved and active listings with the filters; ?mine=true — the user's own listings in any status; editors: ?status=. ?ordering=price / -price / -created_at (default newest). |
| `summary(db)` | async function · `GET /api/housing/summary/` | How many listings are shown, per kind, and the top cities. |
| `get_housing(db, user, housing_id)` | async function | A listing that this user may see (others see only approved and active ones), else 404. |
| `own_housing(db, user, housing_id)` | async function | The same, but only for the owner or an editor (403). |
| `tell_owner(db, housing)` | async function | Notifies the owner that the listing was approved or rejected (with the reason). |
| `housing_detail(housing_id, db, user)` | async function · `GET /api/housing/{housing_id}/` | One listing. |
| `create_housing(data, db, user)` | async function · `POST /api/housing/` | A new listing; non-editors must send confirmed=true (the place is real and the data true): from editors approved at once, from others pending and editors are notified. At most 5 waiting listings per user, 10 posts per hour. |
| `update_housing(housing_id, data, db, user)` | async function · `PATCH /api/housing/{housing_id}/` | Changes a listing. Any change except is_active by a non-editor sends it back to checking. |
| `delete_housing(housing_id, db, user)` | async function · `DELETE /api/housing/{housing_id}/` | Deletes the listing and its photo files. |
| `moderate_housing(housing_id, data, db, user)` | async function · `POST /api/housing/{housing_id}/moderate/` | Editors: approved or rejected (a reason is required); the owner is notified. |
| `add_photo(housing_id, db, user, photo)` | async function · `POST /api/housing/{housing_id}/photos/` | Adds a photo (JPG, PNG, WEBP, up to 5 MB, at most 8). |
| `delete_photo(housing_id, photo_id, db, user)` | async function · `DELETE /api/housing/{housing_id}/photos/{photo_id}/` | Removes a photo. |

### `app/routers/jobs.py`

**What it is for:** /api/jobs/: real vacancies (imported from «Работа России», read-only here), their companies, workers' reviews of companies, saved jobs and alerts about new jobs.

| Name | Kind | What it does |
|---|---|---|
| `bool_param(request, name)` | function | — |
| `open_jobs(query)` | function | The jobs workers see: switched on, not expired, and not from a blacklisted company. |
| `filter_jobs(query, params, user)` | function | The job filters, used by the list and by the alerts: search, city, industry, min_salary, housing... |
| `jobs_query(user)` | function | — |
| `list_jobs(request, db, user, page)` | async function · `GET /api/jobs/jobs/` | Workers see only open jobs; admins see everything. Filters: search, city, industry, employer, min_salary, salary_period, housing_provided, meals_provided, helps_with_documents, saved=true; ordering=-salary_from... |
| `get_job(db, user, job_id)` | async function | — |
| `job_detail(job_id, db, user)` | async function · `GET /api/jobs/jobs/{job_id}/` | — |
| `get_job_row(row)` | function | — |
| `save_job(job_id, db, user)` | async function · `POST /api/jobs/jobs/{job_id}/save/` | Save the job for later. |
| `unsave_job(job_id, db, user)` | async function · `DELETE /api/jobs/jobs/{job_id}/save/` | Remove the job from the saved ones. |
| `get_report(db, report_id)` | async function | — |
| `count_reports(db, employer_id)` | async function | — |
| `report_job(job_id, data, db, user)` | async function · `POST /api/jobs/jobs/{job_id}/blacklist/` | Put the job's company on the blacklist with a reason. One report per company per user: sending again changes the reason. |
| `blacklist(request, db, user, page)` | async function · `GET /api/jobs/blacklist/` | The companies on the blacklist: blacklisted by admins first, then by the number of reports. Every company comes with its latest reports (?reports=3, up to 20); all of them are at /blacklist/reports/?employer=ID. |
| `list_reports(request, db, user, page)` | async function · `GET /api/jobs/blacklist/reports/` | Everyone's reports, newest first. ?employer=ID, ?mine=true. |
| `delete_report(report_id, db, user)` | async function · `DELETE /api/jobs/blacklist/reports/{report_id}/` | The author takes the report back (or an admin removes a false one). |
| `list_employers(request, db, page)` | async function · `GET /api/jobs/employers/` | — |
| `employer_detail(employer_id, db)` | async function · `GET /api/jobs/employers/{employer_id}/` | — |
| `list_reviews(request, db, user, page)` | async function · `GET /api/jobs/reviews/` | — |
| `get_review(db, review_id)` | async function | — |
| `create_review(data, db, user)` | async function · `POST /api/jobs/reviews/` | — |
| `review_detail(review_id, db, user)` | async function · `GET /api/jobs/reviews/{review_id}/` | — |
| `own_review(db, user, review_id)` | async function | — |
| `change_review(review_id, data, db, user, partial)` | async function | — |
| `put_review(review_id, data, db, user)` | async function · `PUT /api/jobs/reviews/{review_id}/` | — |
| `patch_review(review_id, data, db, user)` | async function · `PATCH /api/jobs/reviews/{review_id}/` | — |
| `delete_review(review_id, db, user)` | async function · `DELETE /api/jobs/reviews/{review_id}/` | — |
| `check_alert(alert)` | function | — |
| `my_alert(db, user, alert_id)` | async function | — |
| `list_alerts(db, user)` | async function · `GET /api/jobs/alerts/` | — |
| `create_alert(data, db, user)` | async function · `POST /api/jobs/alerts/` | — |
| `alert_detail(alert_id, db, user)` | async function · `GET /api/jobs/alerts/{alert_id}/` | — |
| `change_alert(alert_id, data, db, user, partial)` | async function | — |
| `put_alert(alert_id, data, db, user)` | async function · `PUT /api/jobs/alerts/{alert_id}/` | — |
| `patch_alert(alert_id, data, db, user)` | async function · `PATCH /api/jobs/alerts/{alert_id}/` | — |
| `delete_alert(alert_id, db, user)` | async function · `DELETE /api/jobs/alerts/{alert_id}/` | — |

### `app/routers/market.py`

**What it is for:** /api/market/: Tajik shops in Russia. Any logged-in user can open up to 3 shops and add products with prices and photos. To stop fake shops, the owner adds a photo of the place, a photo of the goods (a document is optional) and marks the shop on the map; only then can the shop be sent to an editor, who checks the photos, the map and the street panorama. Buyers search shops and products and contact the seller by phone, WhatsApp or Telegram (there is no online payment).

| Name | Kind | What it does |
|---|---|---|
| `shops_query()` | function | Shops with average rating, number of reviews and products. |
| `visible(query, user)` | function | Guests see approved shops; an owner also sees their own; editors see all. |
| `shop_filters(query, request, search)` | function | search (also in product names), city, category, delivery. |
| `as_json(user)` | function | A row -> shop_json for this viewer. |
| `find_address(request, user)` | async function · `GET /api/market/geocode/` | ?q=address -> matching places (logged-in users, 60 per hour); 503 when the search service is down. |
| `list_shops(request, db, user, page)` | async function · `GET /api/market/shops/` | Approved shops with the filters; mine=true — my shops in any status; editors: status=pending. Ordering: rating, name, created_at. |
| `summary(db)` | async function · `GET /api/market/shops/summary/` | Number of shops and products, shops per kind and the cities with shops. |
| `shops_map(db)` | async function · `GET /api/market/shops/map/` | All approved shops that have a location, for the «Tajik shops» layer of the places map. Declared before /shops/{shop_id}/. |
| `get_shop_row(db, user, shop_id)` | async function | One visible shop row or 404. |
| `own_shop(db, user, shop_id)` | async function | The shop if the user is its owner or an editor, otherwise 403. |
| `shop_answer(db, user, shop_id)` | async function | Reads the shop again and returns its JSON. |
| `shop_detail(shop_id, db, user)` | async function · `GET /api/market/shops/{shop_id}/` | A shop and my review of it. |
| `create_shop(data, db, user)` | async function · `POST /api/market/shops/` | Opens a shop (at most 3 per user) as a draft; editors' shops are approved at once. |
| `update_shop(shop_id, data, db, user)` | async function · `PATCH /api/market/shops/{shop_id}/` | Changes a shop, also its location (lat, lon). If the owner (not an editor) moves the pin of an approved shop, it goes back to «pending» and disappears from the map until an editor checks it again; an approved shop cannot lose its location. Editors get «Shop moved» then. |
| `delete_shop(shop_id, db, user)` | async function · `DELETE /api/market/shops/{shop_id}/` | Deletes the shop, its products, reviews and photos. |
| `moderate_shop(shop_id, data, db, user)` | async function · `POST /api/market/shops/{shop_id}/moderate/` | Editors approve or reject (with a reason) a sent shop, not a draft; the owner gets a notification. |
| `proof_kinds(db, shop_id)` | async function | Which kinds of proof a shop has. |
| `list_proofs(shop_id, db, user)` | async function · `GET /api/market/shops/{shop_id}/proofs/` | Proofs of a shop, for its owner and editors. |
| `add_proof(shop_id, db, user, kind, file)` | async function · `POST /api/market/shops/{shop_id}/proofs/` | Uploads a proof (form: kind, file; JPG, PNG, WEBP or PDF up to 10 MB, at most 8) into private files. |
| `get_proof(db, user, shop_id, proof_id)` | async function | One proof of my shop (or any for editors), otherwise 404/403. |
| `proof_file(shop_id, proof_id, db, user)` | async function · `GET /api/market/shops/{shop_id}/proofs/{proof_id}/` | The proof file itself, never cached. |
| `delete_proof(shop_id, proof_id, db, user)` | async function · `DELETE /api/market/shops/{shop_id}/proofs/{proof_id}/` | Deletes a proof and its file. |
| `submit_shop(shop_id, db, user)` | async function · `POST /api/market/shops/{shop_id}/submit/` | Sends a draft or rejected shop for checking; needs the place and goods photos ({"proofs"}) and the location ({"location"}). Editors get «New shop for checking». |
| `upload_logo / remove_logo` | async function · `POST/DELETE /api/market/shops/{shop_id}/logo/` | The shop logo (JPG, PNG, WEBP up to 3 MB). |
| `product_filters(query, request)` | function | search, max_price, in_stock; ordering price, created_at, name (in stock first by default). |
| `shop_products(shop_id, request, db, user, page)` | async function · `GET /api/market/shops/{shop_id}/products/` | Products of one shop. |
| `create_product(shop_id, data, db, user)` | async function · `POST /api/market/shops/{shop_id}/products/` | Adds a product (at most 300 per shop). |
| `list_products(request, db, page)` | async function · `GET /api/market/products/` | Products of all approved shops; the shop filters (city, category, delivery) work here too. |
| `get_product(db, user, product_id)` | async function | A product whose shop the user may see, or 404. |
| `own_product(db, user, product_id)` | async function | A product of my shop (or any for editors), otherwise 403. |
| `product_detail(product_id, db, user)` | async function · `GET /api/market/products/{product_id}/` | A product with its shop. |
| `update_product / delete_product` | async function · `PATCH/DELETE /api/market/products/{product_id}/` | Change or delete a product (its photo is deleted too). |
| `upload_photo / remove_photo` | async function · `POST/DELETE /api/market/products/{product_id}/photo/` | The product photo (JPG, PNG, WEBP up to 3 MB). |
| `shop_reviews(shop_id, db, user, page)` | async function · `GET /api/market/shops/{shop_id}/reviews/` | Reviews of a shop, newest first. |
| `write_review / delete_review` | async function · `PUT/DELETE /api/market/shops/{shop_id}/reviews/mine/` | My review of an approved shop; an owner cannot review their own shop. |
| `remove_review(review_id, db, user)` | async function · `DELETE /api/market/reviews/{review_id}/` | Editors delete a bad review. |


### `app/routers/places.py`

**What it is for:** /api/places/: the directory of useful places (migration centers, clinics for the medical exam, notaries, translators, the embassy, mosques, Tajik cafes, halal shops, money transfers) with a map, ratings and reviews. Places come from OpenStreetMap; logged-in users may suggest new ones, which editors approve.

| Name | Kind | What it does |
|---|---|---|
| `place_json(place, avg, n, distance)` | function | — |
| `visible(query, user)` | function | Guests see approved places; a user also sees their own suggestions; editors see everything. |
| `filtered(query, request)` | function | Category, region, city, search and bbox filters. ?waiting=true — only places that are not approved (editors' «For checking» list). |
| `near(request)` | function | ?near=55.75,37.61 -> (lat, lon) to sort by distance. |
| `list_places(request, db, user, page)` | async function · `GET /api/places/` | Filters: category (one or several, comma-separated), region, city, search, bbox; near=lat,lon sorts by distance; ordering=rating or name (by default the best rated first). |
| `map_points(request, db, user)` | async function · `GET /api/places/map/` | Light points for the map (id, category, name, lat, lon), with the same filters as the list. |
| `summary(request, db, user)` | async function · `GET /api/places/summary/` | How many places of each category, and the regions with places (for the filters). |
| `get_place(db, user, place_id)` | async function | — |
| `place_detail(place_id, db, user)` | async function · `GET /api/places/{place_id}/` | — |
| `PlaceIn` | class | — |
| `suggest_place(request, db, user)` | async function · `POST /api/places/` | multipart form. A user suggests a place: lat/lon (pin on the map), a photo (jpg, png, webp; saved privately) and confirmed=true are required; at most 5 waiting suggestions per user. It is shown to everyone after an editor approves it (editors' places at once, photo optional). The form is read by hand because FastAPI does not unpack a form model next to a file. Editors get «New place for checking». |
| `with_check(data, place, user)` | function | For the author and editors adds reject_reason, has_proof and is_mine to the place JSON. |
| `tell_author(db, place)` | async function | Notification to the author: approved (it is on the map) or rejected with the reason. |
| `ModerateIn` | class | status approved / rejected and the reason (required to reject). |
| `place_proof(place_id, db, user)` | async function · `GET /api/places/{place_id}/proof/` | The private photo of a suggestion; only its author and editors. |
| `moderate_place(place_id, data, db, user)` | async function · `POST /api/places/{place_id}/moderate/` | Editor: approves (the place becomes public) or rejects with a reason, and tells the author. |
| `delete_place(place_id, db, user)` | async function · `DELETE /api/places/{place_id}/` | Editors delete any place; an author deletes their own place while it is not approved. Removes the photo. |
| `review_json(review, viewer)` | function | — |
| `ReviewIn` | class | — |
| `place_reviews(place_id, db, user, page)` | async function · `GET /api/places/{place_id}/reviews/` | — |
| `write_review(place_id, data, db, user)` | async function · `PUT /api/places/{place_id}/reviews/mine/` | My review of the place: written the first time, changed after that. The owner gets «New review on your shop» for the first review of each person. |
| `delete_review(place_id, db, user)` | async function · `DELETE /api/places/{place_id}/reviews/mine/` | — |

### `app/routers/rates.py`

**What it is for:** /api/rates/: the official rouble to somoni rate for the card on the home page.

| Name | Kind | What it does |
|---|---|---|
| `rates(db)` | async function · `GET /api/rates/` | The latest rate of each source and a 30-day history [{day, nbt, cbr}]. Fetches today's rate first if it is missing. |

### `app/routers/support.py`

**What it is for:** /api/help/: official places to get help (editors keep the list).

| Name | Kind | What it does |
|---|---|---|
| `ContactIn` | class | — |
| `ContactPatch` | class | — |
| `contact_json(c)` | function | — |
| `contacts_query(request, user)` | function | — |
| `check_contact(db, contact, data)` | async function | — |

### `app/routers/ws.py`

**What it is for:** Live notifications. Browsers can not send an Authorization header with a WebSocket, so the page passes its access token in the address: /ws/notifications/?token=<access token>. Without a valid token the connection is closed with code 4401, which the page understands as "get a fresh token and connect again".

| Name | Kind | What it does |
|---|---|---|
| `notifications_socket(socket, token)` | async function · `WEBSOCKET /ws/notifications/` | — |


---

## `app/services/` — business logic used by routers and background tasks

### `app/services/alerts.py`

**What it is for:** After an import: one notification per alert with the new jobs that match it.

| Name | Kind | What it does |
|---|---|---|
| `alert_filters(alert)` | function | The alert as query parameters of the jobs list (?search=...&city=...). |
| `notify_alerts(db, since)` | async function | Tells every alert about the jobs that appeared since this moment. Returns how many users were told. |

### `app/services/course.py`

**What it is for:** Reads the course content from app/seed/course/level1.json … level7.json (cached in memory) and keeps the course rules: 7 levels, 10 lessons each, 20 exam questions, 30 minutes, 80% to pass an exam, 60% to finish a lesson, 60 minutes before a new try. Each level file has title, title_ru, cefr, text, lessons (theory blocks with examples, words, exercises of type «choice» or «build») and exam (a pool of 25 questions). Lesson texts are in Tajik; there is no audio.

| Name | Kind | What it does |
|---|---|---|
| `level(number)` | function | The content of one level or None. |
| `levels()` | function | All levels in order. |
| `lesson(level, number)` | function | One lesson or None. |
| `exam_question(level, index)` | function | One question of the level's exam pool. |

### `app/services/emails.py`

**What it is for:** Emails (SMTP from .env): codes after sign-up and for a new password, and notifications. Without SMTP settings the letter is only printed in the console (development).

| Name | Kind | What it does |
|---|---|---|
| `build_message(subject, body, to)` | function | A plain-text email, kept like an ordinary personal one, because Gmail hides automatic-looking letters: plain text, and a Message-ID with the sender's own domain. |
| `send_plain(subject, body, to)` | async function | Sends the email through the SMTP server from .env (async). Without SMTP settings it is only printed. |
| `queue_email(subject, body, to)` | async function | Sends the email in the background (Celery). Without a queue (development), or when the queue itself is unreachable (Redis down), it is sent right here, so codes keep working. Raises OSError if SMTP fails then. |
| `send_code(db, email, purpose)` | async function | Makes a new code, saves its hash (replacing any older code for this email) and emails the code. |

### `app/services/feedback.py`

**What it is for:** Answering feedback, shared by the API and the admin panel.

| Name | Kind | What it does |
|---|---|---|
| `send_reply(db, feedback)` | async function | Marks the feedback done with the time of the reply and notifies the author (site + email). |
| `REPLY_TITLE` | const | Title of the reply notification. |

### `app/services/flights.py`

**What it is for:** Ticket prices between Tajikistan and Russia from Travelpayouts (Aviasales Data API v3, prices_for_dates). They are the cheapest prices other people found in the last days, cached by Aviasales; the button opens the search on aviasales.ru, where the ticket is bought. Our own cache keeps an answer for 30 minutes.

| Name | Kind | What it does |
|---|---|---|
| `FlightsUnavailable` | class | — |
| `enabled()` | function | — |
| `search_url(origin, destination, day)` | function | The search page on aviasales.ru: /search/DYU0112MOW1 = from DYU on 1 December to MOW, 1 passenger. |
| `_ticket(item)` | function | — |
| `_fetch(origin, destination, departure_at, direct, limit)` | async function | One request to prices_for_dates (limit up to 1000). |
| `prices(origin, destination, month, direct)` | async function | The one-way tickets of the month (or the nearest ones), cheapest first (up to 200, so every day has its flights), and the cheapest price of every day. |
| `_same_flight(ticket)` | function | What makes two tickets the same flight: airline, number, departure time, transfers. |
| `day_prices(origins, destinations, day, direct)` | async function | Tickets of one day from all airport pairs, asked at the same time; repeats keep the cheaper price; cached 30 minutes. |
| `check_watches(db, today)` | async function | Every day: tells users whose watched route got cheaper than their price. Returns how many were told. |

### `app/services/geocode.py`

**What it is for:** Address search for the shop location (works on computers without GPS): OpenStreetMap Nominatim, only Russia and Tajikistan, at most one request per second from the whole server (their usage rule), answers cached for 7 days.

| Name | Kind | What it does |
|---|---|---|
| `GeocodeUnavailable` | class | Nominatim did not answer. |
| `short_name(item)` | function | The first four parts of the address. |
| `search(query, lang)` | async function | Up to 6 places: name, full_name, lat, lon, kind. |


### `app/services/google.py`

**What it is for:** Checks Google's ID token (signature with Google's cached public keys, audience = GOOGLE_CLIENT_ID, issuer, email confirmed by Google).

| Name | Kind | What it does |
|---|---|---|
| `verify_google_token(credential)` | function | Returns the token's claims (email, name...) or None. Synchronous: the router calls it in a thread. |

### `app/services/housing_import.py`

**What it is for:** Imports housing listings from public Telegram rental channels (their open web pages t.me/s/…, no account needed) and keeps only real offers. Run by Celery at 07:20, 13:20 and 19:20 or by hand: python -m app.cli import-housing [--channel name] [--pages 4] [--no-photos].

| Name | Kind | What it does |
|---|---|---|
| `CHANNELS` | const | The channels and the city of each: «Без посредников» channels of Moscow, Kazan, Novosibirsk, Krasnodar, Samara, Nizhny Novgorod, Rostov, and city rental channels of Moscow, Saint Petersburg, Kazan, Novosibirsk, Yekaterinburg. |
| `FRESH_DAYS` / `KEEP_DAYS` | const | Only posts of the last 21 days are taken; imported listings older than 30 days are hidden. |
| `SEEKING`, `SPAM`, `UNFAIR` | const | Posts that are skipped: people looking for housing, ads of closed channels and the like, and listings that refuse migrants (only Slavs, only citizens of Russia, no foreigners…). |
| `parse_page(page, channel)` | function | The posts of one channel page: number, time, text, photo addresses. |
| `body(text)` | function | Cuts the channel's footer (links to its site and groups). |
| `find_price(text, daily)` | function | The price: after «Цена/Стоимость/Аренда…», before ₽/руб, or a number like «23 000»; «57.000», «24 тыс» are understood; only believable prices are kept. |
| `find_kind(text)` / `find_rooms(text, kind)` | function | Bed, hostel, flat or room, and the number of rooms. |
| `find_city(address, default)` | function | The city from «Адрес: …» (skips district and street parts); otherwise the channel's city. |
| `parse_post(post, default_city)` | function | A post → listing fields, or None if it is not a real offer: needs a price and a kind. Also metro, phone, WhatsApp, Telegram, registration, utilities included, no deposit, for whom, day or month, title, and the link to the original (the owner's page on bezposrednikov.ru or the Telegram post). |
| `fingerprint(data)` | function | City, price and the start of the text: the same listing posted twice is saved once. |
| `fetch_channel(client, channel, since, pages, pause)` | async function | Reads up to 4 pages back (?before=), a pause of 1 s between pages. |
| `save_photos(client, housing, urls)` | async function | Downloads up to 3 photos into media/housing/. |
| `save_post(db, client, post, data, counts, with_photos)` | async function | Saves a new listing as approved (source telegram, no owner); skips known posts and duplicates (same fingerprint, or same phone + price + city). |
| `expire_old(db)` | async function | Hides imported listings older than 30 days. |
| `import_housing(db, channels, pages, with_photos, pause, log, transport)` | async function | The whole import; returns the counts created / known / duplicates / skipped / failed / expired. |

### `app/services/live.py`

**What it is for:** Live notifications: every logged-in browser tab keeps a WebSocket open (/ws/notifications/?token=...). A new notification goes to all tabs of its user at once, so the bell updates without a reload. With several server processes (and the Celery worker, which makes reminders) the events travel through Redis (REDIS_URL): every process listens and delivers to the tabs connected to it. Without Redis it all stays in this process (development). A problem here must never break saving the notification itself, so errors are logged.

| Name | Kind | What it does |
|---|---|---|
| `Hub` | class | — |
| &nbsp;&nbsp;↳ `add(user_id, socket)` | method | — |
| &nbsp;&nbsp;↳ `remove(user_id, socket)` | method | — |
| &nbsp;&nbsp;↳ `deliver(user_id, message)` | method | — |
| &nbsp;&nbsp;↳ `publish(user_id, message)` | method | — |
| &nbsp;&nbsp;↳ `listen()` | method | Started with the app when REDIS_URL is set: delivers events from every process to this one's tabs. |
| `notification_json(n)` | function | — |
| `unread_count(db, user_id)` | async function | — |
| `push_new(db, notification)` | async function | — |
| `push_count(db, user_id)` | async function | After notifications were read or deleted: every open tab updates its bell. |

### `app/services/market.py`

**What it is for:** Shop helpers shared by the API and the admin panel: telling the owner about the editor's decision and deleting shop pictures.

| Name | Kind | What it does |
|---|---|---|
| `LOGOS, PHOTOS` | const | Folders for logos and product photos (MEDIA_ROOT); PROOFS — proofs (PRIVATE_MEDIA_ROOT). |
| `status_message(shop)` | function | Title and text of the notification (approved or rejected with the reason), in Tajik. |
| `tell_owner(db, shop)` | async function | Sends the notification (site, live and email) to the owner. |
| `shop_files(db, shop)` | async function | The logo, product photos and proofs of a shop, read before it is deleted. |
| `delete_files(files)` | async function | Deletes those files (proofs from private files). |


### `app/services/notify.py`

**What it is for:** One place that tells a user something: a notification in the app (live in open tabs), plus an email when they allow it.

| Name | Kind | What it does |
|---|---|---|
| `notify(db, user, title, message, kind)` | async function | Saves the notification, pushes it live to the user's open tabs and emails it if the user allows emails. Every notification of the site goes through here. |
| `WELCOME_TITLE` / `WELCOME_TEXT` | const | The welcome notification: what the site does and to add documents for reminders. |
| `PASSWORD_TITLE` / `PASSWORD_TEXT` | const | «Your password was changed — if it was not you, reset it». |
| `welcome(db, user)` | async function | Sends the welcome notification (after the email code or the first Google sign-in). |
| `notify_editors(db, title, message, skip)` | async function | The same notification to every active editor and admin (skip = the person who did it, if they are an editor). |

### `app/services/places.py`

**What it is for:** Real places from OpenStreetMap (© OpenStreetMap contributors, ODbL) through Overpass servers, for the 30 regions where most migrants live (`REGIONS`: name → ISO code such as `RU-TA`; the region is found by its ISO3166-2 code, so it does not depend on how its name is written in OSM) and 12 kinds of places (`SELECTORS`: migration, medical, notary, translation, embassy, mosque, food, halal, money, hostel, market, photo). Places are found again by their OSM id, so running the import again updates them. Places users suggested are never touched by the import.

| Name | Kind | What it does |
|---|---|---|
| `query(region, selector)` | function | The Overpass query for one search (one selector) inside one region. |
| `fetch_one(client, region, selector)` | async function | Asks the Overpass servers in turn, waiting longer after each busy answer (15, 60 s); returns the elements, or raises the last error. |
| `fetch(client, region, category, pause, log)` | async function | Runs every search of a category one by one (small queries pass the servers' time limits) and merges the results without duplicates; a failed search is logged and the others are still used. |
| `_clean(value, limit)` | function | One line of text without extra spaces, cut to the column's length. |
| `place_fields(element, region, category)` | function | The fields of a Place from an OSM element (name, address, coordinates, phone, website, hours); None when it has no name or position. |
| `save(db, element, region, category)` | async function | Creates the place or updates the one with the same OSM id; returns "created", "updated" or "skipped". |
| `import_places(db, regions, categories, pause, log)` | async function | The whole import: regions by name or ISO code (all 30 by default), every category; returns the counts. Run with `python -m app.cli import-places [--region RU-TA] [--category hostel]`; Celery runs it every Sunday at 03:00. |

### `app/services/rates.py`

**What it is for:** The official rouble to somoni rate from the National Bank of Tajikistan (nbt.tj, XML for a date) and the Central Bank of Russia (cbr.ru, XML_daily). The NBT file has broken bytes in some currency names, so both files are read with regular expressions instead of an XML parser.

| Name | Kind | What it does |
|---|---|---|
| `RatesUnavailable` | class | A bank did not answer or its file has no rouble/somoni rate. |
| `today()` | function | Today in Moscow time. |
| `number(text)` | function | "87,7162" or "0.1142" -> float. |
| `tag(block, name)` | function | The text of one tag inside a <Valute> block. |
| `valute(text, code)` | function | (value, nominal) of a currency code (RUB, TJS). |
| `shown_day(text, pattern)` | function | The date written in <ValCurs Date=...>. |
| `get_text(client, url, params)` | async function | Downloads a bank file as text. |
| `fetch_nbt(client, day)` | async function | NBT: somoni for 1 rouble (Value / Nominal). |
| `fetch_cbr(client, day)` | async function | CBR: roubles for 10 somoni, turned into somoni for 1 rouble (Nominal / Value). |
| `save_rate(db, source, day, value)` | async function | Adds or updates the row of that source and day. |
| `update_rates(db, day)` | async function | Fetches both banks and saves the answers; a bank that is down or gives an odd value is skipped. Returns {source: value}. |
| `ensure_fresh(db)` | async function | Fetches today's rate if a source is missing for today; after a failure waits 30 minutes before trying again. |
| `history(db, days)` | async function | The rates of the last 30 days by day. |
| `latest(db)` | async function | The newest row of each source: {value, day, fetched_at}. |

### `app/services/reminders.py`

**What it is for:** Daily reminders about documents that are about to expire (notification + email).

| Name | Kind | What it does |
|---|---|---|
| `reminder_text(document, days)` | function | The reminder text: in N days, tomorrow, or «expired today» (days = 0). |
| `send_due_reminders(db, today)` | async function | Sends today's reminders: on the day the owner chose (remind_days_before) and the day before the end. Safe to run many times a day: ReminderLog remembers what was already sent. Returns how many were sent. Also on the expiry day itself («expired today»). |

### `app/services/trudvsem.py`

**What it is for:** Real job ads from «Работа России» (trudvsem.ru), the state job portal. Its ads are open data with a free API (no key): https://opendata.trudvsem.ru/api/v1/vacancies/region/<code>?text=...&offset=<page>&limit=<n> We import the jobs migrants usually look for, in the regions where most of them work. Ads of recruitment agencies are skipped (a common way to cheat migrants), and contact persons' names and phones are not copied: people apply on the source page (external_url).

| Name | Kind | What it does |
|---|---|---|
| `fetch(client, region, text, limit)` | async function | — |
| `clean(text)` | function | — |
| `city_of(region_name)` | function | — |
| `money(value)` | function | — |
| `has(text)` | function | — |
| `save(db, vacancy, industry)` | async function | — |
| `import_jobs(db, regions, limit, pause, log)` | async function | — |
| `import_one(db, client, region, industry, word, limit, counts, log)` | async function | — |


---

## `app/assistant/` — the AI assistant

### `app/assistant/knowledge.py`

**What it is for:** What the AI assistant is told: who it is, how to behave, and how the site is built (pages and what they do). It tells the model its name is Ошно.

| Name | Kind | What it does |
|---|---|---|
| `system_prompt()` | function | — |

### `app/assistant/providers.py`

**What it is for:** The AI models behind the assistant (the same design as in the Django version, but async). Google Gemini is used when GEMINI_API_KEY is set (it has a free tier), otherwise Claude with ANTHROPIC_API_KEY. Both get the same instructions and can call the same tools (open a page, patent prices, guides, jobs, my documents).

| Name | Kind | What it does |
|---|---|---|
| `AssistantError` | class | — |
| `active_provider()` | function | — |
| `Run` | class | One answer: the database, who is asking (for "my documents") and the page the assistant decided to open. |
| &nbsp;&nbsp;↳ `tool(name, tool_input)` | method | — |
| `ask(db, system_text, visitor_note, messages, user)` | async function | messages: [{"role": "user" \| "assistant", "content": text}], the last one from the user. Returns {"reply": text, "navigate": path \| None, "refused": bool, "truncated": bool}; raises AssistantError. |
| `_rest(model)` | function | — |
| `_is_resting(model)` | function | — |
| `_ask_gemini(system_text, visitor_note, messages, run)` | async function | — |
| `_gemini_answer(client, model, config, contents, types, run)` | async function | One model answers, calling tools as it needs; API errors are left to the caller. |
| `_ask_claude(system_text, visitor_note, messages, run)` | async function | — |

### `app/assistant/tools.py`

**What it is for:** Tools the assistant can call: open a page of the site, and look up patent prices, guides, vacancies and the visitor's own documents. Every tool returns plain data; the model writes the answer.

| Name | Kind | What it does |
|---|---|---|
| `_navigate(db, args)` | async function | — |
| `_patent_price(db, args)` | async function | — |
| `_guide_steps(db, args)` | async function | — |
| `_find_jobs(db, args)` | async function | — |
| `_find_places(db, args)` | async function | — |
| `_airports(db)` | async function | — |
| `_flight_prices(db, args)` | async function | — |
| `_my_documents(db, user)` | async function | — |
| `run_tool(db, name, tool_input, user)` | async function | Runs a tool and returns (text for the model, is_error, path to open or None). |


---

## `app/admin/` — the admin panel (SQLAdmin, `/admin/`)

### `app/admin/__init__.py`

**What it is for:** The admin panel at /admin/ (SQLAdmin). Log in with the email and password of an editor or admin. Admins see everything. Editors see only the site's content: news, guides, exam questions, help sites, centers and patent prices (document types they may only edit). Users, their documents and payments, jobs and companies stay hidden from editors. The start page shows the site's numbers (for admins).

| Name | Kind | What it does |
|---|---|---|
| `StaffLogin` | class | — |
| &nbsp;&nbsp;↳ `login(request)` | method | — |
| &nbsp;&nbsp;↳ `logout(request)` | method | — |
| &nbsp;&nbsp;↳ `authenticate(request)` | method | — |
| &nbsp;&nbsp;↳ `get_user_id(request)` | method | — |
| `RoleAccess` | class | Admins may do everything; editors only what EDITOR_VIEWS gives them on content. |
| &nbsp;&nbsp;↳ `has_permission(request, identity, action, obj)` | method | — |
| `stats()` | async function | — |
| `MuhojirAdmin` | class | — |
| &nbsp;&nbsp;↳ `index(request)` | method | — |
| `setup_admin(app)` | function | — |

### `app/admin/views.py`

**What it is for:** The lists and forms of the admin panel. EDITOR_VIEWS says what editors may do in each; admins may do all.

| Name | Kind | What it does |
|---|---|---|
| `Base` | class | — |
| `DeletesPrivateFiles` | class | Deleting a user, a document or a payment here also deletes its private files (photos, receipts). |
| &nbsp;&nbsp;↳ `on_model_delete(model, request)` | method | — |
| &nbsp;&nbsp;↳ `after_model_delete(model, request)` | method | — |
| `UserAdmin` | class | — |
| &nbsp;&nbsp;↳ `scaffold_form(rules)` | method | — |
| &nbsp;&nbsp;↳ `on_model_change(data, model, is_created, request)` | method | — |
| `NotificationAdmin` | class | — |
| &nbsp;&nbsp;↳ `after_model_change(data, model, is_created, request)` | method | — |
| `EmailCodeAdmin` | class | — |
| `DocumentTypeAdmin` | class | — |
| `GuideStepAdmin` | class | — |
| `RegionAdmin` | class | — |
| `MigrationCenterAdmin` | class | — |
| `LawNewsAdmin` | class | — |
| &nbsp;&nbsp;↳ `on_model_change(data, model, is_created, request)` | method | — |
| `ExamQuestionAdmin` | class | — |
| &nbsp;&nbsp;↳ `on_model_change(data, model, is_created, request)` | method | — |
| `UserDocumentAdmin` | class | — |
| `PaymentAdmin` | class | — |
| `ReminderLogAdmin` | class | — |
| `EmployerAdmin` | class | — |
| `JobAdmin` | class | — |
| `EmployerReviewAdmin` | class | — |
| `BlacklistReportAdmin` | class | — |
| &nbsp;&nbsp;↳ `after_model_delete(model, request)` | method | — |
| `JobAlertAdmin` | class | — |
| `SavedJobAdmin` | class | — |
| `HelpContactAdmin` | class | — |
| &nbsp;&nbsp;↳ `on_model_change(data, model, is_created, request)` | method | — |
| &nbsp;&nbsp;↳ `after_model_change(data, model, is_created, request)` | method | — |
| `PlaceAdmin` | class | Places on the map. Approving (is_approved) or writing a new reject_reason notifies the author; deleting removes the private photo. |
| `PlaceReviewAdmin` | class | — |
| `AirportAdmin` | class | — |
| `FlightWatchAdmin` | class | — |
| `ShopAdmin` | class | Shops: approve or reject (a reason is required); the owner is notified; deleting removes the pictures. |
| `ProductAdmin` | class | Products of the shops. |
| `ShopReviewAdmin` | class | Shop reviews (delete only). |
| `ExchangeRateAdmin` | class | Official rates (view only). |
| `FeedbackAdmin` | class | Feedback: editors set the status and write a reply; a new reply notifies the author. |
| `HousingAdmin` | class | Housing listings: editors approve or reject (a reason is required), change or delete; the owner is notified, photo files are deleted with the listing. |


---

## `app/admin/templates/` — admin panel pages

### `app/admin/templates/dashboard.html`

**What it is for:** The start page of the admin panel (/admin): site statistics and a warning when the job import is late.


---

## `alembic/` — database migrations

### `alembic/env.py`

**What it is for:** Alembic's runner: connects to DATABASE_URL (async) and applies the migrations in alembic/versions.

| Name | Kind | What it does |
|---|---|---|
| `run_migrations_offline()` | function | Run migrations in 'offline' mode. This configures the context with just a URL and not an Engine, though an Engine is acceptable here as well. By skipping the Engine creation we don't even need a DBAPI to be available. Calls to context.execute() here emit the given string to the script output. |
| `do_run_migrations(connection)` | function | — |
| `run_async_migrations()` | async function | In this scenario we need to create an Engine and associate a connection with the context. |
| `run_migrations_online()` | function | Run migrations in 'online' mode. |


---

## `alembic/versions/` — the migrations, in order

### `alembic/versions/0001_tables.py`

**What it is for:** The tables. Revision ID: 0001 Revises: Create Date: 2026-10-21 16:51:05.450766

| Name | Kind | What it does |
|---|---|---|
| `upgrade()` | function | Upgrade schema. |
| `downgrade()` | function | Downgrade schema. |

### `alembic/versions/0002_content.py`

**What it is for:** The site's real content, so a new database is ready at once: the 5 document types with their step-by-step guides, the 2026 patent prices of every region, migration centers, law news, 100 exam questions and the official help sites. The data is in app/seed/*.json (exported from the Django version of Muhojir). Revision ID: 0002 Revises: 0001

| Name | Kind | What it does |
|---|---|---|
| `load(name)` | function | — |
| `when(value)` | function | — |
| `upgrade()` | function | — |
| `downgrade()` | function | — |

### `alembic/versions/0003_travel_and_places.py`

**What it is for:** Air tickets (airports, price alerts) and the places directory (places, reviews), with the airports. Revision ID: 0003 Revises: 0002 Create Date: 2026-10-21 18:55:59.080394

| Name | Kind | What it does |
|---|---|---|
| `upgrade()` | function | Upgrade schema. |
| `seed_airports()` | function | — |
| `downgrade()` | function | Downgrade schema. |

### `alembic/versions/0004_blacklist_reports.py`

**What it is for:** Workers put companies on the blacklist themselves: blacklist_reports and employers.reports_count. Revision ID: 0004 Revises: 0003 Create Date: 2026-10-26 12:50:00

| Name | Kind | What it does |
|---|---|---|
| `upgrade()` | function | — |
| `downgrade()` | function | — |

### `alembic/versions/0005_user_avatar.py`

**What it is for:** Profile photos: users.avatar. Revision ID: 0005 Revises: 0004 Create Date: 2026-10-26 13:00:00

| Name | Kind | What it does |
|---|---|---|
| `upgrade()` | function | — |
| `downgrade()` | function | — |

### `alembic/versions/0006_market.py`

**What it is for:** Shops: tables shops, products, shop_reviews. Revision ID: 0006 Revises: 0005

| Name | Kind | What it does |
|---|---|---|
| `upgrade()` | function | Creates the three tables and their indexes. |
| `downgrade()` | function | Drops them. |

### `alembic/versions/0007_shop_proofs.py`

**What it is for:** Shop proofs: table shop_proofs; shops.origin is removed (only Tajik shops). Revision ID: 0007 Revises: 0006

| Name | Kind | What it does |
|---|---|---|
| `upgrade()` | function | Creates shop_proofs and drops shops.origin. |
| `downgrade()` | function | Brings origin back (as tj) and drops shop_proofs. |


### `alembic/versions/0008_place_proof.py`

**What it is for:** Proof of a suggested place: places.proof (private photo) and places.reject_reason. Revision ID: 0008 Revises: 0007

| Name | Kind | What it does |
|---|---|---|
| `upgrade()` | function | Adds the two columns. |
| `downgrade()` | function | Drops them. |

### `alembic/versions/0009_drop_legal_questions.py`

**What it is for:** Removes the «questions to a lawyer» feature: drops the table legal_questions. Revision ID: 0009 Revises: 0008

| Name | Kind | What it does |
|---|---|---|
| `upgrade()` | function | Drops legal_questions. |
| `downgrade()` | function | Creates it again (empty). |

### `alembic/versions/0010_course.py`

**What it is for:** Tables of the Russian course: lesson_progress, exam_attempts and certificates. Revision ID: 0010 Revises: 0009

| Name | Kind | What it does |
|---|---|---|
| `upgrade()` | function | Creates the three tables. |
| `downgrade()` | function | Drops them. |

### `alembic/versions/0011_exchange_rates.py`

**What it is for:** Table exchange_rates (official rouble to somoni rate). Revision ID: 0011 Revises: 0010

| Name | Kind | What it does |
|---|---|---|
| `upgrade()` | function | Creates the table. |
| `downgrade()` | function | Drops it. |

### `alembic/versions/0012_feedback.py`

**What it is for:** Table feedback. Revision ID: 0012 Revises: 0011

| Name | Kind | What it does |
|---|---|---|
| `upgrade()` | function | Creates the table. |
| `downgrade()` | function | Drops it. |

### `alembic/versions/0013_feedback_photo.py`

**What it is for:** Column feedback.photo. Revision ID: 0013 Revises: 0012

| Name | Kind | What it does |
|---|---|---|
| `upgrade()` | function | Adds the column. |
| `downgrade()` | function | Drops it. |

### `alembic/versions/0014_housing.py`

**What it is for:** Tables housing and housing_photos. Revision ID: 0014 Revises: 0013

| Name | Kind | What it does |
|---|---|---|
| `upgrade()` | function | Creates the tables. |
| `downgrade()` | function | Drops them. |

---

## `tests/` — automated tests (pytest)

### `tests/conftest.py`

**What it is for:** Every test run gets its own SQLite database, made by the real migrations (so the seeded content is there: document types, guides, 83 regions, news, 100 exam questions). Email is not sent; codes are read from the outbox.

| Name | Kind | What it does |
|---|---|---|
| `database()` | function | — |
| `outbox(monkeypatch)` | function | Letters go here instead of SMTP; the throttle counters start empty for every test. |
| `client()` | async function | — |
| `last_code(email)` | function | — |
| `user(client)` | async function | A new confirmed migrant; returns (headers, data). |
| `set_role(user_id, role)` | async function | — |

### `tests/test_assistant.py`

**What it is for:** Tests of the AI assistant API (without real model keys).

| Name | Kind | What it does |
|---|---|---|
| `test_guests_cannot_chat(client)` | async function | Guests get 401. |
| `test_not_configured(client)` | async function | — |
| `test_last_message_must_be_from_user(client)` | async function | — |
| `test_tools()` | async function | — |
| `test_answer_opens_a_page(client, monkeypatch)` | async function | — |

### `tests/test_auth.py`

**What it is for:** Tests of sign-up, login, tokens, passwords, profile, throttling and the profile photo.

| Name | Kind | What it does |
|---|---|---|
| `test_signup_login_and_tokens(client, outbox)` | async function | — |
| `test_password_rules_and_code_format(client)` | async function | — |
| `test_forgot_and_reset_password(client, user, outbox)` | async function | — |
| `test_profile(client, user)` | async function | — |
| `test_login_is_throttled(client)` | async function | — |
| `test_avatar(client, user)` | async function | — |

### `tests/test_course.py`

**What it is for:** Tests of the course: every level file is complete, lessons open one by one, scores, level exams, waiting after a failed exam, the single certificate after all 7 levels and its public check.


### `tests/test_feedback.py`

**What it is for:** Tests of feedback.

| Name | Kind | What it does |
|---|---|---|
| `register(client, email, name)` | async function | A new confirmed user, returns the auth header. |
| `test_only_logged_in_users_send_feedback(client)` | async function | Guests get 401. |
| `test_feedback_with_a_photo_is_seen_only_by_the_sender_and_editors(client, user)` | async function | A non-photo file is refused; feedback with a photo is saved from a form; the author and editors open the photo, a stranger gets 404; JSON without a photo still works. |
| `test_feedback_reaches_editors_and_the_reply_comes_back(client, user)` | async function | Too short is refused; editors are notified; only editors see the list (with email and page); a reply marks it done and notifies the author; /mine/ shows the reply. |

### `tests/test_google.py`

**What it is for:** Tests of sign in with Google (Google's check is replaced by a fake).

| Name | Kind | What it does |
|---|---|---|
| `test_client_id_is_public(client, google)` | async function | GET google/ returns the client ID. |
| `test_new_user_is_created(client, google)` | async function | A new email makes an account without a password; the second sign-in finds the same account. |
| `test_unconfirmed_account_is_taken_over_without_old_password(client, google)` | async function | An unconfirmed account gets confirmed and its old password stops working. |
| `test_confirmed_account_keeps_its_password(client, google)` | async function | A confirmed account still logs in with its password. |
| `test_bad_token(client, google)` | async function | A token Google does not accept = 400. |
| `test_not_set_up(client, monkeypatch)` | async function | Without GOOGLE_CLIENT_ID = 503. |
| `test_verify_rejects_unverified_email(monkeypatch)` | function | An email Google has not confirmed is refused; the audience is GOOGLE_CLIENT_ID. |

### `tests/test_documents.py`

**What it is for:** Tests of seeded content, user documents with photos and payments, editors' rights and reminders.

| Name | Kind | What it does |
|---|---|---|
| `test_public_content_is_seeded(client)` | async function | — |
| `test_my_documents_photos_and_payments(client, user)` | async function | — |
| `other_user(client)` | async function | — |
| `test_editors_change_content(client, user)` | async function | — |
| `test_reminders_are_sent_once(client, user, outbox)` | async function | — |

### `tests/test_housing.py`

**What it is for:** Tests of housing listings.

| Name | Kind | What it does |
|---|---|---|
| `test_a_listing_is_shown_only_after_an_editor_approves_it(client, user)` | async function | A listing without contacts is refused; a new one waits for checking and editors are notified; only editors moderate, rejection needs a reason; after approval the owner is notified and everyone sees it; is_active=false hides it; a real change sends it back to checking. |
| `test_filters_search_and_ordering(client, user)` | async function | City, kind, search by metro, for whom (with «any»), price limits, registration, utilities, no deposit, ordering by price, a wrong number gives 400; the summary counts kinds and cities. |
| `test_photos_only_the_owner_adds_and_removes(client, user)` | async function | Not a photo is refused; the owner adds and removes photos, a stranger gets 403; ?with_photos= works; only the owner deletes the listing. |

### `tests/test_jobs.py`

**What it is for:** Tests of job filters, saved jobs, reviews, alerts and the workers' blacklist.

| Name | Kind | What it does |
|---|---|---|
| `make_jobs()` | async function | — |
| `test_jobs_filters_saved_reviews_alerts(client, user)` | async function | — |
| `test_blacklist_reports(client, user)` | async function | — |

### `tests/test_market.py`

**What it is for:** Tests of the shops section.

| Name | Kind | What it does |
|---|---|---|
| `sign_up(client, email)` | async function | A second confirmed user; returns (headers, id). |
| `test_shop_moderation_products_reviews(client, user)` | async function | Contacts check, draft hidden, proofs (wrong kind, wrong file, private), location required, submit, reject -> fix -> submit -> approve with notifications, filters, reviews, deleting. |
| `test_shop_limit_and_strangers(client, user)` | async function | At most 3 shops; another user cannot change my shop. |
| `test_geocode(client, user, monkeypatch)` | async function | Address search: login, short query, result format, cache, service down. |


### `tests/test_notifications.py`

**What it is for:** Tests of the notifications that are not part of one section.

| Name | Kind | What it does |
|---|---|---|
| `titles(user_id)` | async function | Titles of a user's notifications. |
| `test_welcome_after_the_email_is_confirmed(client, user)` | async function | Exactly one welcome after sign-up. |
| `test_password_change_is_reported(client, user)` | async function | Reset password -> «Your password was changed». |
| `test_document_expired_today(client, user)` | async function | A document ending today gets the «expired today» reminder. |
| `test_editors_hear_about_new_shops_and_places_and_owners_about_reviews(client, user)` | async function | Editors hear about a submitted shop, a suggested place and a moved shop; the owner hears about the first review only. |

### `tests/test_rates.py`

**What it is for:** Tests of the official rate with fake NBT and CBR files.

| Name | Kind | What it does |
|---|---|---|
| `fake_banks(monkeypatch, answer)` | function | — |
| `banks(monkeypatch)` | function | A fake NBT (with broken bytes, like the real one) and CBR answer. |
| `test_rates_are_fetched_once_and_kept(client, banks)` | async function | Both rates are read and saved; the second request does not ask the banks again. |
| `test_rates_do_not_break_when_banks_are_down(monkeypatch)` | async function | Banks are down: nothing is saved and nothing breaks. |

### `tests/test_travel.py`

**What it is for:** Tests of airports, ticket prices (with a fake Aviasales API) and price alerts.

| Name | Kind | What it does |
|---|---|---|
| `aviasales(monkeypatch)` | function | A fake Aviasales API: three tickets DYU→MOW, two of them on the same day. |
| `test_airports(client)` | async function | — |
| `test_prices_without_token_give_search_link(client)` | async function | — |
| `test_prices_only_between_tajikistan_and_russia(client)` | async function | — |
| `test_prices_with_token(client, aviasales)` | async function | — |
| `test_price_watch_tells_once(client, user, aviasales)` | async function | — |
| `add_places()` | async function | — |
| `test_places_filters_map_and_reviews(client, user)` | async function | — |
| `test_suggested_place_needs_proof_and_an_editor(client, user)` | async function | A suggestion needs a pin, the confirmation and a photo; it is hidden until an editor approves it; the photo is seen only by the author and editors; reject needs a reason; the author gets notifications. |
| `test_assistant_tools_for_travel()` | async function | — |
| `test_day_search_asks_every_airport_and_merges(client, monkeypatch)` | async function | The day search asks every airport (10 requests for DYU→Moscow), drops other days, merges repeats, sorts by price and caches. |


---

## `deploy/` — putting the site on the server

### `deploy/muhojir-api-celery.service`

**What it is for:** systemd unit: runs the Celery worker (background jobs: emails, imports, reminders).

### `deploy/muhojir-api-celerybeat.service`

**What it is for:** systemd unit: runs Celery beat, the scheduler that starts the daily/periodic tasks.

### `deploy/muhojir-api.service`

**What it is for:** systemd unit: runs the FastAPI app (uvicorn) on the server as user romin.

### `deploy/nginx-muhojir-api-site.conf`

**What it is for:** Muhojir (FastAPI) site (installed as /etc/nginx/snippets/muhojir-api-site.conf). The React site from frontend/dist; the API, admin, API docs and live notifications from uvicorn (127.0.0.1:8071). /index.html is sent with Cache-Control: no-cache, so browsers always ask the server whether the site changed.

### `deploy/setup.sh`

**What it is for:** Installs Muhojir (FastAPI) on the server, or brings an installed copy up to date; safe to run again. Run as root after cloning the project to /home/romin/muhojir-api: bash /home/romin/muhojir-api/deploy/setup.sh What runs where: nginx https://king.tj and http://IP:8070 → React site (frontend/dist), /media → /api /admin /swagger /redoc and the WebSocket /ws/ → uvicorn 127.0.0.1:8071 (2 workers) The workers share live notifications and the request limits through Redis (database 15). Celery worker sends the emails in the background and runs the daily jobs; Celery Beat starts them every day (06:00 new vacancies, 06:30 document reminders). Their queue is Redis database 15 too. king.tj belonged to the old Django Muhojir: this script takes the domain from it (the old one stays on :8040 only). Other projects on this server (Rohat 8030, others) are not touched.

### `deploy/update.sh`

**What it is for:** Updates Muhojir (FastAPI) on the server to the latest code (main). Run as root: bash /home/romin/muhojir-api/deploy/update.sh With the site built on a laptop and uploaded to frontend/dist: SKIP_BUILD=1 bash .../update.sh


---

## Frontend — the React site (`frontend/`)

### `frontend/index.html`

**What it is for:** The site's only HTML page: title and description for Google and link previews in Telegram/WhatsApp, icon, PWA manifest, the dark theme before the first paint, and the place for React (`#root`).

### `frontend/postcss.config.js`

**What it is for:** PostCSS setup for the build: Tailwind CSS and autoprefixer.

### `frontend/tailwind.config.js`

**What it is for:** Tailwind CSS setup: the design colors (Material-style tokens), fonts, text sizes and dark mode.

### `frontend/vite.config.js`

**What it is for:** Vite setup: React plugin, dev server port 5175 and the /api, /media, /ws proxy to FastAPI on :8002.


---

## `frontend/scripts/`

### `frontend/scripts/api.mjs`

**What it is for:** Starts the FastAPI dev server (uvicorn, port 8002) with the project's virtualenv; used by `npm run dev`.


---

## `frontend/public/` — files served as they are

### `frontend/public/manifest.webmanifest`

**What it is for:** Web app manifest: name, icons and colors, so the site can be installed on a phone like an app.

### `frontend/public/robots.txt`

**What it is for:** Search engines may read the public pages; personal pages and the API are closed.

### `frontend/public/sitemap.xml`

**What it is for:** The public pages of Muhojir, for Google and Yandex.

### `frontend/public/sw.js`

**What it is for:** The service worker: keeps pages and the user's data for offline use (network first for data, cache first for files). Pages (navigations) are always fetched past the browser cache (cache: no-cache), so a new build is picked up at once; VERSION is muhojir-v6.

| Name | Kind | What it does |
|---|---|---|
| `VERSION` | const | The service worker: lets the site open without internet. Offline: pages and their files are kept after the first visit; the user's own data (documents, payments, profile) and the guides are taken from the network when there is one and from the copy when there is not. On logout the page asks to forget the user's data (message "clear-user-data"). |
| `OFFLINE_API` | const | API lists kept for offline reading (GET only). Photos and receipts are not kept. |
| `networkFirst` | function | — |
| `cacheFirst` | function | — |


---

## `frontend/src/` — app core: routing, API, login, languages, helpers

### `frontend/src/App.jsx`

**What it is for:** All routes of the site (react-router); every page except Home/Login is loaded lazily; private pages need a login. Since 2026-10-29 almost every page needs login (Private): only the home page, /login and the certificate pages (/certificates/sample, /certificates/:code, opened from the QR code) are open to guests; a guest is sent to /login and comes back to the same page after logging in.

| Name | Kind | What it does |
|---|---|---|
| `BlacklistPage` | const | Every other page is downloaded only when it is opened, so the first visit on a slow phone is lighter. |
| `Private` | function | Pages that need a login. |
| `App` | export function | — |

### `frontend/src/api.js`

**What it is for:** Talks to the FastAPI server: adds the JWT token, refreshes it once when it expires, turns errors into Error objects with .status and .data.

| Name | Kind | What it does |
|---|---|---|
| `API` | const | API calls to the FastAPI server with JWT tokens. Tokens are stored in localStorage. |
| `store` | function | — |
| `tokens` | export const | — |
| `onLogout` | const | Called when tokens are no longer valid, so the app can show the user as logged out. |
| `setLogoutHandler` | export function | — |
| `refreshing` | const | A refresh token works only once (the server gives a new one and blocks the old), so when several requests find the access token expired at the same moment they all wait for one refresh instead of each sending theirs. |
| `refreshAccessToken` | function | — |
| `SERVER_MESSAGES` | const | The server answers in English; these are the messages people can meet, in Tajik (t() translates them when shown). |
| `errorText` | export function | — |
| `api` | export function | api("/jobs/jobs/") or api("/documents/my-documents/", { method: "POST", body: {...} }). body is sent as JSON, or as it is when it is FormData (for files: photos, receipts). raw: true returns the Response itself (for downloading files). |
| `apiAll` | export function | Every list endpoint is paginated ({count, results}); this reads all pages (for short lists like regions). |
| `openPrivateFile` | export function | Private files (document photos, receipts) need the login token, so a plain <a href> can not open them. This downloads the file and opens it in a new tab. |
| `fileProblem` | export function | Checks a chosen file before uploading: the same limits as the server (jpg, png, webp, pdf; 10 MB). |

### `frontend/src/auth.jsx`

**What it is for:** Login state for the whole app (AuthProvider / useAuth): the current user, login, logout, reload.

| Name | Kind | What it does |
|---|---|---|
| `AuthProvider` | export function | — |
| `useAuth` | export function | — |

### `frontend/src/constants.js`

**What it is for:** Shared lists: job industries with their icons and labels.

| Name | Kind | What it does |
|---|---|---|
| `INDUSTRIES` | export const | Same keys as INDUSTRIES in jobs/models.py. |
| `industry` | export const | — |
| `SHOP_CATEGORIES, shopCategory` | export const | Kinds of shops with icons (same keys as app/models/market.py). |
| `UNITS, unitLabel` | export const | Units of a price. |
| `CITIES` | export const | Big cities for the city suggestions. |

### `frontend/src/format.js`

**What it is for:** Formatting helpers: numbers, rubles, salaries, dates, "N days ago", days left.

| Name | Kind | What it does |
|---|---|---|
| `num` | export function | 8500 -> "8 500" |
| `rub` | export function | — |
| `salary` | export function | — |
| `date` | export function | "2026-10-28" or an ISO datetime -> "28.10.2026" |
| `ago` | export function | — |
| `daysText` | export function | — |
| `usedPercent` | export function | Share of the document's life already used, 0-100 (for progress bars). Without an issue date: unknown. |
| `monthTitle` | export function | "2026-10" -> "Октябр 2026" (Tajik month names are not built into browsers, so they are listed here). |
| `todayTitle` | export function | "Панҷшанбе, 1 октябр" — today's date for the greeting banner. |

### `frontend/src/hooks.js`

**What it is for:** Data hooks: useApi (load one API path) and useDocuments (everything for the documents screens).

| Name | Kind | What it does |
|---|---|---|
| `useApi` | export function | const { data, error, loading, reload } = useApi("/jobs/jobs/"). Pass null as the path to skip loading. |
| `useScrollLock(active)` | export function | While active the page behind a menu or drawer cannot scroll (also on iPhone: the body is fixed at its place); the scroll position comes back on close. Several open at once are counted. |
| `useDocuments` | export function | Loads everything the documents screens need: the user's documents, document types and regions. |

### `frontend/src/i18n.js`

**What it is for:** Languages: the site is written in Tajik, t() gives the Russian text from translations.js when Russian is chosen.

| Name | Kind | What it does |
|---|---|---|
| `saved` | const | The site is written in Tajik. t("Тоҷикӣ матн") returns the Russian translation when Russian is chosen, and the Tajik text itself otherwise (also when a translation is missing). {0}, {1} are filled in from args. Changing the language does not reload the page: App re-renders everything with useLang(), so text must be translated while rendering — not once when a file loads (lists of labels use getters, see constants.js). |
| `lang` | export const | — |
| `t` | export function | — |
| `setLang` | export function | — |
| `useLang` | export function | The current language; the component re-renders when it changes. |

### `frontend/src/index.css`

**What it is for:** Muhojir's design: minimal and calm. Warm milky paper by day, deep blue for the main actions and dark blocks, one blue accent, hairline borders instead of shadows; the red, white and green of the flag only as a thin line on top. Colors are RGB channels, so Tailwind can add opacity; html.dark switches to the night set (deep blue, not black). On phones every field is at least 16px. Scrollbars are hidden everywhere (scrolling still works). Page dividers are flag stripes: .flag-border-t / .flag-border-b draw a 3px red-white-green line instead of a border (--flag-pad adds space under it).

### `frontend/src/live.js`

**What it is for:** Live notifications: one WebSocket per tab while logged in, unread counter updates and toasts.

| Name | Kind | What it does |
|---|---|---|
| `NOT_LOGGED_IN` | const | Live notifications: one WebSocket per tab while the user is logged in (server: accounts/consumers.py). It reconnects by itself (a little later each time) after the internet or the server was gone, and when the access token has expired (close code 4401) it first gets a fresh one. Pages that show notifications listen for the "muhojir:notification" window event to reload. |
| `LIVE_EVENT` | export const | — |
| `useLiveNotifications` | export function | — |

### `frontend/src/main.jsx`

**What it is for:** The entry point: mounts <App/> with the router, auth, install and motion providers, registers the service worker.

### `frontend/src/pwa.js`

**What it is for:** The site as a phone app: the service worker (public/sw.js) and "install on the phone".

| Name | Kind | What it does |
|---|---|---|
| `registerServiceWorker` | export function | Only in the built site: in development the service worker would keep old files while the code changes. |
| `CHECK_EVERY` | const | How often an open app looks for a new version: every 10 minutes. |
| `loadedBuild` | const | The file name of the site's main script on this page (/assets/index-<hash>.js); the hash changes with every build. |
| `newBuildOnServer` | async function | Downloads /index.html without any cache and compares its main script with the loaded one. |
| `useAppUpdate` | export function | Keeps the installed app fresh: when the app is opened again from the background and there is a new version, it reloads by itself; while the app is being used it checks every 10 minutes and returns {ready, apply} for the "new version" bar in Layout. Also asks the service worker to update. Only in the built site. |
| `clearUserData` | export function | After logout (or a login as someone else) the saved copies of the user's own data are forgotten. |
| `installEvent` | const | Chrome on Android offers installing through this event; it comes once, so it is caught early and kept. |
| `isIOS` | export const | — |
| `useInstall` | export function | {installed, canInstall, install()}: canInstall is true where the browser can install it with one button. |
| `useOnline` | export function | — |

### `frontend/src/speech.js`

**What it is for:** Reads Russian text aloud with the browser's voice (only the patent exam practice uses it; the course has no audio).

| Name | Kind | What it does |
|---|---|---|
| `canSpeak` | const | Whether the browser can speak. |
| `speak(text, rate)` | function | Says the text in Russian. |
| `hush()` | function | Stops speaking. |

### `frontend/src/theme.js`

**What it is for:** Light / dark theme: reading, switching and remembering it.

| Name | Kind | What it does |
|---|---|---|
| `isDark` | const | Light / dark theme. index.html already set html.dark before the first paint; this keeps it in sync. |
| `useIsDark` | export function | Only reads the theme and follows it when it changes anywhere (e.g. the map, which draws its own colors). |
| `applyTheme` | function | Puts a theme on the page; remember: true also saves it as the user's own choice. |
| `useTheme` | export function | Every switch on the site (header, phone menu, profile) shares the one theme on <html>, so they never disagree. |

### `frontend/src/translations.js`

**What it is for:** The Russian translation of every Tajik text on the site (key = Tajik text, value = Russian).


---

## `frontend/src/components/` — reusable parts of pages

### `frontend/src/components/Assistant.jsx`

**What it is for:** The AI assistant chat in the corner of every page (answers about migration, can open site pages). The assistant is called Ошно (Oshno, "friend"). Guests see a «log in» button instead of the chat.

| Name | Kind | What it does |
|---|---|---|
| `STORE` | const | The AI assistant: a chat in the corner. It answers about migration and the site, and when you ask it to open something ("кори курьер дар Маскав нишон деҳ") the server says which page, and we open it. The conversation stays while the tab is open (sessionStorage), so it continues after changing pages. |
| `load` | function | — |
| `Message` | function | **bold** and "- " lists from the model, drawn safely (no HTML from the answer is used). |
| `AssistantMark` | function | The assistant's own mark: a chat bubble with a four-pointed spark inside, drawn in the current text color. |
| `Assistant` | export function | — |

### `frontend/src/components/Blacklist.jsx`

**What it is for:** The workers' blacklist: anyone logged in puts a job's company on it with a reason, and everyone sees the reports at once (the job stays on the site with a warning; admins check the reports and may hide the company).

| Name | Kind | What it does |
|---|---|---|
| `ReportsBadge` | export function | "3 шикоят" on a red pill. |
| `ReportItem` | export function | One report: the reason, who (first name only) and when, the job it was about. The author may take it back. |
| `ReportForm` | function | The form in a side panel: quick reasons to tap, then the reason in the worker's own words. |
| `ReportsList` | export function | Every report about one company, newest first. |
| `ReportButton` | export function | The "add to blacklist" button with its side panel; the panel also shows what others wrote. compact: an icon-only square for the job cards. onChange: a report was added or removed. |
| `BlacklistCompany` | export function | A company on the blacklist with its latest reports: the jobs page's side card and the /blacklist page. |

### `frontend/src/components/DocCard.jsx`

**What it is for:** The card of one user document: name, status, days left and a progress line.

| Name | Kind | What it does |
|---|---|---|
| `ICONS` | const | Icons by the document type's slug (set by admins); unknown slugs get a plain document icon. |
| `docIcon` | export function | — |
| `Meta` | function | — |
| `BAR_TONE` | const | Color of the thin progress line: red when over, amber when ending soon, green when fine. |
| `DocCard` | export function | One document: its name and status, the days left, a thin line of time used, the details below, and the actions. |

### `frontend/src/components/DocForm.jsx`

**What it is for:** The side-panel form to add or edit a user's document (type, dates, photo, reminder days).

| Name | Kind | What it does |
|---|---|---|
| `addDays` | function | Pure date math in UTC: local midnight in Moscow (UTC+3) would turn into the previous day in toISOString(). |
| `DocForm` | export function | Add or edit one of the user's documents. doc = null: closed, {}: new, a document: edit it. |

### `frontend/src/components/Feedback.jsx`

**What it is for:** A large block at the end of the home page, before the footer: «Don't like something? Tell us.» with five faces (from angry to delighted) and a «I found a bug» link; a face opens the side panel with that rating already chosen: kind (idea, bug, praise, other), stars, the message; guests see a login button. After sending: thanks, and below the user's earlier feedback with Muhojir's replies.

| Name | Kind | What it does |
|---|---|---|
| `KINDS` | const | The four kinds with icons. |
| `MyFeedback` | function | The user's feedback and replies (GET /feedback/mine/); "See photo" opens the attached photo. |
| `FeedbackForm` | function | The form; sends the current page too, and an optional photo or screenshot (preview with a remove button, made smaller with fitPhoto before sending). |
| `FACES` | const | Five ratings 1-5 with face icons, labels and the kind they start with (1 → bug, 5 → praise). |
| `FeedbackBanner` | export function | The block and the panel (rendered into document.body so it is above the header). |

### `frontend/src/components/Filters.jsx`

**What it is for:** Shared filter parts of the Jobs and Housing pages: one row of chips, a «Filters» button with the number of active filters, a sort select, removable chips of active filters and a side sheet with all filters.

| Name | Kind | What it does |
|---|---|---|
| `chipClass` | export function | Classes of a category chip (dark when chosen). |
| `ChipRow` | export function | One scrollable row of chips on phones, wrapped on big screens. |
| `FilterBar` | export function | «Filters» button with a counter, extra buttons and the sort control on the right. |
| `SortSelect` | export function | Compact sort select with an icon. |
| `ActiveFilters` | export function | Chips of the active filters; a tap removes one, «Reset all» removes all. |
| `FilterGroup` | export function | Titled block inside the sheet. |
| `OptionGrid` | export function | Two-column grid of buttons to pick one value. |
| `FilterSheet` | export function | Drawer with the filters and a sticky footer: «Reset» and «Show (N)». |

### `frontend/src/components/FlagRibbons.jsx`

**What it is for:** A Tajik flag made of three waving silk ribbons (red, white, green in the flag's 2:3:2 proportions) with a soft blue glow and moving folds. In the footer it fills the empty space under the site description, 40% opaque; in a box lower than 90px it is hidden (.ribbons-box). Stops moving when the visitor asked for less motion.

| Name | Kind | What it does |
|---|---|---|
| `STRIPES` | const | The three ribbons: offset, width and color. |
| `wave(y)` | function | An SVG path of a long smooth wave at height y (period PERIOD, height AMPLITUDE). |
| `FlagRibbons` | export function | The picture; the ribbons slide by one wave period in 9 s, so the loop is seamless. |

### `frontend/src/components/Footer.jsx`

**What it is for:** The site footer: official links, sections and contacts.

| Name | Kind | What it does |
|---|---|---|
| `OFFICIAL` | const | Official sites people need most; the full list is on the help page. |
| `linkStyle` | const | As in the first Muhojir: on hover a link slides a little to the right and a line grows under it from the left. |
| `Footer` | export function | — |

### `frontend/src/components/GuideSteps.jsx`

**What it is for:** The step-by-step guide for a document type: steps, what to bring, sample filled forms.

| Name | Kind | What it does |
|---|---|---|
| `Checklist` | export function | The "what to bring" list of a step: one item per line in the admin panel. Ticks are only for the reader. |
| `exampleOf` | export const | A filled-in sample of the form: "Field: value" per line, shown like a paper form. Read-only. |
| `Example` | function | — |
| `papersOf` | export const | — |
| `GuideSteps` | export function | — |

### `frontend/src/components/InstallApp.jsx`

**What it is for:** "Install as an app" (PWA): the banner on phones and the buttons in the header and the menu.

| Name | Kind | What it does |
|---|---|---|
| `InstallContext` | const | "Install as an app" everywhere on the site: a banner on phones, a button in the menus. Android/desktop Chrome install with one tap; on iPhone Apple allows only Share -> "Add to Home Screen", so we show how. |
| `bannerDismissed` | function | — |
| `InstallProvider` | export function | — |
| `useInstallApp` | export const | — |
| `InstallMenuButton` | export function | A wide button for the phone menu. |
| `InstallHeaderButton` | export function | A small button for the header on big screens. |
| `InstallBanner` | export function | On phones: a card that slides in under the header a few seconds after the site opens. |

### `frontend/src/components/Housing.jsx`

**What it is for:** Shared parts of the housing pages.

| Name | Kind | What it does |
|---|---|---|
| `HOUSING_KINDS` | const | The four kinds with icons and labels. |
| `FOR_WHOM` | const | Who may live there. |
| `FLAGS` | const | Registration, utilities included, no deposit: icon, label and a short explanation. |
| `kindOf(value)` | function | The kind entry for a value. |
| `HousingPrice` | export function | «9 000 ₽ / month» (or «/ day»). |
| `HousingStatus` | export function | A badge: rented (inactive), waiting for checking or rejected; nothing for approved. |
| `HousingCover` | export function | The first photo, or the kind's icon on a plain background. |
| `HousingCard` | export function | A card (imported ones have a blue Telegram badge): photo with the kind and photo count, price, title, city, metro, for whom and the green flags; children go under it (owner buttons). |
| `Photos` | function | Photos of a saved listing: add several at once (made smaller with fitPhoto), remove each; at most 8. |
| `HousingForm` | export function | The side panel (rendered into document.body, above the header) to post or edit a listing; after the first save the photos part appears. A new listing needs the «I confirm» box (the place is real, I am its owner or live there, the data is true; false listings get the account blocked). |
| `DeleteHousing` | export function | The delete button with a confirmation. |

### `frontend/src/components/JobCard.jsx`

**What it is for:** The job card and its parts: badges, perks, the link to the official ad, the save and blacklist buttons.

| Name | Kind | What it does |
|---|---|---|
| `SOURCE_NAME` | export const | Every job comes from «Работа России» (trudvsem.ru); people apply there, on the ad's official page. |
| `Perks` | export function | — |
| `VerifiedBadge` | export function | — |
| `SourceBadge` | export function | — |
| `OfficialLink` | export function | The link to the ad on the official site, where people read the contacts and apply. |
| `placeOf` | export const | — |
| `SaveButton` | export function | Save a job for later (only for logged-in users). onChange tells the page, e.g. to drop it from the saved list. |
| `IndustryIcon` | function | The job's industry square: one quiet style for every industry, the icon tells them apart. |
| `JobRow` | export function | compact (home page): a short row, the whole row a link to the job. Otherwise (jobs list): a card with the company, address and perks, the salary, and buttons to the official ad and to save it. |

### `frontend/src/components/Layout.jsx`

**What it is for:** The site's shell: a thin flag line on top, a quiet bar with the main sections in the middle (centered on the screen from xl, in the free space on smaller laptops), a left sidebar on wide screens (lg+) with the "More" sections and the blocks from the home page (official rate, news, feedback), the page, the footer. Phones: a slim bar on top and a floating dock at the bottom; its last button opens every section. On top of the page: the "new version" bar (useAppUpdate) and the offline bar. Everything fixed to the bottom on phones (the Ошно button and chat, live toasts, the job page buttons, the footer margin) adds env(safe-area-inset-bottom), so in the installed app on an iPhone with a home bar nothing hides under the bottom menu.

| Name | Kind | What it does |
|---|---|---|
| `sections` | function | Every section. main: shown as a tab in the top bar; dock: on the phone dock (in this order). |
| `canEdit` | export const | — |
| `useCounters` | function | Counters: unread notifications and documents that need attention (ending soon or expired). |
| `Logo` | function | — |
| `Count` | function | — |
| `LangSwitch` | export function | — |
| `IconButton` | function | — |
| `ThemeToggle` | export function | — |
| `SideLink` | function | One link of the sidebar: icon, name, counter. The "News" link (/guides#news) is never shown as active, so it does not light up together with "Guides". |
| `useSidebarOpen` | function | Whether the sidebar is open; the "Menu" button left of the logo (☰ icon and the word, highlighted with ✕ while the sidebar is open) toggles it, the choice is kept in localStorage ("sidebar"). When closed the sidebar slides out to the left, becomes inert and the page takes the full width. |
| `Sidebar` | function | The left sidebar on wide screens: the "More" group (patent price, guides, checks, Russian course, exam, legal help, saved jobs and receipts) and the "From the home page" group (official rate /rate, news, feedback /feedback); for editors also the content admin link. |
| `MenuSheet` | function | Phones: every section as big tiles in a sheet from the bottom. While it is open the page behind is dimmed and locked (useScrollLock) and touches do not reach it; Escape closes it. |
| `Layout` | export function | The whole frame of the site (header, page, footer, assistant). Behind every page a light SeasonFall layer (density 0.35) falls from the top of the screen to the bottom; the page content (z-[1]) is above it, so leaves show only between the cards. |

### `frontend/src/components/Leaffall.jsx`

**What it is for:** Autumn leaves slowly falling on a canvas (seasonal decoration of the login and registration page).

| Name | Kind | What it does |
|---|---|---|
| `COLORS` | const | Six autumn colors (light and deep shade of each): orange, yellow, red, rust, brown, amber. |
| `MAPLE` | const | Outline of the right half of a maple leaf (unit coordinates); the left half is its mirror. |
| `maplePath` / `ovalPath` | function | Draw a maple leaf or a simple oval leaf. |
| `makeLeaf(shape, colors, dark)` | function | One ready-made leaf picture (sprite) with a color gradient and veins; a little dimmer in the dark theme. |
| `Leaffall` | export function | 14–42 leaves (by screen size) fall slowly, sway side to side, turn and flip like real leaves, and are carried by a soft changing wind; near leaves are bigger and brighter. With "reduce motion" the leaves stand still. density scales the number (the site background uses 0.35, the login page 1). A resize (e.g. the phone's address bar hiding while scrolling) keeps the leaves that are already falling. |

### `frontend/src/components/LiveToast.jsx`

**What it is for:** The pop-up that shows a new notification arriving over the WebSocket.

| Name | Kind | What it does |
|---|---|---|
| `SHOW_SECONDS` | const | A new notification that just arrived over the WebSocket: slides in at the corner, goes away by itself. |
| `LiveToast` | export function | — |

### `frontend/src/components/LocationPicker.jsx`

**What it is for:** A small MapLibre map (the colorful OpenFreeMap «liberty» style: streets, buildings, shops) to mark or show where a shop is. «I am in the shop now» listens to the device position for up to 20 s with high accuracy and keeps the best reading: it stops at once at ±30 m (phone GPS), or 6 s after the last reading. Up to 100 m the pin is placed; up to 1 km it is placed with a «drag the pin» warning; worse than 1 km (a computer without GPS guesses by the internet, often hundreds of km off) nothing is saved and the owner is asked to use the phone in the shop or tap the map. Permission denied, timeout, no signal and a non-https address get their own messages. A click or dragging the pin sets the place; under the map are the coordinates and links to Yandex satellite and street panorama.

| Name | Kind | What it does |
|---|---|---|
| `panoramaUrl(lat, lon)` | export function | Yandex Maps street panorama at the point. |
| `satelliteUrl(lat, lon)` | export function | Yandex Maps satellite view with a pin at the point. |
| `distanceText(meters)` | export function | «240 м» or «305 км». |
| `geoProblem(error)` | function | The message for a failed location request, by its error code. |
| `WORDS` / `words(subject)` | const / function | The texts that differ for a shop and for a suggested place (GPS button, address search, hints). |
| `AddressSearch` | function | The address box above the map (pre-filled with the shop's city and address): one match moves the pin at once, several are shown as a list to choose from. |
| `LocationPicker` | export function | The map; query is the starting address text; readOnly shows the pin only (for editors); subject is "shop" (default) or "place" for the words of the buttons and hints. |


### `frontend/src/components/Map3D.jsx`

**What it is for:** The 3D map of the places page: OpenFreeMap vector tiles in MapLibre GL. Quiet base maps that follow the site's theme ("positron" by day, "dark" at night) with our own 3D buildings; places in their category's color, gathered into numbered clusters; and a route between two points when one is built.

| Name | Kind | What it does |
|---|---|---|
| `THEMES` | const | Everything the map draws itself, for each theme. |
| `geojson` | function | Turns the points into GeoJSON; only numeric ids become feature ids (shop pins have string ids like "shop-5"). |
| `routeData` | function | The route as map data: the line, and its two ends ("from" and "to"). |
| `addLayers` | function | Our layers on top of the base map (added again whenever the theme, and so the base map, changes). |
| `routeSummary` | function | "3,4 км · 46 дақ" for the route card. |
| `Map3D` | export function | route: { geometry, distance (m), duration (s), mode: "foot" \| "car", from: {lat, lon, name}, to: {...} } or null. className: the map's size. inset: how many pixels on the left are covered (e.g. by a list over the map), so the buttons move right of it and places are framed in the part that is still seen. |
| `TOUCH` | const | True on touch screens: there the map moves with two fingers (cooperativeGestures), so one finger still scrolls the page. |

### `frontend/src/components/Pattern.jsx`

**What it is for:** Decorations: the waving flag of Tajikistan, the national ornament pattern and the Hero banner.

| Name | Kind | What it does |
|---|---|---|
| `FLAG_SRC` | const | The flag of Tajikistan, waving softly: the official artwork (public/flag-tj.svg, from Wikimedia Commons, public domain), with a slow light-and-shadow running across the cloth (folds). It fades into the banner towards the text, so the text stays easy to read; people who turned animations off see it standing. |
| `FlagCloth` | function | The flag in a 700 × 350 box (its own proportions, 1:2) with the folds over it. |
| `WavingFlag` | export function | The flag alone, waving, filling its box (for the home hero). It keeps its proportions and is cut by the box. |
| `Pattern` | export function | — |
| `EDGE_TO_EDGE` | export const | On phones the banner touches the screen edges and the dark header above it, so both read as one block; from md on it is a rounded card. (The page container has px-4 py-6 on phones.) |
| `Hero` | export function | A deep lapis banner with the ornament and the ikat stripe at its foot. Content that should lie over its bottom edge goes right after it, wrapped in <Overlap>. art: a picture on the right (wide screens), e.g. <RouteArt />. |
| `Overlap` | export function | — |
| `Glow` | export function | Soft light in the banner's corners: saffron from the top right, blue from the bottom left. |
| `FlagShowcase` | export function | The flag as the hero's centerpiece: the official flag, floating, turned a little in 3D, with a light sweeping across the cloth and its shadow on the stage. Still for people who turned animations off. |
| `Emblem` | export function | A tiny flag of Tajikistan as a mark (eyebrows, cards): the official artwork. |

### `frontend/src/components/PaymentDrawer.jsx`

**What it is for:** The side panel to record a payment.

| Name | Kind | What it does |
|---|---|---|
| `PaymentDrawer` | export function | Record a payment for a document (e.g. the monthly patent tax) with a photo of the receipt. The server moves the document's end date forward by the months paid. doc = null: closed. monthlyPrice: the patent price of the document's region, to fill in the amount. |

### `frontend/src/components/PhoneApp.jsx`

**What it is for:** The "site on your phone" card with install instructions.

| Name | Kind | What it does |
|---|---|---|
| `PhoneApp` | export function | "The site on your phone": install it on the home screen, like an app. Shown only where it can really be installed: one tap on Android/desktop Chrome, the Share steps on iPhone. |

### `frontend/src/components/RouteArt.jsx`

**What it is for:** The journey of every migrant, drawn for the home banner: the Pamir mountains of Tajikistan, a dotted arc to Moscow and a small plane flying along it, again and again. Gold lines on the deep blue. Purely decorative (aria-hidden); the plane stands still for people who turned animations off.

| Name | Kind | What it does |
|---|---|---|
| `RouteArt` | export function | — |

### `frontend/src/components/RubleRate.jsx`

**What it is for:** The card of the official rouble to somoni rate at the end of the home page (before the footer): 1 000 ₽ in somoni from the National Bank of Tajikistan with the date, change over 30 days and a small line chart, an amount field with quick buttons and the sum at the official rate, and the Central Bank of Russia rate. Hidden if no rate is known yet.

| Name | Kind | What it does |
|---|---|---|
| `AMOUNTS` | const | Quick amounts for each direction: rub 5 000, 10 000, 50 000, 100 000 ₽; tjs 500, 1 000, 5 000, 10 000 somoni. |
| `rubles(value)` | function | A sum in roubles with two decimals. |
| `tjs(value)` | function | A sum in somoni with two decimals. |
| `Sparkline` | function | The 30-day line of the NBT rate (SVG). |
| `RubleRate` | export function | The card. Converts both ways: "Rouble → somoni" and "Somoni → rouble"; the round ⇆ button between them (swap) flips the direction and carries the converted amount over. At the top: round flags of Russia and Tajikistan with the pair (RUB → TJS or TJS → RUB), the result in big type on one line and "for 1 000 ₽" (or "for 100 somoni") under it. In the somoni direction the CBR box shows 100 somoni in roubles. |
| `Flag` | function | A round flag: Russia drawn in SVG, Tajikistan from /flag-tj.svg. |
| `Pair` | function | The two flags overlapping and the currency codes in the chosen direction. |

### `frontend/src/components/SeasonFall.jsx`

**What it is for:** The falling decoration of the current season.

| Name | Kind | What it does |
|---|---|---|
| `season(day)` | export function | "autumn" in September–November, "winter" in December–February, otherwise null. |
| `SeasonFall` | export function | Leaffall in autumn, Snowfall in winter, nothing in spring and summer; density is passed on. |

### `frontend/src/components/Shop.jsx`

**What it is for:** Parts of the shops pages: logo, badges, contact buttons, shop and product cards.

| Name | Kind | What it does |
|---|---|---|
| `fitPhoto(file, side)` | export async function | Shrinks a photo to at most 1200 px and WEBP before upload. |
| `ShopLogo` | export function | The logo, or the kind's icon when there is none. |
| `ShopStatus` | export function | Draft / pending / approved / rejected badge. |
| `PROOF_KINDS` | export const | The three proofs with labels and hints; place and goods are required. |
| `ProofThumb` | export function | A private proof as a thumbnail (loaded with the login token); a click opens it in a new tab. |
| `contactLinks(shop)` | export function | tel:, wa.me and t.me links of a shop. |
| `ContactButtons` | export function | Call / WhatsApp / Telegram buttons. |
| `ShopCard` | export function | A shop in the list. |
| `ProductPhoto` | export function | Product photo or an empty box icon. |
| `Price` | export function | «650 ₽ / kg». |
| `ProductCard` | export function | A product; with showShop it shows and links to its shop. |


### `frontend/src/components/Snowfall.jsx`

**What it is for:** Falling snow drawn on a canvas (winter, December–February).

| Name | Kind | What it does |
|---|---|---|
| `makeSprite` | function | One snowflake picture (sprite): sharp or soft (out of focus), for light and dark theme. |
| `Snowfall` | export function | Slow snow: far flakes small and dim, near ones bigger, a few big blurred ones in front; each rocks gently and shimmers. density scales the number of flakes; a resize keeps the flakes that are falling. With "reduce motion" it stands still. |

### `frontend/src/components/SocialLogin.jsx`

**What it is for:** "Continue with Google" under the login and sign-up forms, with an "or" line above. Shown only when the server has GOOGLE_CLIENT_ID.

| Name | Kind | What it does |
|---|---|---|
| `loadScript(src)` | function | Adds Google's script and waits for it. |
| `setupGoogle()` | function | Once per page: client ID from GET /api/auth/google/, Google's script, initialize. Resolves to true when Google login is on. |
| `GoogleLogo` | function | Google's logo as SVG. |
| `SocialLogin` | export function | Our own button in the site's style (translated); Google's real button lies invisibly on top of it, so the click goes to Google. onGoogle gets the ID token. |

### `frontend/src/components/Stars.jsx`

**What it is for:** Star ratings: showing an average and picking a rating in review forms.

| Name | Kind | What it does |
|---|---|---|
| `average` | export function | — |
| `Stars` | export function | — |
| `StarPicker` | export function | Big stars to pick a rating in the review form. |

### `frontend/src/components/motion.jsx`

**What it is for:** All animations of the site in one place (the motion library).

| Name | Kind | What it does |
|---|---|---|
| `MotionProvider` | export function | All animations of the site in one place. LazyMotion + "m" load only the small DOM animation part of the library, and reducedMotion="user" turns movement off for people who asked their phone for less motion. |
| `startShown` | export const | Content must never depend on an animation to become visible: a tab opened in the background pauses animations, so there everything starts in its final state (initial={false}) instead of transparent. |
| `PageTransition` | export function | A page appearing: fades in and rises a little. Keyed by the address, so it replays on every page change. |
| `listVariants` | const | A list whose items appear one after another (cards, rows, tiles). |
| `Stagger` | export function | inView: wait until the list scrolls into view (once) instead of starting at once. |
| `revealVariants` | const | Like Stagger, but it starts when the group scrolls into view (once), e.g. the footer columns. |
| `RevealGroup` | export function | — |
| `StaggerItem` | export function | — |
| `Reveal` | export function | A section that fades in and rises a little when it scrolls into view (once). |
| `introVariants` | const | The opening of a page: its parts (label, headline, text, buttons) come in one after another. |
| `Intro` | export function | — |
| `IntroItem` | export function | — |
| `CountUp` | export function | A number counting up from 0 (days left on the deadline ring). In a tab that is not visible the browser pauses animations, so there the real number is shown at once: "0 days" must never be left on screen. format: how to show it (e.g. num, for "1 118"). |

### `frontend/src/components/ui.jsx`

**What it is for:** The small shared UI kit: Button, Chip, ErrorBox, Skeleton, EmptyState, Field, Drawer, PageHeader, BackLink, status badges.

| Name | Kind | What it does |
|---|---|---|
| `Button` | export function | — |
| `STATUS` | export const | Document status: always color + icon + text, never color alone. |
| `statusText` | export function | — |
| `StatusBadge` | export function | — |
| `Chip` | export function | — |
| `ErrorBox` | export function | — |
| `Skeleton` | export function | — |
| `EmptyState` | export function | — |
| `Field` | export function | — |
| `Drawer` | export function | Side panel on desktop, full-height sheet on phones. Rendered into document.body (portal) so it covers the site header and the bottom menu and the ✕ button is always visible. Optional footer: a sticky bottom bar. Closes on Escape and on the dark backdrop; the page behind is locked with useScrollLock. |
| `PageHeader` | export function | The top of every page: a small label, a headline, one line of text, and the page's main actions on the right. Plain, on the page, with a hairline under it. children: buttons (any variant). |
| `BackLink` | export function | "← Back" above a detail page: a quiet text link. |
| `Switch` | export function | An on/off row with an icon, a title and a hint (role=switch); used for «we deliver» and «in stock». |


---

## `frontend/src/pages/` — one file per page of the site

### `frontend/src/pages/BlacklistPage.jsx`

**What it is for:** /blacklist — the full public blacklist of employers with all workers' reasons, with search.

| Name | Kind | What it does |
|---|---|---|
| `BlacklistPage` | export function | Every company on the blacklist: the ones admins blacklisted first, then by the number of workers' reports, each with its reasons. Anyone can read it; reports are added from the job ads. |

### `frontend/src/pages/Calculator.jsx`

**What it is for:** /calculator — patent price calculator by region and number of months.

| Name | Kind | What it does |
|---|---|---|
| `Calculator` | export function | — |

### `frontend/src/pages/Checks.jsx`

**What it is for:** /checks — links and steps to check your own papers on official sites (entry ban, patent, debts).

| Name | Kind | What it does |
|---|---|---|
| `stepsOf` | const | Official pages where people check their own papers (admins keep the list: help contacts of kind "mvd_check"). Each description holds the steps, one per line. |
| `Checks` | export function | — |

### `frontend/src/pages/Documents.jsx`

**What it is for:** /documents — the user's documents: list or calendar view, add/edit, statuses and reminders.

| Name | Kind | What it does |
|---|---|---|
| `Calendar` | function | The calendar view: a timeline by month of the end date, nearest first. |
| `Documents` | export function | — |

### `frontend/src/pages/EmployerPage.jsx`

**What it is for:** /employers/:id — one company: rating, workers' reviews (write/edit/delete), blacklist reports, its jobs.

| Name | Kind | What it does |
|---|---|---|
| `ReviewForm` | function | — |
| `EmployerPage` | export function | — |

### `frontend/src/pages/Course.jsx`

**What it is for:** /course — the Russian course: 7 levels with progress, lessons (locked ones show a lock), the exam of each level, a «continue» button to the next lesson and a card with the user's certificate or a link to the sample.

| Name | Kind | What it does |
|---|---|---|
| `Course` | export function | — |

### `frontend/src/pages/Lesson.jsx`

**What it is for:** /course/:level/:number — a lesson: theory with examples, words, then exercises (choose the answer, build the sentence from words). Progress inside the lesson is kept in the browser, so a reopened lesson continues from the next exercise. The score is sent to the server when it is at least 60%.

| Name | Kind | What it does |
|---|---|---|
| `Practice` | function | Exercises one by one. |
| `Lesson` | export function | — |

### `frontend/src/pages/CourseExam.jsx`

**What it is for:** /course/:level/exam — the level exam: the name for the certificate, then questions with a timer; answers are kept in the browser and sent automatically when time is over; the result shows a review of mistakes.

| Name | Kind | What it does |
|---|---|---|
| `CourseExam` | export function | — |

### `frontend/src/pages/Certificate.jsx`

**What it is for:** /certificates/:code and /certificates/sample — the dark-blue A4 certificate (stamp, signature, seal, number and a QR code to this page). «Download PDF» draws the certificate into an A4 PDF in the browser (html-to-image + jsPDF); «Print» also works. The sample has a watermark and is open to everyone.

| Name | Kind | What it does |
|---|---|---|
| `Paper` | function | The certificate itself. |
| `savePdf` | async function | Makes and saves the PDF. |
| `Certificate` | export function | — |

### `frontend/src/pages/Exam.jsx`

**What it is for:** Practice for the exam in Russian language, history and law that is needed for the patent. Questions come from the admin panel; answers are shuffled here, so the right one is not always in the same place.

| Name | Kind | What it does |
|---|---|---|
| `BEST_KEY` | const | our goal for practice: three answers out of four |
| `prepare` | const | Each option keeps whether it is the right one, so the order can change freely. |
| `readBest` | function | — |
| `saveBest` | function | — |
| `Listen` | function | — |
| `Quiz` | function | — |
| `Exam` | export function | — |

### `frontend/src/pages/FeedbackPage.jsx`

**What it is for:** /feedback — the feedback block (FeedbackBanner) as its own page, for the sidebar. Open to guests; writing asks to log in.

| Name | Kind | What it does |
|---|---|---|
| `FeedbackPage` | export function | The page header and the FeedbackBanner block. |

### `frontend/src/pages/Guides.jsx`

**What it is for:** /guides — guides for every document type and the law news.

| Name | Kind | What it does |
|---|---|---|
| `News` | function | — |
| `Guides` | export function | — |

### `frontend/src/pages/Help.jsx`

**What it is for:** /help — help sites, hotlines and the phones of lawyers.

| Name | Kind | What it does |
|---|---|---|
| `Contacts` | function | — |
| `Help` | export function | — |

### `frontend/src/pages/Home.jsx`

**What it is for:** The home page. Guests: the headline, live numbers, every service as a tile, how it works, fresh jobs and law news. Logged in: a greeting with the nearest deadline, the documents, the services. At the end of both: the official rouble to somoni rate (RubleRate) and the feedback block (FeedbackBanner).

| Name | Kind | What it does |
|---|---|---|
| `HeroStage` | function | The hero: plain, on the page. The text on the left, a quiet panel on the right (wide screens). |
| `Eyebrow` | function | — |
| `STAT_TONES` | const | value: a number; it counts up once it has loaded. The three numbers in the colors of the flag of Tajikistan in the light theme: red, white (wider), green. At night the rows stay dark and keep only a thin stripe of their color on the left. |
| `Stat` | function | — |
| `SERVICES` | const | Every service as a tile, all alike; the calculator and the shops are twice as wide. |
| `TileIcon` | function | — |
| `ServicesGrid` | function | — |
| `SectionTitle` | function | — |
| `HowItWorks` | function | — |
| `JobsPanel` | function | Newest jobs in the user's city (or anywhere, when there are none there). |
| `NewsPanel` | function | — |
| `Ring` | function | — |
| `DocTile` | function | — |
| `GuestHome` | function | — |
| `QUICK` | const | Shown beside the greeting while there are no documents yet (the hero button already adds one). |
| `MigrantHome` | function | — |
| `Home` | export function | — |

### `frontend/src/pages/Housing.jsx`

**What it is for:** /housing — the «Housing» page (main tab in the header): search by metro/area/word, city and «price up to» with quick buttons, kind chips with counts, for whom, registration / utilities / no deposit / with photos, source (all, users of the site, Telegram), ordering (newest, cheaper, more expensive), cards with «show more». The «My listings» tab shows the user's own listings with status, the reject reason, edit and delete. On the side: «Have a free place?» and a warning about fraud. Filters live in the address (?kind=, ?max_price= …).

| Name | Kind | What it does |
|---|---|---|
| `usePaged(path)` | function | Loads a page of listings, «show more», and replaces/drops/prepends a card after editing. |
| `Safety` | function | Three rules against fraud: no money before seeing the place, ask for a contract or receipt, registration only where you live. |
| `PostCard` | function | «Have a free place?» with the post button. |
| `Housing` | export function | The page. |

### `frontend/src/pages/HousingDetail.jsx`

**What it is for:** /housing/:id — one listing: photo gallery, title, city/address/metro, facts (kind, rooms, free places, for whom), description, the three flags (shown dimmed when absent), price with contact buttons (phone, WhatsApp, Telegram), «Original listing and contacts» link, for imported ones the channel name and a note to see the place before paying, edit for the owner, the editor's approve/reject box for listings not yet approved, and the fraud warning.

| Name | Kind | What it does |
|---|---|---|
| `Gallery` | function | The big photo and thumbnails to switch. |
| `Moderate` | function | Editors: approve or reject with a reason (POST /housing/{id}/moderate/). |
| `HousingDetail` | export function | The page. |

### `frontend/src/pages/JobDetail.jsx`

**What it is for:** One job: the title and salary on the page, the address, perks and description in a card; the employer, the official ad and a note on the right.

| Name | Kind | What it does |
|---|---|---|
| `JobDetail` | export function | — |

### `frontend/src/pages/Jobs.jsx`

**What it is for:** /jobs — job search: text and city search, industries, filters, sorting, job alerts and the blacklist card.

| Name | Kind | What it does |
|---|---|---|
| `Blacklist` | function | — |
| `WhereJobsComeFrom` | function | — |
| `AlertButton` | function | "Tell me about new jobs like these": keeps the current filters as an alert (see jobs/alerts.py on the server). |
| `Jobs` | export function | — |

### `frontend/src/pages/Login.jsx`

**What it is for:** /login — sign up, log in, confirm the email with a code, reset the password. Under the forms: SocialLogin (Google). The card is wide and compact, so the buttons are visible without scrolling.

| Name | Kind | What it does |
|---|---|---|
| `PasswordInput` | function | A password box with a button to show what was typed (on a phone it is easy to mistype). |
| `ICONS` | const | The screens of this page. "verify" and "reset" come after a code was emailed. |
| `CodeBoxes` | function | — |
| `SKIES` | const | The sky gradient of the login page for autumn, winter and the rest of the year (day and night). |
| `SeasonScene` | function | The sky of the current season behind the login page with SeasonFall at full density. |
| `MAPLE` / `Leaf` | const / function | A maple leaf as SVG. |
| `CardLeaves` | function | Three leaves resting on the top edge of the form card (only in autumn). |
| `Login` | export function | — |

### `frontend/src/pages/MyShops.jsx`

**What it is for:** /shops/my — the owner's page: open a shop (with the proofs and the location in the same form, then it is sent for checking), edit it, change the logo, finish the proofs of a draft or rejected shop and send it again, add, edit, hide (not in stock) and delete products. Editors can open any shop here with ?shop=id.

| Name | Kind | What it does |
|---|---|---|
| `upload(path, field, file)` | async function | Shrinks and uploads a picture. |
| `uploadProof(shopId, kind, file)` | async function | Uploads a proof: photos are shrunk to 1600 px WEBP, PDFs go as they are. |
| `ProofSlot` | function | One kind of proof: pick a file, preview, remove. |
| `ProofIntro` | function | Why proofs are needed and that only editors see them. |
| `LocationProof` | function | The required «location of the shop» box with LocationPicker. |
| `ProofPanel` | function | Proofs and location of a shop that is not approved yet (saved at once), and the «Send for checking» button. |
| `ShopForm` | function | Drawer to create or edit a shop. |
| `ProductForm` | function | Drawer to add or edit a product with its photo. |
| `MapPanel` | function | For an approved shop: its pin (read only), «See on the map» (/places?shop=id) and «Change location» — the new pin is saved after a confirm and the shop goes back to checking. |
| `ShopManager` | function | One shop: status, logo, buttons and the product list. |
| `MyShops` | export function | The list of my shops and the chosen one. |


### `frontend/src/pages/NewsDetail.jsx`

**What it is for:** /news/:id — one law news item as an article.

| Name | Kind | What it does |
|---|---|---|
| `NewsDetail` | export function | One law news item, set like an article: the date, a big title, the summary as a lead, then the text. |

### `frontend/src/pages/NotFound.jsx`

**What it is for:** The 404 page.

| Name | Kind | What it does |
|---|---|---|
| `NotFound` | export function | A page that does not exist: a big quiet 404 and the way home. |

### `frontend/src/pages/Notifications.jsx`

**What it is for:** /notifications — the user's notifications: read, mark all read, delete.

| Name | Kind | What it does |
|---|---|---|
| `Notifications` | export function | — |

### `frontend/src/pages/Payments.jsx`

**What it is for:** /payments — the receipts archive: payments with receipt photos.

| Name | Kind | What it does |
|---|---|---|
| `Payments` | export function | The receipts archive: every payment the user recorded, with the photo of its receipt. |

### `frontend/src/pages/Places.jsx`

**What it is for:** Useful places on a map: migration centers, clinics, notaries, translators, the embassy, mosques, Tajik cafes, halal shops, money transfers. The data is from OpenStreetMap; people rate places and suggest new ones. Approved Tajik shops from /shops are a separate red layer: an owner puts the pin when opening the shop, and it appears here only after an editor approves the shop. Editors have a «For checking» button (?waiting=true) that lists the suggestions of every region.

| Name | Kind | What it does |
|---|---|---|
| `PLACE_KINDS` | export const | The 12 kinds of places with their label, icon and map color (same keys as PLACE_CATEGORIES in app/models/places.py). |
| `REGION_VIEW` | const | Where the map opens for each of the 30 regions (latitude, longitude, zoom). |
| `ROUTER` | const | Routes: the free OSRM servers of openstreetmap.de, on foot or by car. Coordinates are "lon,lat". |
| `findRoute` | export function | — |
| `myPosition` | function | The person's position, once (asks for permission the first time). |
| `RouteBuilder` | function | "Route": from my position or from another place on the map to this place, on foot or by car. |
| `useWide` | function | True on wide screens (Tailwind's xl), where the list floats over the map. On phones and tablets the map (440 px on phones) is always shown above the list; building a route scrolls up to the map. |
| `SHOP_KIND` | const | The «Tajik shops» chip and its red map color; the value "shop" is never sent to /api/places/. |
| `shopIdOf` | function | "shop-5" -> 5, a place id -> null. |
| `distanceKm` | function | Distance between two points in km (haversine). |
| `shopsAround(shops, center, km, words, pinned)` | function | Shops of /api/market/shops/map/ near the chosen region (radius by its zoom in ZOOM_KM, 30 km near me), nearest first, filtered by the search; ?shop=id is always kept. |
| `PlaceCard` | function | — |
| `ShopPinCard` | function | A shop in the list: logo, kind, address, distance, hours. |
| `ShopDetails` | function | Drawer of a shop: rating, address, hours, delivery, contacts, «Products and shop page», route. |
| `PrivatePhoto` | function | Loads a private photo with the token and shows it (opens full size on click). |
| `PlaceCheck` | function | Inside a place that is not approved: «Waiting for checking» or the reject reason; the photo; for editors the map with satellite/panorama links, «Approve» and «Reject» (needs a reason); author and editors can delete. |
| `PlaceDetails` | function | — |
| `SuggestPlace` | function | Form to suggest a place: kind, name, region, address, a required pin on the map, a required photo (shrunk to 1600 px WEBP) and the «I confirm the place really exists» box; the button works only when all three are given. Editors see «added» at once. |
| `Places` | export function | — |

### `frontend/src/pages/Profile.jsx`

**What it is for:** /profile — the user's profile: photo, name, phone, city, language, theme, email reminders, logout.

| Name | Kind | What it does |
|---|---|---|
| `maskEmail` | function | "marufromin2007@gmail.com" -> "ma••••••07@gmail.com": the address stays recognisable but is not readable over a shoulder. |
| `Avatar` | function | The avatar: the photo, or the first letter in a blue circle, inside a ring in the colors of the flag. |
| `squarePhoto` | function | A photo from the phone is often 5–10 MB: cut the middle square and make it 512×512 WEBP (about 50 KB) here. |
| `AvatarPicker` | function | The avatar with a camera button: pick a photo to upload it; the trash button removes it. |
| `Segmented` | function | Two or three choices side by side, like iOS settings. |
| `Toggle` | function | — |
| `Section` | function | — |
| `IconInput` | function | An input with an icon inside it on the left. |
| `Profile` | export function | — |

### `frontend/src/pages/SavedJobs.jsx`

**What it is for:** /saved-jobs — saved jobs and the user's job alerts.

| Name | Kind | What it does |
|---|---|---|
| `Alerts` | function | — |
| `SavedJobs` | export function | — |

### `frontend/src/pages/Rate.jsx`

**What it is for:** /rate — the official ruble rate (RubleRate) as its own page, so it can be opened from the sidebar, not only from the home page. Open to guests.

| Name | Kind | What it does |
|---|---|---|
| `Rate` | export function | The page header and the RubleRate card. |

### `frontend/src/pages/ShopPage.jsx`

**What it is for:** /shops/:id — one shop: logo, kind, address with a Yandex map link, hours, contact buttons, products with search, reviews. Editors approve or reject a pending shop here.

| Name | Kind | What it does |
|---|---|---|
| `Moderate` | function | Editor's box: the proof photos, the location map with the street panorama link, approve / reject with a reason. |
| `Reviews` | function | Rating, my review form and the reviews. |
| `Products` | function | Products of the shop with a search box. |
| `ShopPage` | export function | The page. |


### `frontend/src/pages/Shops.jsx`

**What it is for:** /shops — Tajik shops: tabs «Shops» and «Products», search, city, kind chips, delivery, cheapest first. All filters live in the address bar.

| Name | Kind | What it does |
|---|---|---|
| `chip(on)` | function | Style of a filter chip. |
| `usePaged(path)` | function | Loads a page of results and «show more». |
| `OpenShop` | function | Side card inviting owners to add their shop. |
| `HowItWorks` | function | Three steps: find, write to the seller, pay only after seeing the goods. |
| `Shops` | export function | The page. |


### `frontend/src/pages/Tickets.jsx`

**What it is for:** Air tickets between Tajikistan and Russia, both ways. Prices come from Aviasales (the cheapest found in the last days); the ticket is bought on aviasales.ru or on the airlines' own sites (Somon Air, Tajik Air). Logged-in visitors can ask to be told when a route gets cheaper. When a day is picked, the list also loads /flights/day/ (more flights of that day from every airport) and merges it with the month's tickets.

| Name | Kind | What it does |
|---|---|---|
| `nextMonths` | function | The next 12 months as "2026-11". |
| `places` | function | Choices for one side: a city with several airports also gets "all airports" (its city code, e.g. MOW). |
| `time` | function | — |
| `dayLabel` | function | "2026-11-05" -> "05.11"; with the weekday -> "05.11, Чор" ("05.11, Ср" in Russian). |
| `weekday` | function | — |
| `monthDays` | function | Every day of the month as "2026-11-05", from today on in the current month. |
| `paxCode` | function | Passengers in an aviasales.ru link: adults, then children and infants when there are any ("2", "21", "201"). |
| `aviasalesDay` | function | The search on aviasales.ru for one day: /search/DYU0511MOW1. |
| `withPax` | function | Puts our passengers into a search link from Aviasales (they always give 1 passenger: /search/DYU3010SVO1?t=...). |
| `totalPrice` | function | The price for everyone: adults and children pay a full seat, an infant without a seat about a tenth. |
| `WEEK` | const | Weekdays, Monday first. |
| `TIMES` | const | Departure times: night, morning, day, evening (with hours). |
| `SORTS` | const | Order: cheapest, earliest, fastest. |
| `hourOf` | function | — |
| `weekdayOf` | function | — |
| `list` | function | "1,3" -> ["1", "3"] |
| `toggle` | function | — |
| `duration` | function | — |
| `Calendar` | function | Every day of the month with its cheapest price; the cheapest day is marked. A day is picked to see its flights. |
| `TicketRow` | function | — |
| `PAX_ROWS` | const | Adults (12+), children (2–11) and infants (under 2, on a lap): at most 9 people, an infant for every adult. |
| `Passengers` | function | — |
| `FilterChip` | function | — |
| `FilterRow` | function | — |
| `Filters` | function | Stops, weekdays, departure time, airlines, the highest price and the order. Everything but "direct only" is applied here to the month's tickets; "direct only" is asked from the server (it returns other tickets then). |
| `PriceAlert` | function | "Tell me when it is cheaper than ...": saved for the chosen route and month; checked every morning. |
| `AIRLINES` | const | The airlines' own booking pages: the user picks the route and buys there. Their booking engines take no route in the link, so Somon Air and Tajik Air open on the search form; Aviasales opens with this route filled in. |
| `AirlineLinks` | function | — |
| `TravelTips` | function | — |
| `Tickets` | export function | — |

