#!/usr/bin/env bash
# Installs Muhojir (FastAPI) on the server, or brings an installed copy up to date; safe to run again.
# Run as root after cloning the project to /home/romin/muhojir-api:
#   bash /home/romin/muhojir-api/deploy/setup.sh
#
# What runs where:
#   nginx :8050  →  React site (frontend/dist), /media
#                →  /api /admin /swagger /redoc and the WebSocket /ws/  →  uvicorn 127.0.0.1:8051 (3 workers)
#   The workers share live notifications and the request limits through Redis (database 15).
#   Celery worker sends the emails in the background and runs the daily jobs; Celery Beat starts them every day
#   (06:00 new vacancies, 06:30 document reminders). Their queue is Redis database 15 too.
# Other projects on this server (Rohat 8030, Django Muhojir 8040, others) are not touched.
# For a domain, after this: bash /home/romin/muhojir/deploy/subdomain.sh <name> 8050   (e.g. api.king.tj)
set -euo pipefail

APP_USER=romin
APP=/home/$APP_USER/muhojir-api
PUBLIC_PORT=8050   # the address people open: http://<server>:8050
APP_PORT=8051      # uvicorn, reachable only from nginx
REDIS_DB=15
NODE_DIR=/home/$APP_USER/.local/node22
SERVER_IP=$(hostname -I | awk '{print $1}')

step() { echo; echo "==> $*"; }

# Sets one KEY=value line in .env (adds it if missing); other lines, keys and passwords stay as they are.
set_env() {
  python3 - "$APP/.env" "$1" "$2" <<'PY'
import sys
path, key, value = sys.argv[1:]
lines = open(path).read().splitlines()
for i, line in enumerate(lines):
    if line.startswith(key + "="):
        lines[i] = f"{key}={value}"
        break
else:
    lines.append(f"{key}={value}")
open(path, "w").write("\n".join(lines) + "\n")
PY
}
# Adds an empty KEY= line to .env only if it is not there; a key already written there is never touched.
add_env_if_missing() { grep -q "^$1=" "$APP/.env" || echo "$1=" >> "$APP/.env"; }
as_user() { sudo -u "$APP_USER" -H bash -c "cd '$APP' && $*"; }

[ "$(id -u)" = 0 ] || { echo "Run this script as root."; exit 1; }
[ -d "$APP/.git" ] || { echo "Clone the project to $APP first (see README.md)."; exit 1; }

for port in $PUBLIC_PORT $APP_PORT; do
  if ss -ltn "sport = :$port" | grep -q LISTEN && [ ! -e /etc/nginx/sites-enabled/muhojir-api ]; then
    echo "Port $port is used by another program. Change PUBLIC_PORT / APP_PORT at the top of this script."
    exit 1
  fi
done

step "System packages (only what is missing)"
missing=""
command -v nginx >/dev/null || missing="$missing nginx"
command -v redis-server >/dev/null || missing="$missing redis-server"
python3 -c "import venv" 2>/dev/null || missing="$missing python3-venv"
if [ -n "$missing" ]; then
  apt-get update -qq && apt-get install -y -qq $missing
fi
systemctl enable -q --now redis-server

step "Python packages"
as_user "[ -d .venv ] || python3 -m venv .venv"
as_user ".venv/bin/pip install -q --upgrade pip"
as_user ".venv/bin/pip install -q -r requirements.txt"

step "Settings (.env)"
if [ ! -f "$APP/.env" ]; then
  secret=$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')
  cat > "$APP/.env" <<ENV
SECRET_KEY=$secret
DEBUG=False

# Emails with the sign-up and password codes. Gmail: the address and a 16-letter app password from
# https://myaccount.google.com/apppasswords. While these are empty, emails are not sent.
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=

# The AI assistant (the chat in the corner). One key is enough: Gemini from https://aistudio.google.com/apikey
# or Claude from https://console.anthropic.com. While both are empty, the chat says it is not set up.
GEMINI_API_KEY=
ANTHROPIC_API_KEY=

# Air tickets: live prices from Aviasales (free token at https://www.travelpayouts.com). Empty = search links only.
TRAVELPAYOUTS_TOKEN=
ENV
  echo "Created $APP/.env: add the email address, app password and AI key later (see the end of this script)."
fi
add_env_if_missing GEMINI_API_KEY
add_env_if_missing ANTHROPIC_API_KEY
add_env_if_missing TRAVELPAYOUTS_TOKEN
set_env DEBUG False
set_env REDIS_URL "redis://127.0.0.1:6379/$REDIS_DB"
set_env CELERY_BROKER_URL "redis://127.0.0.1:6379/$REDIS_DB"
chown "$APP_USER:$APP_USER" "$APP/.env"
chmod 600 "$APP/.env"  # keys and passwords: readable only by $APP_USER

step "Database (tables and the site's content)"
as_user ".venv/bin/alembic upgrade head"
as_user "mkdir -p media private_media"

step "Node.js 22 for $APP_USER (shared with Rohat and Muhojir)"
if [ ! -x "$NODE_DIR/bin/node" ]; then
  echo "Node.js 22 is missing at $NODE_DIR. Run the Muhojir (Django) or Rohat setup first, or install Node 22 there."
  exit 1
fi

step "Frontend build"
as_user "cd frontend && export PATH='$NODE_DIR/bin':\$PATH && npm ci --no-audit --no-fund --loglevel=error && npm run build"

step "Access for nginx (it reads the site and public files; .env, the database and private files stay closed)"
chmod o+x "/home/$APP_USER" "$APP" "$APP/frontend"
chmod -R o+rX "$APP/frontend/dist" "$APP/media"
chmod 700 "$APP/private_media"

step "nginx"
install -m 644 "$APP/deploy/nginx-muhojir-api-site.conf" /etc/nginx/snippets/muhojir-api-site.conf
cat > /etc/nginx/sites-available/muhojir-api <<NGINX
# Muhojir (FastAPI): generated by deploy/setup.sh, do not edit here (changes are lost on the next update).
server {
    listen $PUBLIC_PORT;
    server_name _;
    include snippets/muhojir-api-site.conf;
}
NGINX
ln -sf /etc/nginx/sites-available/muhojir-api /etc/nginx/sites-enabled/muhojir-api
if nginx -t 2>&1; then
  systemctl reload nginx
else
  rm -f /etc/nginx/sites-enabled/muhojir-api
  echo "nginx found an error in the Muhojir (FastAPI) config; it is switched off in nginx, other sites are not affected."
  exit 1
fi
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow "$PUBLIC_PORT/tcp"
fi

step "Services: uvicorn, Celery worker, Celery beat"
cp "$APP"/deploy/muhojir-api.service "$APP"/deploy/muhojir-api-celery.service "$APP"/deploy/muhojir-api-celerybeat.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable -q muhojir-api muhojir-api-celery muhojir-api-celerybeat
systemctl restart muhojir-api muhojir-api-celery muhojir-api-celerybeat
# The very first time there are no vacancies yet: the worker imports them now, in the background (a few minutes).
if ! as_user ".venv/bin/python -m app.cli has-jobs"; then
  as_user ".venv/bin/celery -A app.worker call app.worker.import_jobs" >/dev/null
  echo "Importing the first vacancies in the background: journalctl -u muhojir-api-celery -f"
fi
# The places from OpenStreetMap too (they are refreshed every Sunday night).
if ! as_user ".venv/bin/python -m app.cli has-places"; then
  as_user ".venv/bin/celery -A app.worker call app.worker.import_places" >/dev/null
  echo "Importing the places (map) in the background, about 20 minutes."
fi

step "Check"
sleep 4
systemctl is-active muhojir-api muhojir-api-celery muhojir-api-celerybeat
curl -sS -o /dev/null -w "site: HTTP %{http_code}\n" "http://127.0.0.1:$PUBLIC_PORT/"
curl -sS -o /dev/null -w "API:  HTTP %{http_code}\n" "http://127.0.0.1:$PUBLIC_PORT/api/documents/document-types/"

echo
echo "Muhojir (FastAPI): http://$SERVER_IP:$PUBLIC_PORT/"
echo "Admin account:     cd $APP && sudo -u $APP_USER .venv/bin/python -m app.cli createsuperuser"
echo "Email, AI, tickets: nano $APP/.env   (EMAIL_*, GEMINI_API_KEY, TRAVELPAYOUTS_TOKEN)   then   systemctl restart muhojir-api muhojir-api-celery"
echo "Logs:              journalctl -u muhojir-api -u muhojir-api-celery -u muhojir-api-celerybeat -f"
