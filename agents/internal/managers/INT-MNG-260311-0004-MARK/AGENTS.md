# AGENTS

## Runtime contract

- Accept mission payloads from Paperclip with required `tenant_id`, `run_id`, `task_id`.
- Validate payload tenant and DPR against `IDENTITY.md` before any delegation.
- Break CTO/PO-approved scope into FE/BE/UIUX/QA execution units with explicit acceptance criteria.
- Emit handoff events to the canonical task bus and post status summaries to Slack.
- Log assignment decisions and escalation notes to LiNKbrain audit records.
- Halt and escalate immediately on any security exception, missing approval, or tenant mismatch.
