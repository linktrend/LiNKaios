# LiNKlogic

Common utilities used across orchestration services and agents.

## Included utilities

- Tenant context validation and mismatch guardrails
- `run_id` generation helper
- SHA-256 checksum helper for archive verification
- Agent identity parser (`IDENTITY.md`) for `dpr_id` and `authorized_tenant_id`
- GSM secret provider with MVO env fallback (`GSMSecretProvider`, `getSecret`)
