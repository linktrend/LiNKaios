# Phase 1 MVO Runbook

## 1) Prerequisites

- Debian 12 VPS with Docker + Compose + UFW
- Mac mini with Ollama + uv + Tailscale
- Supabase project with service-role key and database access
- Postmark credentials
- Google Workspace service account for Drive archive automation
- NATS server reachable for cross-agent handoff transport

## 2) Repository bootstrap

```bash
pnpm install
./scripts/bootstrap-upstreams.sh
```

## 3) LiNKbrain migration

```bash
export DATABASE_URL='postgresql://...'
./packages/linkbrain/scripts/apply-migrations.sh
psql "$DATABASE_URL" -f packages/linkbrain/scripts/bootstrap-aios-tenant.sql
```

## 4) Environment setup

- Copy `.env.example` to `.env`
- Fill non-secret settings and `*_SECRET_NAME` references only
- Do not store raw credentials in `.env`; all sensitive values resolve from GSM
- Fill NATS, Slack channel routing, and endpoint settings
- Ensure `.env` is never committed

## 5) Start MVO stack

Core stack:

```bash
./scripts/mvo-up.sh
```

Extended stack with upstream services:

```bash
./scripts/mvo-up-upstreams.sh
```

## 6) n8n workflows import

- Canonical templates now live in `/Users/linktrend/Projects/LiNKautowork/automations/templates/`
- AIOS copies are mirror-only artifacts; do not treat AIOS as template source of truth
- Use `/Users/linktrend/Projects/LiNKautowork/ops/sync-templates-from-aios.sh` only for mirror refresh operations
- Configure credentials for Supabase, Google Drive, Postmark
- Enable workflows after credential validation

## 7) Agent readiness

- Manager personas exist under `linkbots/internal/managers/*` including Team Lead MARK
- Worker runtimes initialized with `uv sync` under `linkbots/internal/workers` including UI/UX ALEX
- Tenant IDs in `IDENTITY.md` match Paperclip mission tenant
- Worker and manager `AGENTS.md`, `soul.md`, and `memory.md` are present and role-specific
- Worker runtime env includes `AIOS_API_URL`, `AIOS_INGRESS_TOKEN`, and mission context (`mission_id`) for `/skills/execute`
- Telegram is disabled and Slack routing is configured

## 8) Operational validation

```bash
./scripts/mvo-validate.sh
curl -s http://localhost:4000/health
./scripts/mvo-predeploy-acceptance.sh
```

Unified cross-repo startup + health order:

- `/Users/linktrend/Projects/LiNKaios/docs/UNIFIED_DEV_TEST_RUNBOOK.md`
- `./scripts/unified-dev-check.sh`

Expected outputs after pre-deployment harness:

- `artifacts/mvo-predeploy/mvo-predeploy-evidence-*.json`
- `artifacts/mvo-predeploy/mvo-predeploy-summary-*.md`

## 9) Acceptance sequence

1. Chairman creates mission.
2. CEO decomposes mission.
3. CTO applies governance checks.
4. Team Lead orchestrates execution handoffs.
5. FE/BE/UIUX workers execute and report.
6. QA validates.
7. Chairman final-approves protected decisions at 08:00 Asia/Taipei.
8. 10:45 operational pulse and 14:45 quality gate feeds are available for automation consumption.
9. Final synthesis includes run IDs and cost telemetry.
