# Cross-Repo MVO Deployment Readiness Matrix

Last updated: 2026-03-31

Legend: `Implemented` / `Verified` / `Pending external provisioning`

| Area | LiNKaios | LiNKpaperclip | LiNKskills | LiNKautowork | LiNKopenclaw | LiNKagentzero |
| --- | --- | --- | --- | --- | --- | --- |
| GSM-only env contract docs | Implemented | Implemented | Implemented | Implemented | Implemented | Implemented |
| Startup fail-fast on missing required secrets | Implemented | Implemented (deployment profile) | Implemented | Implemented | Implemented | Implemented |
| HTTPS/TLS + Tailscale + allowlist production profile | Implemented | Implemented | Implemented | Implemented | Implemented | Implemented |
| Operator auth posture (Supabase+MFA at gateway) | Implemented | Implemented | N/A | N/A | N/A | N/A |
| Audit logs + kill-switch runbook gates | Implemented | Implemented | Implemented | Implemented | Implemented | Implemented |
| Backup + restore gate/checklist | Implemented | Implemented | Implemented | Implemented | Implemented | Implemented |
| Security release gate workflow (tests/scans) | Implemented | Implemented | Implemented | Implemented | Implemented | Implemented |
| Source-of-truth release discipline docs | Implemented | Implemented | Implemented | Implemented | Implemented | Implemented |
| Production deploy bundle (compose + env contract) | Implemented | Implemented (via control-plane bundle) | Implemented | Implemented | Implemented | Implemented |

## Pending external provisioning only

1. Final GitHub sync/sign-off that main/master is deployment source of truth.
2. LiNKdroplet Admin provisioning and hardening:
   - Tailscale network policy
   - firewall/ip allowlist policy
   - TLS certificates and DNS
   - runtime host bootstrap
3. Separate macOS user provisioning for local Dev Squad runtime.
4. Environment-specific secret values in GSM and runtime rendering at deploy time.
5. Deployment execution to target environments and post-deploy acceptance run.

## Locked constraints

- Canonical transport remains `aios.*`.
- LiNKbrain remains on Supabase.
- LiNKdroplet Admin hosts isolated services for control-plane and management/runtime agents.
- Dev Squad remains local in separate macOS user.
