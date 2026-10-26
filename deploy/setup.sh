#!/usr/bin/env bash
set -euo pipefail

APP_USER=romin
APP=/home/$APP_USER/muhojir-api
PUBLIC_PORT=8070
APP_PORT=8071
REDIS_DB=15
DOMAIN=king.tj
OLD_SITE=/etc/nginx/sites-available/muhojir
NODE_DIR=/home/$APP_USER/.local/node22
SERVER_IP=$(hostname -I | awk '{print $1}')

step() { echo; echo "==> $*"; }

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

# Sign in with Google: OAuth client ID (Web application) from https://console.cloud.google.com/auth/clients.
GOOGLE_CLIENT_ID=

# Sign in with Apple: the Services ID from https://developer.apple.com/account/resources/identifiers (return URL https://$DOMAIN/login).
APPLE_CLIENT_ID=
ENV
  echo "Created $APP/.env: add the email address, app password and AI key later (see the end of this script)."
fi
add_env_if_missing GEMINI_API_KEY
add_env_if_missing ANTHROPIC_API_KEY
add_env_if_missing TRAVELPAYOUTS_TOKEN
add_env_if_missing GOOGLE_CLIENT_ID
add_env_if_missing APPLE_CLIENT_ID
set_env DEBUG False
set_env REDIS_URL "redis://127.0.0.1:6379/$REDIS_DB"
set_env CELERY_BROKER_URL "redis://127.0.0.1:6379/$REDIS_DB"
chown "$APP_USER:$APP_USER" "$APP/.env"
chmod 600 "$APP/.env"

step "Database (tables and the site's content)"
as_user ".venv/bin/alembic upgrade head"
as_user "mkdir -p media private_media"

step "Node.js 22 for $APP_USER (shared with Rohat and Muhojir)"
if [ "${SKIP_BUILD:-}" != 1 ] && [ ! -x "$NODE_DIR/bin/node" ]; then
  echo "Node.js 22 is missing at $NODE_DIR. Run the Muhojir (Django) or Rohat setup first, or install Node 22 there."
  exit 1
fi

if [ "${SKIP_BUILD:-}" = 1 ]; then
  step "Frontend: using the uploaded frontend/dist (no build on the server)"
  [ -f "$APP/frontend/dist/index.html" ] || { echo "frontend/dist/index.html is missing: upload the built site first."; exit 1; }
  chown -R "$APP_USER:$APP_USER" "$APP/frontend/dist"
else
  step "Frontend build"
  as_user "cd frontend && export PATH='$NODE_DIR/bin':\$PATH && npm ci --no-audit --no-fund --loglevel=error && npm run build"
fi

step "Access for nginx (it reads the site and public files; .env, the database and private files stay closed)"
chmod o+x "/home/$APP_USER" "$APP" "$APP/frontend"
chmod -R o+rX "$APP/frontend/dist" "$APP/media"
chmod 700 "$APP/private_media"

step "nginx${DOMAIN:+ and HTTPS for $DOMAIN}"
install -m 644 "$APP/deploy/nginx-muhojir-api-site.conf" /etc/nginx/snippets/muhojir-api-site.conf
mkdir -p /var/www/certbot
CERT_DIR=/etc/letsencrypt/live/$DOMAIN

if [ -n "$DOMAIN" ] && [ -f "$OLD_SITE" ] && grep -q "server_name .*$DOMAIN" "$OLD_SITE"; then
  cat > "$OLD_SITE" <<NGINX
# Muhojir (old, Django): only by port. king.tj moved to Muhojir (FastAPI), see /home/romin/muhojir-api/deploy/setup.sh.
server {
    listen 8040;
    server_name _;
    include snippets/muhojir-site.conf;
}
NGINX
  echo "The old Django Muhojir gave $DOMAIN away; it stays at http://$SERVER_IP:8040/"
fi

write_nginx() {
  {
    echo "# Muhojir (FastAPI): generated by deploy/setup.sh, do not edit here (changes are lost on the next update)."
    echo "server {"
    echo "    listen $PUBLIC_PORT;"
    echo "    server_name _;"
    echo "    include snippets/muhojir-api-site.conf;"
    echo "}"
    if [ "$1" = https ]; then
      echo "server {"
      echo "    listen 80;"
      echo "    server_name $DOMAIN www.$DOMAIN;"
      echo "    location /.well-known/acme-challenge/ { root /var/www/certbot; }"
      echo "    location / { return 301 https://$DOMAIN\$request_uri; }"
      echo "}"
      echo "server {"
      echo "    listen 443 ssl http2;"
      echo "    server_name www.$DOMAIN;"
      echo "    ssl_certificate $CERT_DIR/fullchain.pem;"
      echo "    ssl_certificate_key $CERT_DIR/privkey.pem;"
      echo "    return 301 https://$DOMAIN\$request_uri;"
      echo "}"
      echo "server {"
      echo "    listen 443 ssl http2;"
      echo "    server_name $DOMAIN;"
      echo "    ssl_certificate $CERT_DIR/fullchain.pem;"
      echo "    ssl_certificate_key $CERT_DIR/privkey.pem;"
      echo "    ssl_protocols TLSv1.2 TLSv1.3;"
      echo "    ssl_session_cache shared:muhojir_api_ssl:10m;"
      echo "    include snippets/muhojir-api-site.conf;"
      echo "}"
    elif [ "$1" = http ]; then
      echo "server {"
      echo "    listen 80;"
      echo "    server_name $DOMAIN www.$DOMAIN;"
      echo "    location /.well-known/acme-challenge/ { root /var/www/certbot; }"
      echo "    include snippets/muhojir-api-site.conf;"
      echo "}"
    fi
  } > /etc/nginx/sites-available/muhojir-api
  ln -sf /etc/nginx/sites-available/muhojir-api /etc/nginx/sites-enabled/muhojir-api
  if nginx -t 2>&1; then
    systemctl reload nginx
  else
    rm -f /etc/nginx/sites-enabled/muhojir-api
    echo "nginx found an error in the Muhojir (FastAPI) config; it is switched off in nginx, other sites are not affected."
    exit 1
  fi
}

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow "$PUBLIC_PORT/tcp"
  [ -n "$DOMAIN" ] && { ufw allow 80/tcp; ufw allow 443/tcp; }
fi

SITE_URL=http://$SERVER_IP:$PUBLIC_PORT
if [ -z "$DOMAIN" ]; then
  write_nginx port
elif [ -f "$CERT_DIR/fullchain.pem" ]; then
  write_nginx https
else
  write_nginx http
  command -v certbot >/dev/null || { apt-get update -qq && apt-get install -y -qq certbot; }
  echo
  echo "Getting a free HTTPS certificate for $DOMAIN and www.$DOMAIN from Let's Encrypt."
  echo "certbot asks for your email (for expiry warnings) and to accept the Let's Encrypt terms."
  if certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" -d "www.$DOMAIN" --cert-name "$DOMAIN" --deploy-hook "systemctl reload nginx"; then
    write_nginx https
  else
    echo "No certificate yet: the site works on http://$DOMAIN. Check that $DOMAIN and www.$DOMAIN point to $SERVER_IP, then run this script again."
  fi
fi
if [ -n "$DOMAIN" ]; then
  if [ -f "$CERT_DIR/fullchain.pem" ]; then
    SITE_URL=https://$DOMAIN
    set_env HTTPS True
  else
    SITE_URL=http://$DOMAIN
    set_env HTTPS False
  fi
fi

step "Services: uvicorn, Celery worker, Celery beat"
cp "$APP"/deploy/muhojir-api.service "$APP"/deploy/muhojir-api-celery.service "$APP"/deploy/muhojir-api-celerybeat.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable -q muhojir-api muhojir-api-celery muhojir-api-celerybeat
systemctl restart muhojir-api muhojir-api-celery muhojir-api-celerybeat
if ! as_user ".venv/bin/python -m app.cli has-jobs"; then
  as_user ".venv/bin/celery -A app.worker call app.worker.import_jobs" >/dev/null
  echo "Importing the first vacancies in the background: journalctl -u muhojir-api-celery -f"
fi
if ! as_user ".venv/bin/python -m app.cli has-places"; then
  as_user ".venv/bin/celery -A app.worker call app.worker.import_places" >/dev/null
  echo "Importing the places (map) in the background, about 20 minutes."
fi

step "Check"
sleep 4
systemctl is-active muhojir-api muhojir-api-celery muhojir-api-celerybeat
curl -sS -o /dev/null -w "site: HTTP %{http_code}\n" "http://127.0.0.1:$PUBLIC_PORT/"
curl -sS -o /dev/null -w "API:  HTTP %{http_code}\n" "http://127.0.0.1:$PUBLIC_PORT/api/documents/document-types/"
if [ -n "$DOMAIN" ]; then
  curl -sS -o /dev/null -w "site ($SITE_URL): HTTP %{http_code}\n" --resolve "$DOMAIN:443:127.0.0.1" --resolve "$DOMAIN:80:127.0.0.1" "$SITE_URL/" || true
fi

echo
echo "Muhojir (FastAPI): $SITE_URL/  (also http://$SERVER_IP:$PUBLIC_PORT/)"
echo "Admin account:     cd $APP && sudo -u $APP_USER .venv/bin/python -m app.cli createsuperuser"
echo "Email, AI, tickets: nano $APP/.env   (EMAIL_*, GEMINI_API_KEY, TRAVELPAYOUTS_TOKEN, GOOGLE_CLIENT_ID, APPLE_CLIENT_ID)   then   systemctl restart muhojir-api muhojir-api-celery"
echo "Logs:              journalctl -u muhojir-api -u muhojir-api-celery -u muhojir-api-celerybeat -f"
