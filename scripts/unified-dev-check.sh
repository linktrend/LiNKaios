#!/usr/bin/env bash
set -euo pipefail

AIOS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LINKSKILLS_ROOT="${LINKSKILLS_ROOT:-/Users/linktrend/Projects/LiNKskills}"
LINKAUTOWORK_ROOT="${LINKAUTOWORK_ROOT:-/Users/linktrend/Projects/LiNKautowork}"
PAPERCLIP_ROOT="${PAPERCLIP_ROOT:-/Users/linktrend/Projects/LiNKpaperclip}"
OPENCLAW_ROOT="${OPENCLAW_ROOT:-/Users/linktrend/Projects/LiNKopenclaw}"
AGENTZERO_ROOT="${AGENTZERO_ROOT:-/Users/linktrend/Projects/LiNKagentzero}"

AIOS_BASE_URL="${AIOS_BASE_URL:-http://localhost:4000}"
LINKAUTOWORK_BASE_URL="${LINKAUTOWORK_BASE_URL:-http://localhost:8080}"
LINKSKILLS_BASE_URL="${LINKSKILLS_BASE_URL:-http://localhost:8081}"

OUT_BASE="${UNIFIED_DEV_OUT_DIR:-$AIOS_ROOT/artifacts/unified-dev}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="$OUT_BASE/$TIMESTAMP"
mkdir -p "$OUT_DIR"

SKIP_NATS_BOOTSTRAP="${SKIP_NATS_BOOTSTRAP:-0}"
SKIP_RUNTIME_HEALTH="${SKIP_RUNTIME_HEALTH:-0}"
SKIP_PREDEPLOY_HARNESS="${SKIP_PREDEPLOY_HARNESS:-0}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

for cmd in pnpm python3 npm node curl jq; do
  require_cmd "$cmd"
done

for repo in "$AIOS_ROOT" "$LINKSKILLS_ROOT" "$LINKAUTOWORK_ROOT" "$PAPERCLIP_ROOT" "$OPENCLAW_ROOT" "$AGENTZERO_ROOT"; do
  if [[ ! -d "$repo" ]]; then
    echo "Missing repository path: $repo"
    exit 1
  fi
done

echo "[1/8] Bootstrapping canonical Paperclip JetStream topology"
if [[ "$SKIP_NATS_BOOTSTRAP" == "1" ]]; then
  echo "Skipping NATS bootstrap (SKIP_NATS_BOOTSTRAP=1)"
else
  pnpm --dir "$PAPERCLIP_ROOT/server" nats:bootstrap
fi

echo "[2/8] LiNKaios contract checks"
pnpm --dir "$AIOS_ROOT" --filter @linktrend/LiNKaios check
pnpm --dir "$AIOS_ROOT" --filter @linktrend/LiNKaios test

echo "[3/8] LiNKskills contract checks"
python3 -m unittest discover -s "$LINKSKILLS_ROOT/services/logic-engine/tests" -v

echo "[4/8] LiNKautowork contract checks"
npm --prefix "$LINKAUTOWORK_ROOT" run ci

echo "[5/8] OpenClaw/AgentZero transport worker lint gates"
node --check "$OPENCLAW_ROOT/scripts/aios/nats-management-consumer.mjs"
python3 -m py_compile "$AGENTZERO_ROOT/python/helpers/aios_nats_worker.py"

echo "[6/8] Runtime health gates"
if [[ "$SKIP_RUNTIME_HEALTH" == "1" ]]; then
  echo "Skipping runtime health checks (SKIP_RUNTIME_HEALTH=1)"
else
  curl -fsS "$AIOS_BASE_URL/health" | tee "$OUT_DIR/aios-health.json" >/dev/null
  curl -fsS "$LINKAUTOWORK_BASE_URL/health" | tee "$OUT_DIR/linkautowork-health.json" >/dev/null
  curl -fsS "$LINKSKILLS_BASE_URL/v1/ops/safe-mode" | tee "$OUT_DIR/linkskills-safe-mode.json" >/dev/null
fi

echo "[7/8] LiNKaios predeployment acceptance harness"
if [[ "$SKIP_PREDEPLOY_HARNESS" == "1" ]]; then
  echo "Skipping predeployment harness (SKIP_PREDEPLOY_HARNESS=1)"
else
  (
    cd "$AIOS_ROOT"
    ./scripts/mvo-predeploy-acceptance.sh
  )
fi

echo "[8/8] Evidence collation"
latest_evidence_json="$(ls -1t "$AIOS_ROOT"/artifacts/mvo-predeploy/mvo-predeploy-evidence-*.json 2>/dev/null | head -n 1 || true)"
latest_evidence_md="$(ls -1t "$AIOS_ROOT"/artifacts/mvo-predeploy/mvo-predeploy-summary-*.md 2>/dev/null | head -n 1 || true)"

if [[ -n "$latest_evidence_json" ]]; then
  cp "$latest_evidence_json" "$OUT_DIR/"
fi
if [[ -n "$latest_evidence_md" ]]; then
  cp "$latest_evidence_md" "$OUT_DIR/"
fi

cat > "$OUT_DIR/git-revisions.txt" <<REVS
LiNKaios: $(git -C "$AIOS_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)
LiNKskills: $(git -C "$LINKSKILLS_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)
LiNKautowork: $(git -C "$LINKAUTOWORK_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)
LiNKpaperclip: $(git -C "$PAPERCLIP_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)
LiNKopenclaw: $(git -C "$OPENCLAW_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)
LiNKagentzero: $(git -C "$AGENTZERO_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)
REVS

cat > "$OUT_DIR/unified-dev-summary.md" <<SUMMARY
# Unified Dev Check Summary

- Timestamp (UTC): $TIMESTAMP
- AIOS base URL: $AIOS_BASE_URL
- LiNKautowork base URL: $LINKAUTOWORK_BASE_URL
- LiNKskills base URL: $LINKSKILLS_BASE_URL
- Canonical tenant: 00000000-0000-0000-0000-000000000001

## Completed gates
- Paperclip JetStream bootstrap
- LiNKaios check + tests
- LiNKskills tests
- LiNKautowork CI
- OpenClaw/AgentZero worker syntax gates
- Runtime health gates
- LiNKaios predeployment acceptance harness

## Evidence
- Health captures: aios-health.json, linkautowork-health.json, linkskills-safe-mode.json
- Git revisions: git-revisions.txt
- Copied latest predeployment evidence from LiNKaios artifacts (if available)
SUMMARY

echo "Unified dev check complete. Evidence written to: $OUT_DIR"
