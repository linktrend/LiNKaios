# MVO Test Plan

## Contract Tests

1. Mission payload rejects missing `tenantId`, `runId`, `taskId`, `dprId`.
2. Mission status accepts only `active`, `paused`, `handover_pending`, `archived`.
3. LiNKskills contract rejects malformed execution fragments.
4. NATS event envelope rejects missing canonical metadata fields.
5. Approval state transitions allow only `requested -> recommended -> approved|rejected`.
6. `POST /tasks/accept` emits `aios.task.accepted` and persists audit trail.
7. `POST /tasks/complete` emits `aios.task.completed` and persists audit trail.

## Security Tests

1. Tenant mismatch between mission payload and `IDENTITY.md` halts mission.
2. Missing `app.current_tenant` causes RPC failure.
3. Cross-tenant reads/writes are denied by policy and RPC checks.
4. Telegram channel path remains disabled for MVO.
5. Unauthorized Slack-triggered requests fail ingress/auth checks.
6. Invalid DPR path lookup triggers `aios.security.exception` with audit trace.

## Memory Tests

1. Ollama embedding returns 768-d vector (`nomic-embed-text`).
2. `lb_scratch.entries` to `lb_shared.lessons` promotion enforces threshold >= 0.85.
3. Promoted lessons are created with `requires_review = true`.
4. Promotion decisions require CEO/CTO recommendation before Chairman final approval.

## Storage Lifecycle Tests

1. Inactivity trigger at 30 days identifies archive candidates.
2. Handover trigger archives assets regardless of inactivity timer.
3. Archive flow verifies checksum before hot object deletion.
4. Metadata pointer stores Drive file ID and checksum.
5. Restore requires CEO/CTO recommendation and Chairman final approval.

## Transport and Automation Tests

1. `aios.task.*` event subjects are emitted on JetStream-backed canonical stream.
2. Duplicate event replays are idempotent by `idempotency_key`.
3. Dead-letter handling remains consumer-managed and reported in health metadata.
4. Heartbeat triage flow runs on heartbeat trigger and emits CEO/CTO priority packet.
5. Urgent interrupt flow validates tenant and routes to orchestration.
6. Daily 08:00 briefing includes pending approvals and decision prompts.
7. 10:45 operational pulse feed and 14:45 quality gate feed are available.

## Pre-Deployment Harness

Run one deterministic harness before deployment:

1. `./scripts/mvo-predeploy-acceptance.sh`
2. Validate generated artifacts in `artifacts/mvo-predeploy/`.
3. Confirm lineage reconstruction contains `tenant_id`, `run_id`, `task_id`, `dpr_id`.
4. Confirm both success path and controlled failure branch are captured.

## End-to-End Acceptance Scenario

1. Chairman creates mission.
2. CEO decomposes, CTO validates, Team Lead orchestrates.
3. FE/BE/UIUX worker agents execute.
4. QA validates and reports.
5. Chairman receives synthesis summary with token/cost and `run_id` audit lineage.
