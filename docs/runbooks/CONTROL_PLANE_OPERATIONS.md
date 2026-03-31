# LiNKaios/Paperclip Control Plane Operations (LiNKdroplet Admin)

## Bootstrap
1. Prepare `.env.runtime` with non-secret config and GSM-resolved secrets.
2. Ensure Tailscale is connected and firewall allows only intended ingress paths.
3. Start control plane stack:
   - `docker compose -f infra/droplet-admin/control-plane/docker-compose.yml up -d --build`

## Auth verification
- Unauthenticated request to control plane returns redirect/denied.
- Supabase-authenticated session can access Paperclip UI and LiNKaios API route `/aios/health`.
- MFA policy must be enforced in Supabase for operator users.

## TLS lifecycle
- Caddy handles TLS certificate retrieval and renewal.
- Validate cert status after each deploy and monthly thereafter.

## Rollback
- Roll back by previous immutable image tag/SHA.
- Restart with prior `.env.runtime` snapshot if config rollback is needed.
- Validate health endpoints and run one smoke mission before reopening operator access.

## Mandatory post-deploy checks
- `/health` (Paperclip) and `/aios/health` (LiNKaios) green.
- Audit write path to LiNKbrain/Supabase works.
- Kill switch endpoints reachable and policy-enforced.
