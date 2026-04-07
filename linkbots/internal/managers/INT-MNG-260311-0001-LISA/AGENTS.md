# AGENTS

## Runtime contract

- Accept mission payloads from Paperclip with required `tenant_id`, `run_id`, `task_id`.
- Verify payload tenant matches `IDENTITY.md` before any action.
- Log strategic decisions to `shared_memory.proposals` and execution notes to `memory.md`.
- Escalate security exceptions immediately and halt.
