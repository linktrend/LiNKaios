# LiNKtrend AIOS Monorepo

This repository hosts the AIOS platform implementation.

Canonical spec: `docs/AIOS_MASTER_SPEC.md`
MVO runbook: `docs/PHASE1_MVO_RUNBOOK.md`

## Stack baseline

- Monorepo: Turborepo + pnpm
- TypeScript/Node: orchestration apps and shared packages
- Python: uv-managed worker runtimes
- Memory plane: Supabase (Postgres + pgvector)
- Hot/cold storage orchestration: n8n + Google Drive

## Workspace layout

- `docs/`: cross-thread product and engineering specs
- `infra/`: Debian VPS and Mac mini operational configs
- `packages/`: shared platform packages (Studio Brain SQL, interfaces, shared logic)
- `apps/`: service applications (Paperclip adapter, n8n workflow assets)
- `agents/`: manager and worker personas/runtime skeletons

## Quick start

1. Install dependencies:
   - `pnpm install`
2. Clone required upstreams:
   - `./scripts/bootstrap-upstreams.sh`
3. Configure environment:
   - `cp .env.example .env` and fill values
4. Start core MVO stack:
   - `./scripts/mvo-up.sh`
5. Start extended stack with upstream services:
   - `./scripts/mvo-up-upstreams.sh`
6. Validate repository and compose config:
   - `./scripts/mvo-validate.sh`
