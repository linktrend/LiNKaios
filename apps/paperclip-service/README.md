# Paperclip Service Adapter

Thin orchestration adapter that enforces mission payload contracts and tenant guardrails before handing work to manager/worker queues.

## Endpoints

- `GET /health`
- `POST /missions/start`
- `POST /events/urgent`

## Security behavior

- Rejects payloads missing tenant context.
- Reads local agent `IDENTITY.md` and halts when tenant does not match mission payload.
- Emits security exception response payload for audit logging workflows.
