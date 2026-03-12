from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass


@dataclass
class TaskContext:
    tenant_id: str
    dpr_id: str
    run_id: str
    task_id: str


ALLOWED_STATUSES = {"active", "paused", "handover_pending", "archived"}


def load_context() -> TaskContext:
    payload = os.getenv("AIOS_TASK_PAYLOAD", "{}")
    data = json.loads(payload)
    missing = [k for k in ("tenant_id", "dpr_id", "run_id", "task_id") if k not in data]
    if missing:
        raise ValueError(f"Missing payload keys: {', '.join(missing)}")
    return TaskContext(
        tenant_id=data["tenant_id"],
        dpr_id=data["dpr_id"],
        run_id=data["run_id"],
        task_id=data["task_id"],
    )


def main() -> int:
    ctx = load_context()
    status = os.getenv("AIOS_STATUS", "active")
    if status not in ALLOWED_STATUSES:
        raise ValueError("Invalid AIOS_STATUS")

    print(
        json.dumps(
            {
                "ok": True,
                "dpr_id": ctx.dpr_id,
                "tenant_id": ctx.tenant_id,
                "run_id": ctx.run_id,
                "task_id": ctx.task_id,
                "status": status,
            }
        )
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # pragma: no cover
        print(json.dumps({"ok": False, "error": str(exc)}), file=sys.stderr)
        raise SystemExit(1)
