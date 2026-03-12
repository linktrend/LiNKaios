#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "Missing .env in repo root"
  exit 1
fi

pnpm install
./scripts/bootstrap-upstreams.sh

AIOS_ENV_FILE="$ROOT_DIR/.env" docker compose \
  --env-file "$ROOT_DIR/.env" \
  -f infra/debian-vps/docker-compose.yml \
  up -d --build

echo "Core MVO stack is up (LiNKaios + LiNKautowork)."
