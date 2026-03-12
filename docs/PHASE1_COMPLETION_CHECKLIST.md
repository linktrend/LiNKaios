# Phase 1 Completion Checklist

## Infrastructure

- [ ] Debian 12 VPS provisioned and hardened
- [ ] Mac mini node provisioned with Ollama + uv
- [ ] Tailscale networking configured

## Core stack

- [ ] `scripts/bootstrap-upstreams.sh` completed
- [ ] `scripts/mvo-up-upstreams.sh` completed
- [ ] Paperclip adapter healthy (`/health`)
- [ ] n8n workflows imported and enabled

## Data plane

- [ ] LiNKbrain migration applied
- [ ] `core.tenants` seeded with AIOS internal tenant
- [ ] RLS active on shared/scratch tables
- [ ] RPC-only access pattern enforced

## Memory and promotion

- [ ] `nomic-embed-text` available from Mac mini Ollama
- [ ] Mission ingestion stores embeddings and audit runs
- [ ] Promotion threshold `>= 0.85` enforced
- [ ] `requires_review` queue visible for CEO/CTO

## Storage lifecycle

- [ ] 30-day inactivity trigger configured in n8n
- [ ] Handover trigger path configured
- [ ] Checksum verification and deletion flow validated
- [ ] Metadata pointer persistence validated

## Acceptance

- [ ] Full Chairman -> CEO/CTO -> Worker -> QA flow executed
- [ ] Synthesis report includes status and token/cost summary
- [ ] All audit logs traceable by `run_id` and `task_id`
