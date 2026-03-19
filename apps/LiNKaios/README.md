# LiNKaios Service Adapter

Control-plane adapter for MVO mission intake, canonical `aios.*` event publishing, LiNKskills managed execution, LiNKbrain audit persistence, and Slack operations/approval signaling.

Canonical internal tenant UUID for MVO fixtures/examples:

- `00000000-0000-0000-0000-000000000001`

## Endpoints

- `GET /health`
- `GET /agents/discovery`
- `GET /briefings/chairman/daily?tenantId=<uuid>&runId=<optional>`
- `GET /briefings/chairman/operational-pulse?tenantId=<uuid>&runId=<optional>`
- `GET /briefings/chairman/quality-gate?tenantId=<uuid>&runId=<optional>`
- `GET /evidence/mvo/predeploy?tenantId=<uuid>&runId=<optional>`
- `GET /persona/readiness?tenantId=<uuid>`
- `GET /persona/entities?tenantId=<uuid>&entityKind=<optional>`
- `GET /persona/revisions?tenantId=<uuid>&entityId=<optional>`
- `GET /persona/approvals/queue?tenantId=<uuid>&status=<optional(review|approved)>`
- `GET /persona/compile/preview?tenantId=<uuid>&dprId=<id>`
- `GET /persona/compile/diff?tenantId=<uuid>&dprId=<id>`
- `GET /persona/bundles/:dprId?tenantId=<uuid>`
- `GET /persona/sync/bundle?tenantId=<uuid>&dprId=<id>&expectedRevision=<optional-hash>`
- `GET /persona/migration/parity?tenantId=<uuid>`
- `GET /persona/migration/evidence?tenantId=<uuid>`
- `POST /missions/start`
- `POST /tasks/handoff`
- `POST /tasks/accept`
- `POST /tasks/complete`
- `POST /skills/execute`
- `POST /approvals/request`
- `POST /approvals/decide`
- `POST /events/urgent`
- `POST /persona/entities`
- `POST /persona/revisions`
- `POST /persona/revisions/publish`
- `POST /persona/revisions/rollback`
- `POST /persona/sync/ack`
- `POST /persona/migration/import-local`
- `POST /persona/migration/compile-all`
- `POST /persona/migration/apply-v1`
- `POST /policies/evaluate`
- `POST /policies/killswitch`

## Event Bus Contract

- Primary taxonomy is Paperclip canonical `aios.*`.
- Transport mode is JetStream publish with `msgID = idempotencyKey`.
- Health output includes stream readiness, publish ack mode, and last publish ack/error.

## Governance and Messaging

- Slack-only operations for MVO (Telegram disabled).
- Approval events route to approvals webhook first, fallback to operations webhook.
- Non-approval operational events route to operations webhook.
- Persona lifecycle actions emit canonical `aios.*` progress/security/approval events.
- Ritual support surfaces:
  - 08:00 Asia/Taipei strategic window.
  - 10:45 Asia/Taipei operational pulse window.
  - 14:45 Asia/Taipei quality gate window.

## Security Behavior

- All POST routes require ingress token:
  - `Authorization: Bearer <AIOS_INGRESS_TOKEN>`, or
  - `x-aios-ingress-token: <AIOS_INGRESS_TOKEN>`
- Mission/agent validation enforces tenant+DPR identity binding via local `IDENTITY.md`.
- Security mismatches emit `aios.security.exception` and audit traces.
- LiNKskills requests include mission lineage and idempotency.

## MVO Pre-Deployment Harness

- Run stack:
  - `./scripts/mvo-up.sh`
- Execute end-to-end pre-deployment harness:
  - `./scripts/mvo-predeploy-acceptance.sh`
- Evidence artifact output:
  - `artifacts/mvo-predeploy/*.json`
