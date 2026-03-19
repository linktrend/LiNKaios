#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

printf "\n==> Workspace checks\n"
cd "$ROOT_DIR"
pnpm test

printf "\n==> Required tree checks\n"
required_paths=(
  "docs/AIOS_MASTER_SPEC.md"
  "docs/MVO_EXECUTION_LEDGER.md"
  "docs/UNIFIED_DEV_TEST_RUNBOOK.md"
  "infra/debian-vps/docker-compose.yml"
  "infra/mac-mini/README.md"
  "packages/linkbrain/migrations/0001_init.sql"
  "apps/LiNKaios/src/index.ts"
  "apps/LiNKaios/src/nats.ts"
  "scripts/mvo-predeploy-acceptance.sh"
  "scripts/unified-dev-check.sh"
  "apps/LiNKautowork/workflows/hot-cold-migration.json"
  "apps/LiNKautowork/workflows/heartbeat-triage.json"
  "apps/LiNKautowork/workflows/daily-chairman-briefing.json"
  "apps/LiNKautowork/workflows/security-exception-response.json"
  "apps/LiNKautowork/workflows/promotion-review-governance.json"
  "apps/LiNKautowork/workflows/restore-authorization-governance.json"
  "agents/internal/managers/INT-MNG-260311-0001-LISA/soul.md"
  "agents/internal/managers/INT-MNG-260311-0004-MARK/soul.md"
  "agents/internal/workers/INT-EXE-260311-0005-MIKE/soul.md"
  "agents/internal/workers/INT-EXE-260311-0005-MIKE/main.py"
  "agents/internal/workers/INT-EXE-260311-0007-ALEX/soul.md"
  "agents/internal/workers/INT-EXE-260311-0007-ALEX/main.py"
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
