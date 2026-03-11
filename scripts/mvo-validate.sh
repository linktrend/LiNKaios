#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

printf "\n==> Workspace checks\n"
cd "$ROOT_DIR"
pnpm test

printf "\n==> Required tree checks\n"
required_paths=(
  "docs/AIOS_MASTER_SPEC.md"
  "infra/debian-vps/docker-compose.yml"
  "infra/mac-mini/README.md"
  "packages/studio-brain/migrations/0001_init.sql"
  "apps/paperclip-service/src/index.ts"
  "apps/n8n-workflows/workflows/hot-cold-migration.json"
  "agents/managers/ceo/soul.md"
  "agents/workers/fe-dev/main.py"
)

for path in "${required_paths[@]}"; do
  if [[ ! -f "$ROOT_DIR/$path" ]]; then
    echo "Missing required path: $path"
    exit 1
  fi
  echo "ok: $path"
done

printf "\n==> Docker compose validation\n"
ENV_FILE="$ROOT_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  ENV_FILE="$ROOT_DIR/.env.example"
fi

AIOS_ENV_FILE="$ENV_FILE" docker compose \
  --env-file "$ENV_FILE" \
  -f "$ROOT_DIR/infra/debian-vps/docker-compose.yml" \
  config >/dev/null

echo "MVO repository validation passed."
