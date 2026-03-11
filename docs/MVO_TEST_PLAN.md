# MVO Test Plan

## Contract Tests

1. Mission payload rejects missing `tenantId`, `runId`, `taskId`, `agentId`.
2. Mission status accepts only `active`, `paused`, `handover_pending`, `archived`.
3. LiNKskills contract rejects malformed execution fragments.

## Security Tests

1. Tenant mismatch between mission payload and `IDENTITY.md` halts mission.
2. Missing `app.current_tenant` causes RPC failure.
3. Cross-tenant reads/writes are denied by policy and RPC checks.

## Memory Tests

1. Ollama embedding returns 768-d vector (`nomic-embed-text`).
2. `scratch_memory.entries` to `shared_memory.lessons` promotion enforces threshold >= 0.85.
3. Promoted lessons are created with `requires_review = true`.

## Storage Lifecycle Tests

1. Inactivity trigger at 30 days identifies archive candidates.
2. Handover trigger archives assets regardless of inactivity timer.
3. Archive flow verifies checksum before hot object deletion.
4. Metadata pointer stores Drive file ID and checksum.
5. Restore requires CTO or CEO manual authorization.

## End-to-End Acceptance Scenario

1. Chairman creates mission.
2. CEO decomposes, CTO validates.
3. FE/BE worker agents execute.
4. QA validates and reports.
5. Chairman receives synthesis summary with token/cost and `run_id` audit lineage.
