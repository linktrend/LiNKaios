# AIOS Codex Handoff Brief (No Prior Context Assumed)

Last updated: 2026-03-12
Repo root: `/Users/linktrend/Projects/AIOS`
Primary remote: `https://github.com/linktrend/AIOS`
Current local branch: `minicodex/startdev`

## 1) What this repository is

This repository is the LiNKtrend AIOS control-plane monorepo for building and operating an autonomous venture studio system.

- **Monorepo tech stack**: Turborepo + pnpm for TS/Node, uv for Python workers.
- **Control plane app**: `apps/LiNKaios` (Paperclip-style orchestration adapter).
- **Automation/workflows app**: `apps/LiNKautowork` (n8n workflow assets + env resolution).
- **Shared packages**:
  - `packages/linkskills`: payload contracts/schemas.
  - `packages/linklogic`: tenant/DPR checks, identity parsing, checksums, run-id, GSM provider.
  - `packages/linkbrain`: Supabase SQL migrations + RPC model for memory/audit.
- **Agent personas**: `agents/internal/managers` and `agents/internal/workers` using DPR V3 IDs.
- **External engines (forked source-of-truth repos)** are cloned into `linkbots/` and intentionally gitignored.

## 2) Canonical product scope and authority

- Master product/engineering source of truth: `docs/AIOS_MASTER_SPEC.md`
- Security/secret policy: `docs/SECRET_MANAGEMENT.md`
- MVO runbook/checklists/tests:
  - `docs/PHASE1_MVO_RUNBOOK.md`
  - `docs/PHASE1_COMPLETION_CHECKLIST.md`
  - `docs/MVO_TEST_PLAN.md`

If a thread conflicts with the master spec, the spec wins unless explicitly superseded by Chairman-level decision.

## 3) Finalized architecture and naming decisions

### 3.1 Workforce and identity model

- DPR V3 immutable identity format: `[TYPE]-[GRADE]-[YYMMDD]-[UUID_SHORT]-[NAME]`
- Internal path topology:
  - `agents/internal/managers/*`
  - `agents/internal/workers/*`
- Current internal squad baseline:
  - Managers: LISA (CEO), ERIC (CTO), JOHN (PO)
  - Workers: SARAH (BE), MIKE (FE), KATE (QA)
- `IDENTITY.md` includes role, department, `authorized_tenant_id`, channels, permissions.

### 3.2 Memory/data model

Supabase schemas:

- `core`: tenant registry and helper functions.
- `shared_memory`: long-term memory + missions/policies/proposals/lessons/audit.
- `scratch_memory`: temporary working memory.

RLS and tenant contract:

- Every tenant-scoped table has `tenant_id`.
- Security-definer RPC strategy is used for data operations.
- Tenant hard-fail behavior is enforced through `core.current_tenant()` semantics.

### 3.3 Secrets and naming standard

Canonical production naming pattern is now:

- `LINKTREND_AIOS_PROD_[RESOURCE]`

Important canonical resources used by code:

- `LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE`
- `LINKTREND_AIOS_PROD_OPENROUTER_API_KEY`
- `LINKTREND_AIOS_PROD_POSTMARK_SERVER_TOKEN`
- `LINKTREND_AIOS_PROD_ANTHROPIC_API_KEY`

### 3.4 Strategic subsystem branding

- Strategic council integration is branded **LiNKboard** in app-level naming.
- Upstream source directory remains `linkbots/llm-council` (explicitly not renamed).

## 4) Current repository structure

```text
linktrend-aios/
├── docs/
│   ├── AIOS_MASTER_SPEC.md
│   ├── SECRET_MANAGEMENT.md
│   ├── PHASE1_MVO_RUNBOOK.md
│   ├── PHASE1_COMPLETION_CHECKLIST.md
│   ├── MVO_TEST_PLAN.md
│   └── CODEX_HANDOFF_BRIEF.md   <-- this file
├── infra/
│   ├── debian-vps/
│   └── mac-mini/
├── packages/
│   ├── linkbrain/
│   ├── linklogic/
│   └── linkskills/
├── apps/
│   ├── LiNKaios/
│   └── LiNKautowork/
├── agents/
│   └── internal/
├── linkbots/
│   ├── paperclip/
│   ├── openclaw/
│   ├── agent-zero/
│   └── llm-council/
└── scripts/
```

## 5) What was implemented in this development session

### 5.1 Upstream and monorepo alignment

- `scripts/bootstrap-upstreams.sh` updated to use LiNKtrend forks for all engines including `link-llm-council`.
- `linkbots/` kept gitignored by design (deployment must run bootstrap script).

### 5.2 Security hardening in LiNKaios

- Added authenticated ingress requirement for all POST routes.
  - Accepts bearer token or `x-aios-ingress-token`.
- Removed payload-provided `identityPath` trust.
  - Identity path is now resolved server-side from allowlisted agent DPR directories.
- Retained tenant + DPR mismatch checks and security exception logging.

### 5.3 Canonical GSM naming adoption

- LiNKaios and LiNKautowork env loaders updated to canonical secret names.
- `.env.example` templates aligned to canonical naming.
- Secret management docs aligned.

### 5.4 LiNKboard integration

- Added strategic synthesis client in LiNKaios (`src/linkboard.ts`).
- Mission pipeline logs LiNKboard output into audit details when configured.
- Compose includes optional upstream `linkboard` service mapping to `linkbots/llm-council`.

### 5.5 Linkbrain RPC contract change (critical)

To handle non-sticky PostgREST sessions, public RPC wrappers were updated to accept `p_tenant` and set tenant context inside a single call. This avoids relying on a separate `set_tenant_context` HTTP request.

### 5.6 Agent operational config finalization

- All manager/worker `IDENTITY.md` files enriched with channels and permissions.
- Worker `soul.md` and `memory.md` files added for all internal workers.

### 5.7 Security/dependency checks

- Added pnpm override for `@tootallnate/once` vulnerability chain.
- `pnpm audit` result: no known vulnerabilities.

## 6) Live environment actions already performed

### 6.1 Supabase

- SQL delta (tenant-aware wrappers + helper RPCs) was reported as applied by user.
- Live acceptance data exists in `shared_memory.audit_runs` for run `LT-ALPHA-001` using an auto-generated tenant UUID.
- `bootstrap_tenant` currently creates random tenant IDs unless fixed-ID row already exists.

### 6.2 GSM / GCP

- Project in use: `linkbot-901208`
- Active account used during session: `info@linktrend.media`
- Service account key generated locally for testing:
  - `/Users/linktrend/Projects/AIOS/secrets/gcp-sa.json`
- Service account granted role:
  - `roles/secretmanager.secretAccessor`
- Secret objects have version 1 values now.
  - Note: some were placeholders pending real production tokens.

## 7) Important open risks / blockers

1. **Canonical internal tenant ID mismatch in live DB**
   - Agents use `authorized_tenant_id = 00000000-0000-0000-0000-000000000001`.
   - Workstream evidence used an auto-generated tenant UUID when bootstrapping via RPC.
   - A fixed row for `000...001` must exist in `core.tenants` in live Supabase.

2. **Potential SQL defect in migration file to verify before next apply**
   - In `packages/linkbrain/migrations/0001_init.sql`, validate `shared_memory.upsert_mission` insert values count matches columns (created_by_agent appears duplicated in current local file snapshot).
   - New Codex instance should fix this immediately before further migration rollouts.

3. **GSM secret payload quality**
   - Supabase role secret is set; OpenRouter/Postmark/Anthropic may still contain placeholders.
   - Replace with production values before final deployment.

4. **Uncommitted working tree is heavily dirty**
   - There are many path renames/deletes from prior refactors and this session.
   - New Codex should carefully review `git status` and avoid destructive resets.

## 8) Workstream 9 evidence status (what has already been proven)

Evidence retrieved from live `shared_memory.audit_runs` includes:

- `LT-ALPHA-001 / TASK-CEO-001` => `active`, DPR recorded, tenant gate pass.
- `LT-ALPHA-001 / TASK-SEC-001` => `security_exception`, DPR recorded, tenant gate fail.

This demonstrates audit trace capture and security-gate logging behavior.

## 9) Immediate takeover checklist for next Codex instance

1. Read:
   - `docs/AIOS_MASTER_SPEC.md`
   - `docs/SECRET_MANAGEMENT.md`
   - `docs/DEPLOYMENT_ACTION_PLAN_PHASE1_PHASE2.md` (created in this handoff)
2. Inspect and reconcile current dirty working tree with intended renames.
3. Fix/validate migration SQL correctness (`upsert_mission` values issue).
4. Ensure live DB has fixed internal tenant row `000...001`.
5. Replace placeholder GSM values with real production keys.
6. Re-run:
   - `pnpm install`
   - `pnpm test`
   - `./scripts/mvo-validate.sh`
   - `pnpm audit --prod --audit-level=low`
7. Re-run Workstream 9 on canonical tenant ID and capture final proof artifacts.

## 10) Ground rules for continuation

- Do not edit anything under `linkbots/` beyond pulling from upstream forks.
- Keep `linkbots/` gitignored.
- Keep secrets out of git; `secrets/` and `.env` remain local only.
- All new architecture/security decisions must update `docs/AIOS_MASTER_SPEC.md` in same change set.
