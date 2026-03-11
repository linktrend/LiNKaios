#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="$ROOT_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  ENV_FILE="$ROOT_DIR/.env.example"
fi

AIOS_ENV_FILE="$ENV_FILE" docker compose \
  --env-file "$ENV_FILE" \
  -f infra/debian-vps/docker-compose.yml \
  --profile upstreams down

echo "MVO stack stopped."
