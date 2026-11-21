#!/usr/bin/env bash
# Roll out "Sign in with Google" on the EC2 Compose stack:
#   1. back up the Control Plane database (pg_dump in a throwaway postgres container)
#   2. rebuild the control-plane image (it contains Alembic and the migrations)
#   3. check the current Alembic revision, then upgrade to head (0005_google_sign_in)
#   4. rebuild and restart control-plane and web, then smoke-test through the web proxy
#
# Run from anywhere inside the repository checkout on the server:
#   bash deploy/ec2/rollout-google-signin.sh
# Options:
#   --env-file PATH   Compose env file (default: .env.ec2 at the repository root)
#   --skip-backup     Do not run pg_dump (only if you already have a fresh backup)
# Google keys are optional: without GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET the button stays hidden.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
ENV_FILE=".env.ec2"
SKIP_BACKUP=0
while [ $# -gt 0 ]; do
  case "$1" in
    --env-file) ENV_FILE="$2"; shift 2 ;;
    --skip-backup) SKIP_BACKUP=1; shift ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

step() { printf '\n==> %s\n' "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

[ -f "$ENV_FILE" ] || die "Env file '$ENV_FILE' not found in $ROOT (use --env-file PATH)."
[ -f control-plane/migrations/versions/0005_google_sign_in.py ] || die "This checkout does not contain the Google sign-in migration. Pull the new code first."
command -v docker >/dev/null || die "docker is not installed or not on PATH."

DC=(docker compose --env-file "$ENV_FILE" -f compose.ec2.yaml)
"${DC[@]}" config --quiet || die "Compose configuration is invalid."

if [ "$SKIP_BACKUP" -eq 0 ]; then
  step "Backing up the Control Plane database"
  # Read WEB_DATABASE_URL without sourcing the file (values may contain shell metacharacters).
  raw_url="$(grep -E '^[[:space:]]*WEB_DATABASE_URL=' "$ENV_FILE" | tail -n 1 | cut -d= -f2-)"
  raw_url="${raw_url%\"}"; raw_url="${raw_url#\"}"; raw_url="${raw_url%\'}"; raw_url="${raw_url#\'}"
  [ -n "$raw_url" ] || die "WEB_DATABASE_URL is not set in $ENV_FILE."
  # pg_dump needs a libpq URL, not the SQLAlchemy driver form postgresql+psycopg://
  pg_url="$(printf '%s' "$raw_url" | sed -E 's#^postgres(ql)?\+[a-z0-9_]+://#postgresql://#')"
  mkdir -p backups
  chmod 700 backups
  backup="backups/control-plane-$(date -u +%Y%m%dT%H%M%SZ).dump"
  # pg_dump 17 can dump PostgreSQL 15-17 servers (Supabase).
  if ! docker run --rm --network host -e PGURL="$pg_url" postgres:17-alpine \
        sh -c 'pg_dump --format=custom --no-owner "$PGURL"' > "$backup"; then
    rm -f "$backup"
    die "Backup failed; nothing was changed. Fix the error above or rerun with --skip-backup if you already have a fresh backup."
  fi
  [ -s "$backup" ] || die "Backup file is empty; nothing was changed."
  chmod 600 "$backup"
  echo "Backup written: $ROOT/$backup ($(du -h "$backup" | cut -f1))"
fi

step "Building the control-plane image"
"${DC[@]}" build control-plane

step "Current Control Plane migration revision"
current="$("${DC[@]}" run --rm --no-deps control-plane alembic current 2>&1 | tee /dev/stderr | grep -Eo '^[0-9]{4}_[a-z0-9_]+' | tail -n 1 || true)"
case "$current" in
  0004_encrypted_dashboard_credentials) echo "OK: at 0004, upgrading to 0005." ;;
  0005_google_sign_in) echo "Already at 0005; the upgrade is a no-op." ;;
  *) die "Expected revision 0004_encrypted_dashboard_credentials, found '${current:-none}'. Stopping before any change." ;;
esac

step "Running Alembic upgrade head"
"${DC[@]}" run --rm --no-deps control-plane alembic upgrade head
"${DC[@]}" run --rm --no-deps control-plane alembic current

step "Rebuilding and restarting control-plane and web"
"${DC[@]}" up -d --build control-plane web

step "Waiting for the web proxy"
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8080/readyz >/dev/null 2>&1; then break; fi
  sleep 2
done
curl -fsS http://127.0.0.1:8080/readyz || die "Web /readyz is not healthy. Check: ${DC[*]} logs --tail=100 control-plane web"
echo
config="$(curl -fsS 'http://127.0.0.1:8080/api/account?path=api%2Fv1%2Fauth%2Fgoogle%2Fconfig')" \
  || die "Google config endpoint did not answer through the web proxy."
echo "Google sign-in config: $config"

step "Done"
"${DC[@]}" ps
echo
echo "Google sign-in is deployed. It stays hidden until GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
echo "are added to $ENV_FILE and you run: ${DC[*]} up -d control-plane"
