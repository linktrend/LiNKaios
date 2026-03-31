# Phase 1 Completion Checklist

## Infrastructure

- [ ] Debian 12 VPS provisioned and hardened
- [ ] Mac mini node provisioned with Ollama + uv
- [ ] Tailscale networking configured

## Core stack

- [ ] `scripts/bootstrap-upstreams.sh` completed
- [ ] `scripts/mvo-up-upstreams.sh` completed
- [ ] Paperclip adapter healthy (`/health`)
- [ ] NATS transport healthy (`nats://` connectivity, stream availability, publish ack mode)
- [ ] n8n workflows imported and enabled

## Data plane

- [ ] LiNKbrain migration applied
- [ ] `lb_core.tenants` seeded with AIOS internal tenant
- [ ] RLS active on shared/scratch tables
- [ ] RPC-only access pattern enforced

## Memory and promotion

- [ ] `nomic-embed-text` available from Mac mini Ollama
- [ ] Mission ingestion stores embeddings and audit runs
- [ ] Promotion threshold `>= 0.85` enforced
- [ ] `requires_review` queue visible for CEO/CTO recommendation
- [ ] Chairman final approval path active at 08:00 Asia/Taipei (Slack thread sign-off)

## Storage lifecycle

- [ ] 30-day inactivity trigger configured in n8n
- [ ] Handover trigger path configured
- [ ] Checksum verification and deletion flow validated
- [ ] Metadata pointer persistence validated

## Acceptance

- [ ] MVO roster includes Team Lead MARK and UI/UX ALEX
- [ ] Slack-only communication model active (Telegram disabled)
- [ ] Approval routing split active (`SLACK_APPROVALS_WEBHOOK_URL` and ops fallback)
- [ ] Full Chairman -> CEO/CTO -> Worker -> QA flow executed
- [ ] Synthesis report includes status and token/cost summary
- [ ] All audit logs traceable by `run_id` and `task_id`
- [ ] Pre-deployment harness passes (`./scripts/mvo-predeploy-acceptance.sh`)
- [ ] Evidence package exported in `artifacts/mvo-predeploy/` for Chairman sign-off
