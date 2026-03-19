# Mission Contract Notes

Required payload fields:

- `tenantId`
- `dprId`
- `runId`
- `taskId`
- `missionId`
- `status`
- `fromDprId` / `toDprId` for cross-agent handoffs
- `capabilityId` or `packageId` for LiNKskills managed execution requests
- `idempotency_key` equivalent lineage data for LiNKskills managed run creation

Security gate:

1. Ensure `tenantId` is valid UUID.
2. Resolve `IDENTITY.md` from local allowlisted DPR directory.
3. Parse `TENANT_ID` from agent identity file.
4. Reject and emit security exception when IDs differ.

Event transport contract:

1. Emit canonical `aios.*` events to NATS for each mission lifecycle transition.
2. Required lifecycle coverage includes `aios.task.accepted` and `aios.task.completed`.
3. Include `tenant_id`, `run_id`, `task_id`, and `dpr_id` lineage on every event.
4. For `/skills/execute`, persist LiNKskills run and receipt IDs in LiNKbrain audit details.
5. Approval events (`aios.approval.requested`, `aios.approval.decided`) must be routed to approvals Slack channel/webhook with deterministic fallback to operations.
