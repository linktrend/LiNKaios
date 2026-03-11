#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MIGRATION_DIR="$ROOT_DIR/packages/studio-brain/migrations"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required"
  exit 1
fi

for sql in "$MIGRATION_DIR"/*.sql; do
  echo "Applying $(basename "$sql")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$sql"
done

echo "Studio Brain migrations applied successfully."
