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
| Outside services | «Работа России» (jobs), Travelpayouts/Aviasales (tickets), OpenStreetMap (places), Gemini / Claude (assistant) |
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
- `app/models/` — database tables (SQLAlchemy) — 8 files
- `app/schemas/` — request bodies and JSON answers — 5 files
- `app/routers/` — the API endpoints — 9 files
- `app/services/` — business logic used by routers and background tasks — 10 files
- `app/assistant/` — the AI assistant — 3 files
- `app/admin/` — the admin panel (SQLAdmin, `/admin/`) — 2 files
- `app/admin/templates/` — admin panel pages — 1 files
- `alembic/` — database migrations — 1 files
- `alembic/versions/` — the migrations, in order — 7 files
- `tests/` — automated tests (pytest) — 8 files
- `deploy/` — putting the site on the server — 6 files
- Frontend — the React site (`frontend/`) — 4 files
- `frontend/scripts/` — 1 files
- `frontend/public/` — files served as they are — 4 files
- `frontend/src/` — app core: routing, API, login, languages, helpers — 13 files
- `frontend/src/components/` — reusable parts of pages — 23 files
- `frontend/src/pages/` — one file per page of the site — 23 files


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

**What it is for:** Commands: python -m app.cli createsuperuser an admin account for /admin/ (asks for email and password) python -m app.cli import-jobs [--limit 20] real vacancies from «Работа России» now python -m app.cli send-reminders today's document reminders now python -m app.cli import-places [--region Москва] [--category mosque] real places from OpenStreetMap python -m app.cli check-flights ticket price alerts now python -m app.cli has-jobs exit code 0 if there are vacancies (used by deploy/setup.sh)

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

### `app/worker.py`

**What it is for:** Celery: emails in the background and the daily jobs on schedule (Celery Beat): vacancies, reminders, ticket price alerts, and every week the places from OpenStreetMap. Run on the server: celery -A app.worker worker and celery -A app.worker beat Without CELERY_BROKER_URL nothing has to run: emails are sent at once and the daily jobs are started from cron or by hand (python -m app.cli import-jobs / send-reminders).

| Name | Kind | What it does |
|---|---|---|
| `send_email(subject, body, to)` | function · `Celery task` | — |
| `import_jobs()` | function | — |
| `send_reminders()` | function | — |
| `check_flight_watches()` | function | — |
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
| `Place` | class · table `places` | A useful place on the map. Most come from OpenStreetMap (source "osm", refreshed by the import); users may suggest new ones (source "user"), which appear after an editor approves them. |
| `PlaceReview` | class · table `place_reviews` | A visitor's rating (1-5) and words about a place; one per person per place. |

### `app/models/support.py`

**What it is for:** Database tables of help: help sites/contacts and questions to a lawyer.

| Name | Kind | What it does |
|---|---|---|
| `HelpContact` | class · table `help_contacts` | Where a migrant can get help: official sites to read about the patent, the embassy, a hotline, a lawyer, or the official MVD check page. Editors add them (with real, checked links). |
| `LegalQuestion` | class · table `legal_questions` | A worker's question to a lawyer. An admin writes the answer; the worker gets a notification. |

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

**What it is for:** AI assistant of the site: answers about migration and the site, and opens pages for the visitor. GET tells whether the assistant is set up; POST sends the conversation and returns {"reply", "navigate" (a page address to open, or null), "refused", "truncated"}.

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
| `verify_email(data, db)` | async function · `POST /api/auth/verify-email/` | Step 2 of sign-up: the code from the email. Confirms the email and logs in. |
| `resend_code(data, db)` | async function · `POST /api/auth/resend-code/` | Sends the sign-up code again (only to accounts that are not confirmed yet). |
| `login(data, db)` | async function · `POST /api/auth/login/` | Email + password. An account whose email is not confirmed yet gets a new code instead of tokens. |
| `social_login(db, email, full_name)` | async function | Logs in the account with this email or makes a new one without a password (201). An account whose email was never confirmed loses its old password, because whoever set it did not own the address. Blocked = 403. |
| `google_settings()` | async function · `GET /api/auth/google/` | The client ID for Google's button; an empty string means sign in with Google is off. |
| `google_login(data, db)` | async function · `POST /api/auth/google/` | Sign in with Google: checks the ID token, then social_login. No GOOGLE_CLIENT_ID = 503, bad token = 400. |
| `forgot_password(data, db)` | async function · `POST /api/auth/password/forgot/` | Sends a code for a new password. Answers the same whether the email is registered or not, so nobody can use it to find out who has an account. |
| `reset_password(data, db)` | async function · `POST /api/auth/password/reset/` | The code from the email and a new password. Also confirms the email, and logs in. |
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
| `WatchIn` | class | — |
| &nbsp;&nbsp;↳ `upper(value)` | method | — |
| `watch_json(w)` | function | — |
| `list_watches(db, user)` | async function · `GET /api/flights/watches/` | — |
| `create_watch(data, db, user)` | async function · `POST /api/flights/watches/` | — |
| `my_watch(db, user, watch_id)` | async function | — |
| `delete_watch(watch_id, db, user)` | async function · `DELETE /api/flights/watches/{watch_id}/` | — |

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
| `list_shops(request, db, user, page)` | async function · `GET /api/market/shops/` | Approved shops with the filters; mine=true — my shops in any status; editors: status=pending. Ordering: rating, name, created_at. |
| `summary(db)` | async function · `GET /api/market/shops/summary/` | Number of shops and products, shops per kind and the cities with shops. |
| `get_shop_row(db, user, shop_id)` | async function | One visible shop row or 404. |
| `own_shop(db, user, shop_id)` | async function | The shop if the user is its owner or an editor, otherwise 403. |
| `shop_answer(db, user, shop_id)` | async function | Reads the shop again and returns its JSON. |
| `shop_detail(shop_id, db, user)` | async function · `GET /api/market/shops/{shop_id}/` | A shop and my review of it. |
| `create_shop(data, db, user)` | async function · `POST /api/market/shops/` | Opens a shop (at most 3 per user) as a draft; editors' shops are approved at once. |
| `update_shop(shop_id, data, db, user)` | async function · `PATCH /api/market/shops/{shop_id}/` | Changes a shop, also its location (lat, lon); the status does not change. |
| `delete_shop(shop_id, db, user)` | async function · `DELETE /api/market/shops/{shop_id}/` | Deletes the shop, its products, reviews and photos. |
| `moderate_shop(shop_id, data, db, user)` | async function · `POST /api/market/shops/{shop_id}/moderate/` | Editors approve or reject (with a reason) a sent shop, not a draft; the owner gets a notification. |
| `proof_kinds(db, shop_id)` | async function | Which kinds of proof a shop has. |
| `list_proofs(shop_id, db, user)` | async function · `GET /api/market/shops/{shop_id}/proofs/` | Proofs of a shop, for its owner and editors. |
| `add_proof(shop_id, db, user, kind, file)` | async function · `POST /api/market/shops/{shop_id}/proofs/` | Uploads a proof (form: kind, file; JPG, PNG, WEBP or PDF up to 10 MB, at most 8) into private files. |
| `get_proof(db, user, shop_id, proof_id)` | async function | One proof of my shop (or any for editors), otherwise 404/403. |
| `proof_file(shop_id, proof_id, db, user)` | async function · `GET /api/market/shops/{shop_id}/proofs/{proof_id}/` | The proof file itself, never cached. |
| `delete_proof(shop_id, proof_id, db, user)` | async function · `DELETE /api/market/shops/{shop_id}/proofs/{proof_id}/` | Deletes a proof and its file. |
| `submit_shop(shop_id, db, user)` | async function · `POST /api/market/shops/{shop_id}/submit/` | Sends a draft or rejected shop for checking; needs the place and goods photos ({"proofs"}) and the location ({"location"}). |
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
| `filtered(query, request)` | function | — |
| `near(request)` | function | ?near=55.75,37.61 -> (lat, lon) to sort by distance. |
| `list_places(request, db, user, page)` | async function · `GET /api/places/` | Filters: category (one or several, comma-separated), region, city, search, bbox; near=lat,lon sorts by distance; ordering=rating or name (by default the best rated first). |
| `map_points(request, db, user)` | async function · `GET /api/places/map/` | Light points for the map (id, category, name, lat, lon), with the same filters as the list. |
| `summary(request, db, user)` | async function · `GET /api/places/summary/` | How many places of each category, and the regions with places (for the filters). |
| `get_place(db, user, place_id)` | async function | — |
| `place_detail(place_id, db, user)` | async function · `GET /api/places/{place_id}/` | — |
| `PlaceIn` | class | — |
| `suggest_place(data, db, user)` | async function · `POST /api/places/` | A user suggests a place: it is shown to everyone after an editor approves it (editors' places at once). |
| `review_json(review, viewer)` | function | — |
| `ReviewIn` | class | — |
| `place_reviews(place_id, db, user, page)` | async function · `GET /api/places/{place_id}/reviews/` | — |
| `write_review(place_id, data, db, user)` | async function · `PUT /api/places/{place_id}/reviews/mine/` | My review of the place: written the first time, changed after that. |
| `delete_review(place_id, db, user)` | async function · `DELETE /api/places/{place_id}/reviews/mine/` | — |

### `app/routers/support.py`

**What it is for:** /api/help/: official places to get help (editors keep the list) and questions to a lawyer (answered by admins).

| Name | Kind | What it does |
|---|---|---|
| `ContactIn` | class | — |
| `ContactPatch` | class | — |
| `contact_json(c)` | function | — |
| `contacts_query(request, user)` | function | — |
| `check_contact(db, contact, data)` | async function | — |
| `QuestionIn` | class | — |
| `AnswerIn` | class | For the lawyer (admin): the answer, or just a new status (e.g. closed). |
| `question_json(q)` | function | — |
| `questions_query(user)` | function | — |
| `get_question(db, user, question_id)` | async function | — |
| `list_questions(request, db, user, page)` | async function · `GET /api/help/questions/` | — |
| `ask_question(data, db, user)` | async function · `POST /api/help/questions/` | — |
| `question_detail(question_id, db, user)` | async function · `GET /api/help/questions/{question_id}/` | — |
| `change_question(question_id, data, db, user)` | async function · `PATCH /api/help/questions/{question_id}/` | — |
| `delete_question(question_id, db, user)` | async function · `DELETE /api/help/questions/{question_id}/` | — |
| `save_answer(db, question, answer, lawyer)` | async function | Saves the lawyer's answer and tells the worker about it. |
| `answer_question(question_id, data, db, user)` | async function · `POST /api/help/questions/{question_id}/answer/` | — |

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

### `app/services/emails.py`

**What it is for:** Emails (SMTP from .env): codes after sign-up and for a new password, and notifications. Without SMTP settings the letter is only printed in the console (development).

| Name | Kind | What it does |
|---|---|---|
| `build_message(subject, body, to)` | function | A plain-text email, kept like an ordinary personal one, because Gmail hides automatic-looking letters: plain text, and a Message-ID with the sender's own domain. |
| `send_plain(subject, body, to)` | async function | Sends the email through the SMTP server from .env (async). Without SMTP settings it is only printed. |
| `queue_email(subject, body, to)` | async function | Sends the email in the background (Celery). Without a queue (development), or when the queue itself is unreachable (Redis down), it is sent right here, so codes keep working. Raises OSError if SMTP fails then. |
| `send_code(db, email, purpose)` | async function | Makes a new code, saves its hash (replacing any older code for this email) and emails the code. |

### `app/services/flights.py`

**What it is for:** Ticket prices between Tajikistan and Russia from Travelpayouts (Aviasales Data API v3, prices_for_dates). They are the cheapest prices other people found in the last days, cached by Aviasales; the button opens the search on aviasales.ru, where the ticket is bought. Our own cache keeps an answer for 30 minutes.

| Name | Kind | What it does |
|---|---|---|
| `FlightsUnavailable` | class | — |
| `enabled()` | function | — |
| `search_url(origin, destination, day)` | function | The search page on aviasales.ru: /search/DYU0112MOW1 = from DYU on 1 December to MOW, 1 passenger. |
| `_ticket(item)` | function | — |
| `prices(origin, destination, month, direct)` | async function | The one-way tickets of the month (or the nearest ones), cheapest first (up to 200, so every day has its flights), and the cheapest price of every day. |
| `check_watches(db, today)` | async function | Every day: tells users whose watched route got cheaper than their price. Returns how many were told. |

### `app/services/google.py`

**What it is for:** Checks Google's ID token (signature with Google's cached public keys, audience = GOOGLE_CLIENT_ID, issuer, email confirmed by Google).

| Name | Kind | What it does |
|---|---|---|
| `verify_google_token(credential)` | function | Returns the token's claims (email, name...) or None. Synchronous: the router calls it in a thread. |

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
| `notify(db, user, title, message, kind)` | async function | — |

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

### `app/services/reminders.py`

**What it is for:** Daily reminders about documents that are about to expire (notification + email).

| Name | Kind | What it does |
|---|---|---|
| `reminder_text(document, days)` | function | — |
| `send_due_reminders(db, today)` | async function | Sends today's reminders: on the day the owner chose (remind_days_before) and the day before the end. Safe to run many times a day: ReminderLog remembers what was already sent. Returns how many were sent. |

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

**What it is for:** What the AI assistant is told: who it is, how to behave, and how the site is built (pages and what they do). It tells the model its name is Брат.

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
| `LegalQuestionAdmin` | class | — |
| &nbsp;&nbsp;↳ `on_model_change(data, model, is_created, request)` | method | — |
| &nbsp;&nbsp;↳ `after_model_change(data, model, is_created, request)` | method | — |
| `PlaceAdmin` | class | — |
| `PlaceReviewAdmin` | class | — |
| `AirportAdmin` | class | — |
| `FlightWatchAdmin` | class | — |
| `ShopAdmin` | class | Shops: approve or reject (a reason is required); the owner is notified; deleting removes the pictures. |
| `ProductAdmin` | class | Products of the shops. |
| `ShopReviewAdmin` | class | Shop reviews (delete only). |


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
| `test_suggested_place_waits_for_an_editor(client, user)` | async function | — |
| `test_assistant_tools_for_travel()` | async function | — |


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

**What it is for:** All routes of the site (react-router); every page except Home/Login is loaded lazily; private pages need a login.

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

**What it is for:** Muhojir's design: minimal and calm. Warm milky paper by day, deep blue for the main actions and dark blocks, one blue accent, hairline borders instead of shadows; the red, white and green of the flag only as a thin line on top. Colors are RGB channels, so Tailwind can add opacity; html.dark switches to the night set (deep blue, not black). On phones every field is at least 16px. Page dividers are flag stripes: .flag-border-t / .flag-border-b draw a 3px red-white-green line instead of a border (--flag-pad adds space under it).

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

**What it is for:** The AI assistant chat in the corner of every page (answers about migration, can open site pages). The assistant is called Брат (Brat).

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

**What it is for:** The site's shell: a thin flag line on top, a quiet bar with the main sections and "More", the page, the footer. Phones: a slim bar on top and a floating dock at the bottom; its last button opens every section. On top of the page: the "new version" bar (useAppUpdate) and the offline bar. Everything fixed to the bottom on phones (the Брат button and chat, live toasts, the job page buttons, the footer margin) adds env(safe-area-inset-bottom), so in the installed app on an iPhone with a home bar nothing hides under the bottom menu.

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
| `MoreMenu` | function | "More": the sections that are not tabs, in a panel under the button. |
| `MenuSheet` | function | Phones: every section as big tiles in a sheet from the bottom. |
| `Layout` | export function | — |

### `frontend/src/components/LiveToast.jsx`

**What it is for:** The pop-up that shows a new notification arriving over the WebSocket.

| Name | Kind | What it does |
|---|---|---|
| `SHOW_SECONDS` | const | A new notification that just arrived over the WebSocket: slides in at the corner, goes away by itself. |
| `LiveToast` | export function | — |

### `frontend/src/components/LocationPicker.jsx`

**What it is for:** A small MapLibre map (the colorful OpenFreeMap «liberty» style: streets, buildings, shops) to mark or show where a shop is. «I am in the shop now» asks the phone for its GPS position (high accuracy, up to 20 s) and shows the accuracy; if it is rougher than 100 m it asks to drag the pin. Permission denied, timeout, no signal and a non-https address each get their own message. A click or dragging the pin sets the place; under the map are the coordinates and links to Yandex satellite and street panorama.

| Name | Kind | What it does |
|---|---|---|
| `panoramaUrl(lat, lon)` | export function | Yandex Maps street panorama at the point. |
| `satelliteUrl(lat, lon)` | export function | Yandex Maps satellite view with a pin at the point. |
| `geoProblem(error)` | function | The message for a failed location request, by its error code. |
| `LocationPicker` | export function | The map; readOnly shows the pin only (for editors). |


### `frontend/src/components/Map3D.jsx`

**What it is for:** The 3D map of the places page: OpenFreeMap vector tiles in MapLibre GL. Quiet base maps that follow the site's theme ("positron" by day, "dark" at night) with our own 3D buildings; places in their category's color, gathered into numbered clusters; and a route between two points when one is built.

| Name | Kind | What it does |
|---|---|---|
| `THEMES` | const | Everything the map draws itself, for each theme. |
| `geojson` | function | — |
| `routeData` | function | The route as map data: the line, and its two ends ("from" and "to"). |
| `addLayers` | function | Our layers on top of the base map (added again whenever the theme, and so the base map, changes). |
| `routeSummary` | function | "3,4 км · 46 дақ" for the route card. |
| `Map3D` | export function | route: { geometry, distance (m), duration (s), mode: "foot" \| "car", from: {lat, lon, name}, to: {...} } or null. className: the map's size. inset: how many pixels on the left are covered (e.g. by a list over the map), so the buttons move right of it and places are framed in the part that is still seen. |

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

**What it is for:** Falling snow drawn on a canvas (winter decoration of the login page).

| Name | Kind | What it does |
|---|---|---|
| `makeSprite` | function | Slowly falling snow drawn on a canvas. Far flakes are small and dim, near ones bigger and brighter, and a few big blurred flakes float right in front, like out of focus. Each flake rocks gently side to side and shimmers a little. With "reduce motion" on the phone the snow stands still. Every flake is a ready-made picture (sprite), so even 200 flakes cost little on a phone. |
| `Snowfall` | export function | — |

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
| `Drawer` | export function | Side panel on desktop, full-height sheet on phones. Closes on Escape and on the dark backdrop. |
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

### `frontend/src/pages/Exam.jsx`

**What it is for:** Practice for the exam in Russian language, history and law that is needed for the patent. Questions come from the admin panel; answers are shuffled here, so the right one is not always in the same place.

| Name | Kind | What it does |
|---|---|---|
| `BEST_KEY` | const | our goal for practice: three answers out of four |
| `prepare` | const | Each option keeps whether it is the right one, so the order can change freely. |
| `readBest` | function | — |
| `saveBest` | function | — |
| `speak` | function | — |
| `Listen` | function | — |
| `Quiz` | function | — |
| `Exam` | export function | — |

### `frontend/src/pages/Guides.jsx`

**What it is for:** /guides — guides for every document type and the law news.

| Name | Kind | What it does |
|---|---|---|
| `News` | function | — |
| `Guides` | export function | — |

### `frontend/src/pages/Help.jsx`

**What it is for:** /help — help sites, hotlines and questions to a lawyer.

| Name | Kind | What it does |
|---|---|---|
| `Contacts` | function | — |
| `Help` | export function | — |

### `frontend/src/pages/Home.jsx`

**What it is for:** The home page. Guests: the headline, live numbers, every service as a tile, how it works, fresh jobs and law news. Logged in: a greeting with the nearest deadline, the documents, the services.

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
| `WinterScene` | function | The winter sky behind the page (pale blue by day, deep blue at night) with slowly falling snow. |
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

**What it is for:** Useful places on a map: migration centers, clinics, notaries, translators, the embassy, mosques, Tajik cafes, halal shops, money transfers. The data is from OpenStreetMap; people rate places and suggest new ones.

| Name | Kind | What it does |
|---|---|---|
| `PLACE_KINDS` | export const | The 12 kinds of places with their label, icon and map color (same keys as PLACE_CATEGORIES in app/models/places.py). |
| `REGION_VIEW` | const | Where the map opens for each of the 30 regions (latitude, longitude, zoom). |
| `ROUTER` | const | Routes: the free OSRM servers of openstreetmap.de, on foot or by car. Coordinates are "lon,lat". |
| `findRoute` | export function | — |
| `myPosition` | function | The person's position, once (asks for permission the first time). |
| `RouteBuilder` | function | "Route": from my position or from another place on the map to this place, on foot or by car. |
| `useWide` | function | True on wide screens (Tailwind's xl), where the list floats over the map instead of having its own tab. |
| `PlaceCard` | function | — |
| `PlaceDetails` | function | — |
| `SuggestPlace` | function | — |
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

**What it is for:** Air tickets between Tajikistan and Russia, both ways. Prices come from Aviasales (the cheapest found in the last days); the ticket is bought on aviasales.ru or on the airlines' own sites (Somon Air, Tajik Air). Logged-in visitors can ask to be told when a route gets cheaper.

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

