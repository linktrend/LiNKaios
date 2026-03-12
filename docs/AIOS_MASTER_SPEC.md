# AIOS Master Spec

- Spec Version: 1.0.0
- Last Updated: 2026-03-11
- Decision Owners: Chairman, Studio CEO, Studio CTO
- Canonicality: This file is the source of truth for all AIOS development threads.

## Change Log

- 1.0.0: Initial integrated implementation contract for MVO and Phase 2.

## Governance and Update Protocol

1. Any architecture, security, or workflow decision changes must update this file in the same change set.
2. If thread-level guidance conflicts with this file, this file wins unless explicitly superseded by Chairman approval.
3. Production-impacting changes require CEO + CTO review and audit note in `shared_memory.proposals`.

## Product Intent

LiNKtrend AIOS is a venture-factory operating system where a single Chairman governs a digital workforce that can build, launch, and scale software ventures with strict budget, security, and traceability controls.

## Architecture Overview

### 3-Tier Workforce

1. Orchestration: Paperclip control plane for mission scheduling, hierarchy, and heartbeat management.
2. Management: OpenClaw manager personas (CEO, CTO, PO, Team Lead) for planning, governance, and delegation.
3. Execution: Agent Zero worker personas (FE, BE, QA) for terminal-native implementation and testing.

### 5-Layer Cognitive Infrastructure

1. Context: LiNKbrain memory (Supabase + pgvector).
2. Data: Multi-tenant row-isolated data model.
3. Intelligence: Daily synthesis and strategic council workflows.
4. Automation: Heartbeat + event-driven trigger loop.
5. Build: Internal developer platform for repeatable deployment.

## Phase Definitions

### Phase 1: MVO

- Infrastructure:
  - Debian 12 VPS for orchestration and integration plane.
  - Mac mini execution node for local worker model serving and execution runtimes.
- Persona baseline:
  - Managers: CEO, CTO, PO, Team Lead.
  - Workers: FE Developer, BE Developer, QA Engineer.
- Core integrations:
  - Paperclip, OpenClaw, Agent Zero, Supabase, n8n, Postmark, Google Drive, Ollama.
- Operational cadence:
  - 60-minute heartbeat for baseline triage.
  - Event-driven interrupts via Slack + webhook/email.
- Budget policy:
  - Operating target: USD 500/month.
  - Hard cap: USD 1000 for initial launch phase.

### Phase 2: Full AIOS

1. LiNKboard strategic council inside production strategic loop.
2. Cloudflare Logic Gateway/VPN hardening extension.
3. Automated Daily Brief synthesis from run logs.
4. Venture kill-switch for runaway process and spend protection.
5. Autonomous budget rebalancing across ventures.
6. Self-healing workflows for crashed containers or nodes.
7. Secrets migration from host `.env` to managed vault.

## Security Contract

1. Agents are forbidden from direct table access.
2. Sensitive data operations are only through `SECURITY DEFINER` RPC/functions.
3. Every query path requires tenant context; missing tenant context must hard-fail.
4. Every row in every table includes `tenant_id`.
5. Tenant authority source is Paperclip mission metadata.
6. On task wake, each agent verifies payload tenant vs local identity tenant; mismatch halts execution and logs security exception.

## Secret Management Contract

1. Production secret source of truth is Google Secret Manager (GSM).
2. MVO transition flow allows local `.env` fallback only when GSM retrieval is unavailable.
3. Secret names follow `LINKTREND_[SERVICE]_[ENV]_[RESOURCE]_[IDENTIFIER]`.
4. Runtime secret retrieval always targets `versions/latest` to support rotation without code changes.
5. No Google Project IDs are hard-coded in code; project and credentials are read from environment.

### Initial GSM Secrets for MVO

- `LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE`
- `LINKTREND_AIOS_PROD_POSTMARK_SERVER_TOKEN`
- `LINKTREND_AIOS_PROD_OPENROUTER_API_KEY`
- `LINKTREND_AIOS_PROD_ANTHROPIC_API_KEY`
- `LINKTREND_AIOS_PROD_N8N_WEBHOOK_SIGNING_KEY`
- `LINKTREND_AIOS_PROD_GDRIVE_SERVICE_ACCOUNT_JSON`

## LiNKbrain Data Contract

### Schemas

- `core`: tenant registry and shared guardrail helpers.
- `shared_memory`: long-term collective knowledge and audit trail.
- `scratch_memory`: transient agent working memory.

### Required Tables

- `core.tenants`
- `shared_memory.missions`
- `shared_memory.policies`
- `shared_memory.proposals`
- `shared_memory.lessons`
- `shared_memory.audit_runs`
- `scratch_memory.entries`

### Vector Search

- `pgvector` enabled.
- Embedding model: `nomic-embed-text` (768 dimensions) via Ollama hosted on Mac mini.
- Embeddings are columns on domain tables (`missions`, `policies`, `proposals`, `lessons`).

### Memory Promotion

- Promotion source: `scratch_memory.entries`.
- Auto-promotion threshold: confidence `>= 0.85`.
- Every auto-promotion marked `requires_review` for daily CEO/CTO validation.

## Hot/Cold Storage Lifecycle

1. Hot storage: Supabase buckets for active files, OCR payloads, and active RAG data.
2. Cold storage: Google Drive under `/LiNKtrend-Archives/{Venture_Name}/{Project_Name}_{Project_ID}/`.
3. Migration triggers:
   - 30 days inactivity, or
   - project status transitions to `handover_pending`.
4. Archive procedure:
   - Copy to Drive.
   - Verify checksum.
   - Delete hot object.
   - Persist metadata pointer (Drive file ID, checksum, source path).
5. Restore mode: manual-only by CTO or CEO approval.

## Workflow and Status Contract

- Allowed statuses: `active`, `paused`, `handover_pending`, `archived`.
- Required run metadata: `run_id`, `task_id`, `dpr_id`, `tenant_id`.
- Supabase remains system of record for mission state, policy/proposal state, lessons, and run-level audit logs.

## MVO Workstream Sequence

1. Monorepo and runtime foundation.
2. Cross-agent task contract scaffolding.
3. LiNKbrain schema + RPC layer.
4. Local/global memory implementation.
5. Audit telemetry flow.
6. Storage migration workflows.
7. Event ingestion and notifications.
8. Infrastructure hardening and trusted ingress.
9. End-to-end acceptance run.

## Acceptance Criteria

1. Chairman sets mission.
2. CEO decomposes strategy into executable tasks.
3. CTO validates governance and quality gates.
4. Worker agents execute and report against run IDs.
5. QA agent verifies outputs.
6. Chairman receives synthesis report including completion and token/cost telemetry.

## Defaults and Assumptions

- Service-role style backend credential is used in MVO, constrained by RPC-only access pattern and tenant-context enforcement.
- GSM is authoritative in production; `.env` fallback is MVO-only transitional behavior.
- Mac mini hosts embedding service for entire stack during MVO.
