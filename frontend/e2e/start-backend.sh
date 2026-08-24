#!/bin/sh
# Start de Planboard API met een geïsoleerde, wegwerp SQLite-database voor de E2E-tests.
# De ontwikkel-database (backend/planboard.db) wordt nooit aangeraakt.
set -eu

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB_FILE="$(mktemp "${TMPDIR:-/tmp}/planboard-e2e.XXXXXX")"
cleanup() {
  rm -f "$DB_FILE"
}
trap cleanup EXIT INT TERM

export PLANBOARD_DATABASE_URL="sqlite:///$DB_FILE"
export PLANBOARD_CORS_ORIGINS="http://localhost:5179,http://127.0.0.1:5179"

cd "$REPO_ROOT/backend"
uv run alembic upgrade head
exec uv run uvicorn app.main:app --host 127.0.0.1 --port 8011
