#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  echo "Missing $ROOT_DIR/.env"
  exit 1
fi

cd "$ROOT_DIR"
pnpm install

docker compose -f infra/debian-vps/docker-compose.yml pull || true
docker compose -f infra/debian-vps/docker-compose.yml up -d --build

echo "Debian VPS services are running."
