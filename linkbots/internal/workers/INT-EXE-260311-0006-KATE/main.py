from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any


DEFAULT_CAPABILITY_ID = "persistent-qa"
ALLOWED_STATUSES = {"active", "paused", "handover_pending", "archived"}


@dataclass
class TaskContext:
    tenant_id: str
    dpr_id: str
    run_id: str
    task_id: str
    mission_id: str
    capability_id: str
    input_payload: dict[str, Any] = field(default_factory=dict)
    context_refs: list[str] = field(default_factory=list)
    step_scope: str = "phase.execute"


def load_context() -> TaskContext:
    raw_payload = os.getenv("AIOS_TASK_PAYLOAD", "{}")
    data = json.loads(raw_payload)

    missing = [k for k in ("tenant_id", "dpr_id", "run_id", "task_id") if k not in data]
    if missing:
        raise ValueError(f"Missing payload keys: {', '.join(missing)}")

    mission_id = str(data.get("mission_id") or os.getenv("AIOS_MISSION_ID", "")).strip()
    if not mission_id:
        raise ValueError("Missing mission_id: provide mission_id in AIOS_TASK_PAYLOAD or AIOS_MISSION_ID")

    input_payload = data.get("input_payload") or {}
    if not isinstance(input_payload, dict):
        raise ValueError("input_payload must be an object")

    context_refs_raw = data.get("context_refs") or []
    if not isinstance(context_refs_raw, list):
        raise ValueError("context_refs must be a list")

    context_refs = [str(item) for item in context_refs_raw]
    capability_id = str(
        data.get("capability_id")
        or os.getenv("AIOS_LINKSKILLS_CAPABILITY_ID", DEFAULT_CAPABILITY_ID)
    ).strip()
    if not capability_id:
        raise ValueError("capability_id is required")

    step_scope = str(data.get("step_scope") or os.getenv("AIOS_LINKSKILLS_STEP_SCOPE", "phase.execute"))

    return TaskContext(
        tenant_id=str(data["tenant_id"]),
        dpr_id=str(data["dpr_id"]),
        run_id=str(data["run_id"]),
        task_id=str(data["task_id"]),
        mission_id=mission_id,
        capability_id=capability_id,
        input_payload=input_payload,
        context_refs=context_refs,
        step_scope=step_scope,
    )


def execute_managed_skill(ctx: TaskContext) -> dict[str, Any]:
    aios_api_url = os.getenv("AIOS_API_URL", "").strip()
    if not aios_api_url:
        raise ValueError("AIOS_API_URL is required for managed skill execution")

    ingress_token = os.getenv("AIOS_INGRESS_TOKEN", "").strip()
    if not ingress_token:
        raise ValueError("AIOS_INGRESS_TOKEN is required for managed skill execution")

    endpoint = f"{aios_api_url.rstrip('/')}/skills/execute"
    request_payload = {
        "tenantId": ctx.tenant_id,
        "missionId": ctx.mission_id,
        "runId": ctx.run_id,
        "taskId": ctx.task_id,
        "dprId": ctx.dpr_id,
        "capabilityId": ctx.capability_id,
        "inputPayload": ctx.input_payload,
        "contextRefs": ctx.context_refs,
        "stepScope": ctx.step_scope,
    }

    request = urllib.request.Request(
        endpoint,
        data=json.dumps(request_payload).encode("utf-8"),
        headers={
            "content-type": "application/json",
            "authorization": f"Bearer {ingress_token}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            response_raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        error_raw = exc.read().decode("utf-8")
        try:
            error_payload = json.loads(error_raw)
            reason = error_payload.get("reason") or error_payload.get("error") or error_raw
        except json.JSONDecodeError:
            reason = error_raw
        raise RuntimeError(f"AIOS /skills/execute failed ({exc.code}): {reason}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"AIOS /skills/execute unreachable: {exc.reason}") from exc

    try:
        response_payload = json.loads(response_raw) if response_raw else {}
    except json.JSONDecodeError as exc:
        raise RuntimeError("AIOS /skills/execute returned invalid JSON") from exc

    if not response_payload.get("accepted"):
        raise RuntimeError(
            f"AIOS /skills/execute rejected request: {response_payload.get('reason', 'unknown')}"
        )

    execution = response_payload.get("execution")
    if not isinstance(execution, dict):
        raise RuntimeError("AIOS /skills/execute response missing execution payload")

    return execution


def main() -> int:
    ctx = load_context()
    status = os.getenv("AIOS_STATUS", "active")
    if status not in ALLOWED_STATUSES:
        raise ValueError("Invalid AIOS_STATUS")

    execution = execute_managed_skill(ctx)

    print(
        json.dumps(
            {
                "ok": True,
                "dpr_id": ctx.dpr_id,
                "tenant_id": ctx.tenant_id,
                "run_id": ctx.run_id,
                "task_id": ctx.task_id,
                "mission_id": ctx.mission_id,
                "status": status,
                "skill_target": ctx.capability_id,
                "linkskills_execution": execution,
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
