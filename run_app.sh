#!/usr/bin/env bash
# One-command local run: installs deps, builds the SPA, serves API + UI on http://localhost:8000
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
PORT="${PORT:-8000}"

if [ ! -x .venv/bin/python ]; then
  echo "Creating Python virtualenv (.venv)"
  python3 -m venv .venv
fi
.venv/bin/pip install -q -r backend/requirements.txt

if [ "${SKIP_FRONTEND_BUILD:-0}" != "1" ]; then
  echo "Building frontend"
  (cd frontend && { [ -d node_modules ] || npm ci; } && npm run build)
fi

[ -f .env ] && { set -a; . ./.env; set +a; }
echo "MedTrust AI -> http://localhost:${PORT}  (API docs: /docs)"
cd backend
exec ../.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
