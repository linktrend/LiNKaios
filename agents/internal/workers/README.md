# Agent Zero Worker Runtimes

This folder hosts uv-managed Python worker entrypoints for MVO roles.
Each worker folder contains:

- `IDENTITY.md` for DPR, tenant binding, and channel permissions.
- `soul.md` for stable persona constraints.
- `memory.md` for short-term work log prior to promotion.
- `main.py` for execution runtime entrypoint.

## Setup

```bash
cd agents/internal/workers
uv sync
```

## Run a worker

```bash
AIOS_TASK_PAYLOAD='{"tenant_id":"00000000-0000-0000-0000-000000000001","dpr_id":"INT-EXE-260311-0005-MIKE","run_id":"run_001","task_id":"task_001"}' \
AIOS_STATUS=active \
uv run python INT-EXE-260311-0005-MIKE/main.py
```

Workers reject malformed payloads and unsupported status values.
