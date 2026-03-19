#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${AIOS_BASE_URL:-http://localhost:4000}"
OUT_DIR="${AIOS_PREDEPLOY_OUT_DIR:-$ROOT_DIR/artifacts/mvo-predeploy}"
TENANT_ID="00000000-0000-0000-0000-000000000001"
ALLOW_DISABLED_NATS="${ALLOW_DISABLED_NATS:-0}"

mkdir -p "$OUT_DIR"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

if [[ -z "${AIOS_INGRESS_TOKEN:-}" && -f "$ROOT_DIR/.env" ]]; then
  AIOS_INGRESS_TOKEN="$(grep -E '^AIOS_INGRESS_TOKEN=' "$ROOT_DIR/.env" | tail -1 | cut -d'=' -f2- | sed -e 's/^"//' -e 's/"$//')"
fi

if [[ -z "${AIOS_INGRESS_TOKEN_SECRET_NAME:-}" && -f "$ROOT_DIR/.env" ]]; then
  AIOS_INGRESS_TOKEN_SECRET_NAME="$(grep -E '^AIOS_INGRESS_TOKEN_SECRET_NAME=' "$ROOT_DIR/.env" | tail -1 | cut -d'=' -f2- | sed -e 's/^"//' -e 's/"$//')"
fi

if [[ -z "${GOOGLE_CLOUD_PROJECT:-}" && -f "$ROOT_DIR/.env" ]]; then
  GOOGLE_CLOUD_PROJECT="$(grep -E '^GOOGLE_CLOUD_PROJECT=' "$ROOT_DIR/.env" | tail -1 | cut -d'=' -f2- | sed -e 's/^"//' -e 's/"$//')"
fi

if [[ -z "${GCP_PROJECT:-}" && -f "$ROOT_DIR/.env" ]]; then
  GCP_PROJECT="$(grep -E '^GCP_PROJECT=' "$ROOT_DIR/.env" | tail -1 | cut -d'=' -f2- | sed -e 's/^"//' -e 's/"$//')"
fi

if [[ -z "${AIOS_INGRESS_TOKEN:-}" && -n "${AIOS_INGRESS_TOKEN_SECRET_NAME:-}" ]]; then
  PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT:-}}"
  if [[ -z "$PROJECT_ID" ]]; then
    echo "GCP project is required to resolve AIOS ingress token from GSM"
    exit 1
  fi

  if ! command -v gcloud >/dev/null 2>&1; then
    echo "gcloud CLI is required for GSM token resolution in this harness"
    exit 1
  fi

  AIOS_INGRESS_TOKEN="$(gcloud secrets versions access latest \
    --project "$PROJECT_ID" \
    --secret "$AIOS_INGRESS_TOKEN_SECRET_NAME" 2>/dev/null | tr -d '\r\n')"
fi

if [[ -z "${AIOS_INGRESS_TOKEN:-}" ]]; then
  echo "AIOS_INGRESS_TOKEN is required (direct value or GSM secret resolution)"
  exit 1
fi

if ! curl -fsS "${BASE_URL}/health" >/dev/null 2>&1; then
  echo "LiNKaios health endpoint is unreachable at ${BASE_URL}/health"
  echo "Start stack first (for example: ./scripts/mvo-up.sh)"
  exit 1
fi

API_BODY=""

call_api() {
  local method="$1"
  local path="$2"
  local expected_status="$3"
  local body="${4:-}"
  local require_auth="${5:-1}"

  local response
  local status
  local full_url="${BASE_URL}${path}"

  local -a curl_args
  curl_args=("-sS" "-X" "$method" "$full_url" "-H" "content-type: application/json")

  if [[ "$require_auth" == "1" ]]; then
    curl_args+=("-H" "authorization: Bearer ${AIOS_INGRESS_TOKEN}")
  fi

  if [[ -n "$body" ]]; then
    curl_args+=("--data" "$body")
  fi

  response="$(curl "${curl_args[@]}" -w $'\n%{http_code}')"
  status="${response##*$'\n'}"
  API_BODY="${response%$'\n'*}"

  if [[ "$status" != "$expected_status" ]]; then
    echo "Request failed: ${method} ${path} (expected ${expected_status}, got ${status})"
    echo "Response body: ${API_BODY}"
    exit 1
  fi
}

write_json() {
  local name="$1"
  printf '%s\n' "$API_BODY" >"$TMP_DIR/$name.json"
}

assert_json() {
  local json="$1"
  local expr="$2"
  local label="$3"

  node - "$json" "$expr" "$label" <<'NODE'
const [json, expr, label] = process.argv.slice(2);
let obj;
try {
  obj = JSON.parse(json);
} catch (error) {
  console.error(`Invalid JSON for assertion '${label}'`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

let passed = false;
try {
  passed = Boolean(Function("obj", `return (${expr});`)(obj));
} catch (error) {
  console.error(`Assertion execution failed for '${label}'`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

if (!passed) {
  console.error(`Assertion failed: ${label}`);
  process.exit(1);
}
NODE
}

RANDOM_UUID() {
  node -e 'console.log(require("node:crypto").randomUUID())'
}

MISSION_ID_SUCCESS="$(RANDOM_UUID)"
MISSION_ID_FAILURE="$(RANDOM_UUID)"
RUN_ID_SUCCESS="RUN-$(date +%s)-SUCCESS"
TASK_ID_SUCCESS="TASK-$(date +%s)-SUCCESS"
RUN_ID_FAILURE="RUN-$(date +%s)-FAIL"
TASK_ID_FAILURE="TASK-$(date +%s)-FAIL"
APPROVAL_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

printf "\n==> Health baseline\n"
call_api "GET" "/health" "200" "" "0"
write_json "health.before"
assert_json "$API_BODY" 'obj.status === "ok" && obj.service === "LiNKaios"' "health ok"

if [[ "$ALLOW_DISABLED_NATS" != "1" ]]; then
  assert_json "$API_BODY" 'obj.eventBus && obj.eventBus.mode === "jetstream" && obj.eventBus.streamReady === true && obj.eventBus.dlqReady === true' "jetstream readiness"
fi

printf "\n==> Unauthorized ingress rejection check\n"
call_api "POST" "/events/urgent" "401" '{"source":"slack","tenantId":"00000000-0000-0000-0000-000000000001","summary":"unauthorized test"}' "0"
write_json "unauthorized.urgent"
assert_json "$API_BODY" 'obj.accepted === false' "unauthorized rejected"

printf "\n==> Mission success path\n"
call_api "POST" "/missions/start" "202" "$(cat <<JSON
{
  "missionId": "${MISSION_ID_SUCCESS}",
  "tenantId": "${TENANT_ID}",
  "dprId": "INT-MNG-260311-0001-LISA",
  "goal": "Pre-deployment integrated MVO validation run",
  "status": "active",
  "runId": "${RUN_ID_SUCCESS}",
  "taskId": "${TASK_ID_SUCCESS}"
}
JSON
)"
write_json "mission.start.success"
assert_json "$API_BODY" 'obj.accepted === true && obj.runId && obj.missionId' "mission start accepted"

printf "\n==> Lifecycle acceptance path\n"
call_api "POST" "/tasks/accept" "202" "$(cat <<JSON
{
  "tenantId": "${TENANT_ID}",
  "missionId": "${MISSION_ID_SUCCESS}",
  "runId": "${RUN_ID_SUCCESS}",
  "taskId": "${TASK_ID_SUCCESS}",
  "fromDprId": "INT-EXE-260311-0004-SARAH",
  "toDprId": "INT-EXE-260311-0004-SARAH",
  "summary": "Worker accepted task",
  "status": "active",
  "metadata": { "phase": "accept" }
}
JSON
)"
write_json "task.accept"
assert_json "$API_BODY" 'obj.accepted === true && obj.eventType === "aios.task.accepted"' "task accepted event emitted"

call_api "POST" "/tasks/handoff" "202" "$(cat <<JSON
{
  "tenantId": "${TENANT_ID}",
  "missionId": "${MISSION_ID_SUCCESS}",
  "runId": "${RUN_ID_SUCCESS}",
  "taskId": "${TASK_ID_SUCCESS}",
  "fromDprId": "INT-MNG-260311-0004-MARK",
  "toDprId": "INT-EXE-260311-0004-SARAH",
  "summary": "Team lead dispatched implementation",
  "detail": "handoff to FE",
  "status": "active"
}
JSON
)"
write_json "task.handoff"
assert_json "$API_BODY" 'obj.accepted === true && obj.eventType === "aios.task.handoff"' "task handoff event emitted"

call_api "POST" "/tasks/complete" "202" "$(cat <<JSON
{
  "tenantId": "${TENANT_ID}",
  "missionId": "${MISSION_ID_SUCCESS}",
  "runId": "${RUN_ID_SUCCESS}",
  "taskId": "${TASK_ID_SUCCESS}",
  "fromDprId": "INT-EXE-260311-0004-SARAH",
  "toDprId": "INT-MNG-260311-0004-MARK",
  "summary": "Worker completed task",
  "status": "active",
  "tokenUsage": 1200,
  "commandLog": [{"type":"exec","value":"pnpm test"}],
  "metadata": { "phase": "complete" }
}
JSON
)"
write_json "task.complete"
assert_json "$API_BODY" 'obj.accepted === true && obj.eventType === "aios.task.completed"' "task completed event emitted"

printf "\n==> Approval chain\n"
call_api "POST" "/approvals/request" "202" "$(cat <<JSON
{
  "tenantId": "${TENANT_ID}",
  "missionId": "${MISSION_ID_SUCCESS}",
  "runId": "${RUN_ID_SUCCESS}",
  "taskId": "${TASK_ID_SUCCESS}",
  "requestedByDprId": "INT-MNG-260311-0002-ERIC",
  "requestedByRole": "cto",
  "kind": "lesson_promotion",
  "reason": "MVO predeploy gate recommendation",
  "summary": "Promote run lesson for Chairman sign-off"
}
JSON
)"
write_json "approval.request"
assert_json "$API_BODY" 'obj.accepted === true && obj.state === "requested" && !!obj.approvalId' "approval request accepted"
APPROVAL_ID="$(node -e 'const o=JSON.parse(process.argv[1]); console.log(o.approvalId);' "$API_BODY")"

call_api "POST" "/approvals/decide" "202" "$(cat <<JSON
{
  "approvalId": "${APPROVAL_ID}",
  "tenantId": "${TENANT_ID}",
  "missionId": "${MISSION_ID_SUCCESS}",
  "runId": "${RUN_ID_SUCCESS}",
  "taskId": "${TASK_ID_SUCCESS}",
  "requestedByDprId": "INT-MNG-260311-0002-ERIC",
  "decisionByDprId": "INT-MNG-260311-0002-ERIC",
  "decisionByRole": "cto",
  "state": "recommended",
  "reason": "Technical recommendation for Chairman",
  "decidedAt": "${APPROVAL_TIME}",
  "metadata": { "gate": "cto_recommendation" }
}
JSON
)"
write_json "approval.recommended"
assert_json "$API_BODY" 'obj.accepted === true && obj.state === "recommended"' "approval recommended"

call_api "POST" "/approvals/decide" "202" "$(cat <<JSON
{
  "approvalId": "${APPROVAL_ID}",
  "tenantId": "${TENANT_ID}",
  "missionId": "${MISSION_ID_SUCCESS}",
  "runId": "${RUN_ID_SUCCESS}",
  "taskId": "${TASK_ID_SUCCESS}",
  "requestedByDprId": "INT-MNG-260311-0002-ERIC",
  "decisionByDprId": "INT-CHM-260311-0000-CHAIRMAN",
  "decisionByRole": "chairman",
  "state": "approved",
  "reason": "Chairman final approval",
  "decidedAt": "${APPROVAL_TIME}",
  "metadata": { "gate": "chairman_final" }
}
JSON
)"
write_json "approval.approved"
assert_json "$API_BODY" 'obj.accepted === true && obj.state === "approved"' "approval finalized"

printf "\n==> Controlled failure branch\n"
call_api "POST" "/missions/start" "409" "$(cat <<JSON
{
  "missionId": "${MISSION_ID_FAILURE}",
  "tenantId": "${TENANT_ID}",
  "dprId": "INT-MNG-260311-9999-NOBODY",
  "goal": "Controlled security exception branch",
  "status": "active",
  "runId": "${RUN_ID_FAILURE}",
  "taskId": "${TASK_ID_FAILURE}"
}
JSON
)"
write_json "mission.start.failure"
assert_json "$API_BODY" 'obj.accepted === false && obj.securityException && obj.action === "halt_agent_and_raise_alert"' "security exception branch"

printf "\n==> Ritual feed checks\n"
call_api "GET" "/briefings/chairman/daily?tenantId=${TENANT_ID}&runId=${RUN_ID_SUCCESS}" "200" "" "0"
write_json "briefing.strategic"
assert_json "$API_BODY" 'obj.accepted === true && obj.mode === "strategic" && obj.selectedFeed && obj.selectedFeed.pendingApprovals !== undefined' "strategic feed"

call_api "GET" "/briefings/chairman/operational-pulse?tenantId=${TENANT_ID}&runId=${RUN_ID_SUCCESS}" "200" "" "0"
write_json "briefing.operational"
assert_json "$API_BODY" 'obj.accepted === true && obj.mode === "operational" && obj.selectedFeed && obj.selectedFeed.tokenUsageTotal !== undefined' "operational feed"

call_api "GET" "/briefings/chairman/quality-gate?tenantId=${TENANT_ID}&runId=${RUN_ID_SUCCESS}&degraded=1" "200" "" "0"
write_json "briefing.quality"
assert_json "$API_BODY" 'obj.accepted === true && obj.mode === "quality" && obj.confidence && obj.confidence.flagged === true' "quality degraded confidence flag"

printf "\n==> Evidence export\n"
call_api "GET" "/evidence/mvo/predeploy?tenantId=${TENANT_ID}&runId=${RUN_ID_SUCCESS}" "200" "" "0"
write_json "evidence.run"
assert_json "$API_BODY" 'obj.accepted === true && obj.lineage.tenant_id === "00000000-0000-0000-0000-000000000001"' "run evidence tenant lineage"
assert_json "$API_BODY" 'Array.isArray(obj.events) && obj.events.some((event) => event.eventType === "aios.task.accepted")' "run evidence has accepted"
assert_json "$API_BODY" 'Array.isArray(obj.events) && obj.events.some((event) => event.eventType === "aios.task.completed")' "run evidence has completed"

call_api "GET" "/evidence/mvo/predeploy?tenantId=${TENANT_ID}" "200" "" "0"
write_json "evidence.tenant"
assert_json "$API_BODY" 'obj.accepted === true && obj.summary && obj.summary.securityExceptionObserved === true' "tenant evidence has failure branch"

printf "\n==> Post-run health\n"
call_api "GET" "/health" "200" "" "0"
write_json "health.after"
assert_json "$API_BODY" 'obj.status === "ok"' "post health ok"

TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
ARTIFACT_JSON="$OUT_DIR/mvo-predeploy-evidence-${TIMESTAMP}.json"
ARTIFACT_MD="$OUT_DIR/mvo-predeploy-summary-${TIMESTAMP}.md"

node - "$TMP_DIR" "$ARTIFACT_JSON" "$ARTIFACT_MD" "$TENANT_ID" "$RUN_ID_SUCCESS" "$RUN_ID_FAILURE" "$MISSION_ID_SUCCESS" "$MISSION_ID_FAILURE" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [
  tmpDir,
  artifactJsonPath,
  artifactSummaryPath,
  tenantId,
  successRunId,
  failureRunId,
  successMissionId,
  failureMissionId
] = process.argv.slice(2);

const names = [
  "health.before",
  "health.after",
  "unauthorized.urgent",
  "mission.start.success",
  "task.accept",
  "task.handoff",
  "task.complete",
  "approval.request",
  "approval.recommended",
  "approval.approved",
  "mission.start.failure",
  "briefing.strategic",
  "briefing.operational",
  "briefing.quality",
  "evidence.run",
  "evidence.tenant"
];

const traces = {};
for (const name of names) {
  const file = path.join(tmpDir, `${name}.json`);
  traces[name] = JSON.parse(fs.readFileSync(file, "utf8"));
}

const runEvidence = traces["evidence.run"];
const tenantEvidence = traces["evidence.tenant"];

const artifact = {
  generated_at: new Date().toISOString(),
  scope: "LiNKaios MVO pre-deployment acceptance",
  lineage: {
    tenant_id: tenantId,
    success: {
      mission_id: successMissionId,
      run_id: successRunId
    },
    failure: {
      mission_id: failureMissionId,
      run_id: failureRunId
    }
  },
  checks: {
    success_path: {
      accepted_event_emitted: runEvidence.events.some((event) => event.eventType === "aios.task.accepted"),
      completed_event_emitted: runEvidence.events.some((event) => event.eventType === "aios.task.completed"),
      approval_requested: runEvidence.audits.some((entry) => entry.status === "approval_requested"),
      approval_finalized: runEvidence.audits.some((entry) => entry.status === "approval_approved")
    },
    failure_path: {
      security_exception_observed: tenantEvidence.summary.securityExceptionObserved === true
    },
    transport: {
      nats_mode: traces["health.after"].eventBus.mode,
      stream_ready: traces["health.after"].eventBus.streamReady,
      publish_ack_mode: traces["health.after"].eventBus.publishAckMode,
      last_publish_ack: traces["health.after"].eventBus.lastPublishAck
    },
    ritual_windows: {
      strategic: traces["briefing.strategic"].mode,
      operational: traces["briefing.operational"].mode,
      quality: traces["briefing.quality"].mode,
      degraded_quality_flagged: traces["briefing.quality"].confidence?.flagged === true
    }
  },
  traces
};

fs.writeFileSync(artifactJsonPath, JSON.stringify(artifact, null, 2));

const summary = [
  "# LiNKaios MVO Pre-Deployment Acceptance",
  "",
  `- Generated: ${artifact.generated_at}`,
  `- Tenant: ${tenantId}`,
  `- Success run: ${successRunId}`,
  `- Failure run: ${failureRunId}`,
  `- Transport mode: ${artifact.checks.transport.nats_mode}`,
  `- Stream ready: ${artifact.checks.transport.stream_ready}`,
  "",
  "## Check Results",
  "",
  `- Success path emitted accepted event: ${artifact.checks.success_path.accepted_event_emitted}`,
  `- Success path emitted completed event: ${artifact.checks.success_path.completed_event_emitted}`,
  `- Approval requested captured: ${artifact.checks.success_path.approval_requested}`,
  `- Approval finalized captured: ${artifact.checks.success_path.approval_finalized}`,
  `- Failure path security exception observed: ${artifact.checks.failure_path.security_exception_observed}`,
  `- Quality degraded confidence flagged: ${artifact.checks.ritual_windows.degraded_quality_flagged}`,
  "",
  `Artifact JSON: ${artifactJsonPath}`
].join("\n");

fs.writeFileSync(artifactSummaryPath, summary);
NODE

printf "\nPre-deployment acceptance harness passed.\n"
echo "Artifact JSON: $ARTIFACT_JSON"
echo "Artifact summary: $ARTIFACT_MD"
