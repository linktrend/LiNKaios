# Phase 1 MVO Runbook

## 1) Prerequisites

- Debian 12 VPS with Docker + Compose + UFW
- Mac mini with Ollama + uv + Tailscale
- Supabase project with service-role key and database access
- Postmark credentials
- Google Workspace service account for Drive archive automation

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
- Fill Supabase URL, service key, Postmark, and Ollama endpoints
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

- Import files from `apps/LiNKautowork/workflows/`
- Configure credentials for Supabase, Google Drive, Postmark
- Enable workflows after credential validation

## 7) Agent readiness

- Manager personas exist under `agents/internal/managers/*`
- Worker runtimes initialized with `uv sync` under `agents/internal/workers`
- Tenant IDs in `IDENTITY.md` match Paperclip mission tenant

## 8) Operational validation

```bash
./scripts/mvo-validate.sh
curl -s http://localhost:4000/health
```

## 9) Acceptance sequence

1. Chairman creates mission.
2. CEO decomposes mission.
3. CTO applies governance checks.
4. FE/BE workers execute and report.
5. QA validates.
6. Final synthesis includes run IDs and cost telemetry.
