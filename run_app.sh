#!/usr/bin/env bash
# One-command local run: installs deps, builds the SPA, serves API + UI on http://localhost:8000
# Defaults suit small machines (1 worker, SQLite, in-process realtime; ~90 MB RSS measured).
# Scale-out: export DATABASE_URL / REDIS_URL / JWT_SECRET and WORKERS>1 (see README "Scaling out").
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
PORT="${PORT:-8000}"
WORKERS="${WORKERS:-1}"

if [ ! -x .venv/bin/python ]; then
  echo "Creating Python virtualenv (.venv)"
  python3 -m venv .venv
fi
REQ=backend/requirements.txt
[ -n "${DATABASE_URL:-}${REDIS_URL:-}" ] && REQ=backend/requirements-scale.txt
.venv/bin/pip install -q -r "$REQ"

if [ "${SKIP_FRONTEND_BUILD:-0}" != "1" ]; then
  echo "Building frontend"
  (cd frontend && { [ -d node_modules ] || npm ci --no-audit --no-fund; } && npm run build)
fi

[ -f .env ] && { set -a; . ./.env; set +a; }
if [ "$WORKERS" -gt 1 ] && [ -z "${REDIS_URL:-}" ]; then
  echo "WORKERS>1 needs REDIS_URL (shared realtime rooms) - falling back to 1 worker" >&2
  WORKERS=1
fi
echo "MedTrust AI -> http://localhost:${PORT}"
cd backend
exec ../.venv/bin/uvicorn app.main:app --host "${HOST:-0.0.0.0}" --port "$PORT" --workers "$WORKERS" \
  --proxy-headers --forwarded-allow-ips="${FORWARDED_ALLOW_IPS:-127.0.0.1}" \
  --ws-max-size 65536 --timeout-keep-alive 15 --limit-concurrency "${LIMIT_CONCURRENCY:-500}" --no-server-header
