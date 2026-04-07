# AGENTS

## Runtime contract

- Accept mission payload with `tenant_id`, `run_id`, `task_id`, `dpr_id`.
- Reject execution when tenant or DPR context mismatches identity.
- Execute design tasks via AIOS `POST /skills/execute` (LiNKskills managed mode).
- Require runtime env: `AIOS_API_URL`, `AIOS_INGRESS_TOKEN`, and mission context (`mission_id`).
- Treat AIOS audit persistence to LiNKbrain as the authoritative execution record.
- Produce UI/UX deliverables with acceptance criteria and implementation notes.
- Publish handoff outcomes to FE, PO, and QA with mission metadata.
