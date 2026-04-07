# LiNKdroplet Admin Control Plane Bundle

Runs **Paperclip** + **LiNKaios** behind **Caddy** and **oauth2-proxy** (Supabase OIDC).

**Operator overview (Tailscale, TLS email, GSM key file):** [LiNKdroplet control plane](../../../docs/infra/LINKDROPLET_CONTROL_PLANE.md)

## Security contract

- HTTPS/TLS terminated at Caddy.
- Tailscale is the primary ingress path.
- Public ingress should be blocked at firewall except 80/443 from approved sources.
- IP allowlist is a secondary boundary, not the primary travel access control.
- OAuth2 Proxy enforces Supabase-backed OIDC login + MFA policy.

## Runtime env contract

- **`.env.runtime`** on the droplet holds Caddy/oauth2-proxy/Paperclip secrets and LiNKaios **non-secret** config plus **`*_SECRET_NAME`** for GSM-backed values.
- **Never commit** `.env.runtime`. Start from **`.env.runtime.example`**.

## Bootstrap on LiNKdroplet-00

1. **GSM reader key:** save JSON as **`/opt/linktrend/secrets/gcp-sa.json`**, `chmod 600` (mounted into the `linkaios` container; see [doc](../../../docs/infra/LINKDROPLET_CONTROL_PLANE.md)).
2. **Env file:** `cp .env.runtime.example .env.runtime` in this directory; set `TLS_EMAIL`, `REPLACE_PROJECT_REF`, OIDC client fields, random secrets, and `SUPABASE_URL` to match your single Supabase project.
3. **Bring up** (from repo root on the server):

```bash
cd /opt/linktrend/repo/linkaios
docker compose -f infra/droplet-admin/control-plane/docker-compose.yml up -d --build
```

## Verify

- Gateway over HTTPS (Tailscale hostname).
- Unauthenticated users redirected to login.
- After login: Paperclip UI and **`/aios/health`** (see `docs/runbooks/CONTROL_PLANE_OPERATIONS.md`).
