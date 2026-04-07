# Deploy from main (checklist + runbooks)

Run when `main` contains the release you intend to ship to **self-hosted** targets (VPS, droplet, Supabase, n8n, Mac Mini services).

## Rules

- Deploy **only** from `main` (or a tagged commit on `main`) per `.cursor/rules/15-release-deploy.mdc`.
- Do not print secrets. Use GSM + env render scripts for credentials.

## Steps

1. Confirm the correct commit on `main` (and tag if your process requires it).
2. Print the checklist:

   ```bash
   ./scripts/workflow/print-deploy-main-checklist.sh
   ```

3. Execute the **component-specific** steps from docs and infra (Docker Compose on Debian VPS, Caddy on droplet, Supabase migrations with backup, n8n workflow import, etc.). Use SSH/Tailscale only with operator-approved access.
4. After deploy: health checks, logs (short window), rollback path confirmed.

## If anything fails

Produce a **Briefing Pack** per `.cursor/rules/05-agent-behavior.mdc` (commands, logs, severity, rollback).
