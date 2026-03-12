# LiNKaios Service Adapter

Thin orchestration adapter that enforces mission payload contracts and tenant guardrails before handing work to manager/worker queues.

## Endpoints

- `GET /health`
- `POST /missions/start`
- `POST /events/urgent`

## Security behavior

- Requires ingress authentication for all POST routes via `Authorization: Bearer <AIOS_INGRESS_TOKEN>` (or `x-aios-ingress-token`).
- Rejects payloads missing tenant context.
- Resolves agent identity files from an internal allowlist path based on mission `dprId`.
- Halts when identity tenant or DPR does not match mission payload values.
- Emits security exception response payload for audit logging workflows.

## Secret sourcing

- Uses `loadEnv` in `src/env.ts`.
- Resolution order for MVO: local `.env` value first, then Google Secret Manager.
- GSM reads require `GOOGLE_CLOUD_PROJECT` and `GOOGLE_APPLICATION_CREDENTIALS`.
