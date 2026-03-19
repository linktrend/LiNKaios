# MVO Execution Ledger

Last updated: 2026-03-19
Owner: Chairman / CEO / CTO

## Decision Baseline

- Messaging bus: NATS (Paperclip-owned canonical schema)
- Channel model: Slack-only for MVO
- Telegram: disabled
- Chairman final approvals: 08:00 Asia/Taipei via Slack thread sign-off
- Rollout order: local validation first, then VPS + Mac mini canonical run

## Repo Ownership

- Paperclip: canonical NATS subjects and orchestration routing
- OpenClaw: management agent producers/consumers for canonical subjects
- AgentZero: worker producers/consumers for canonical subjects
- AIOS: control-plane adapter, tenant/security contract, LiNKbrain persistence bindings
- LiNKskills: runtime skill fragment serving contract
- LiNKautomations: n8n automation templates and production workflows

## Gate Status

| Gate | Description | Status | Owner | Notes |
| --- | --- | --- | --- | --- |
| 0 | Program lock + shared baseline | completed | CEO/CTO | Decision baseline locked for NATS + Slack + ritual windows |
| 1 | Personnel completion (MARK/ALEX) | completed | CEO/Team Lead | Roster includes MARK and ALEX in discovery/readiness output |
| 2 | Per-agent configuration readiness | completed (AIOS scope) | CTO/Team Lead | Operational certification checks pass for initial 8-agent roster |
| 3 | NATS handoff layer | completed (publisher + consumer contract scope) | Paperclip/CTO | Canonical `aios.*` stream/bootstrap plus OpenClaw/AgentZero consumer retry and dead-letter termination paths |
| 4 | LiNKbrain + LiNKskills integration | completed (AIOS bridge scope) | CTO | Managed-run bridge includes lineage/idempotency and async run polling, persisted to audit |
| 5 | Automation productionization | in_progress (external repo execution) | Ops | LiNKautowork is authoritative for templates/activation lifecycle; AIOS is mirror-only |
| 6 | Slack operating model | completed (AIOS scope) | CEO/Ops | Approval vs ops webhook routing split and deterministic fallback in LiNKaios |
| 7 | Telemetry + evidence package | completed (pre-deployment harness) | CTO/QA | `scripts/mvo-predeploy-acceptance.sh` generates reproducible evidence artifact |
| 8 | Final E2E acceptance | pending | Chairman | Run on target deployment (VPS/Mac) after cross-repo gates close |

## Remaining Cross-Repo Dependencies (Blocking Final Gate)

1. LiNKautowork production activation: import/activate approved templates, credentials, and schedules in live n8n.
2. LiNKskills production rollout hardening outside AIOS bridge scope (runtime service SLOs/policy locks).
3. OpenClaw + AgentZero runtime activation in target environment (workers must be running during acceptance run).
4. Deployment-environment sign-off (VPS/Mac) and Chairman final acceptance run at full topology.
