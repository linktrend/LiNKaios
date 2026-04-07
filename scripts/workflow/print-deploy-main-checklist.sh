#!/usr/bin/env bash
# Print pre-deploy reminders for main (self-hosted stack). Does not SSH or push — human/agent executes steps.
set -euo pipefail

cat <<'EOF'
LiNKaios / LiNKtrend — deploy from main (checklist)
==================================================

Git
---
- Changes merged: dev/* → staging → main (no direct pushes to staging/main).
- Tag release on main if your process requires it.

Quality gates (local or CI)
---------------------------
- pnpm typecheck
- pnpm test
- pnpm lint (or repo check script)
- pnpm build (when touching build surfaces)
- scripts/mvo-predeploy-acceptance.sh (if applicable)

Targets (see .cursor/rules/15-release-deploy.mdc)
-------------------------------------------------
- Control plane: Debian VPS — docker compose pull/build/up, health checks, logs.
- Reverse proxy: DO droplet / Caddy — config reload, TLS verify.
- Supabase: migrations, RLS, RPC smoke tests, backup/snapshot first.
- n8n (LiNKautowork): workflows + credentials, dry run before enabling triggers.
- Mac Mini execution node: services as documented.

Rollback
--------
- Compose: checkout previous tag/commit, redeploy.
- Supabase: migration rollback notes or restore snapshot.

EOF
