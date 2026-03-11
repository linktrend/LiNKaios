# Agent Zero Worker Runtimes

This folder hosts uv-managed Python worker entrypoints for MVO roles.

## Setup

```bash
cd agents/workers
uv sync
```

## Run a worker

```bash
AIOS_TASK_PAYLOAD='{"tenant_id":"00000000-0000-0000-0000-000000000001","agent_id":"fe-dev","run_id":"run_001","task_id":"task_001"}' \
AIOS_STATUS=active \
uv run python fe-dev/main.py
```

Workers reject malformed payloads and unsupported status values.
