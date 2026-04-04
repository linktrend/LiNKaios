# LiNKdroplet Admin Control Plane Bundle

This bundle runs Paperclip + LiNKaios behind a Supabase-authenticated gateway.

## Security contract
- HTTPS/TLS terminated at Caddy.
- Tailscale is the primary ingress path.
- Public ingress should be blocked at firewall except 80/443 from approved sources.
- IP allowlist is a secondary boundary, not the primary travel access control.
- OAuth2 Proxy enforces Supabase-backed OIDC login + MFA policy.

## Runtime env contract
- `.env.runtime` must contain only non-secret values and GSM secret identifiers (`*_SECRET_NAME`).
- Repo `.env` files must not include raw secrets.

## Required env keys
- `PUBLIC_HOSTNAME`
- `TLS_EMAIL`
- `OAUTH2_PROXY_PROVIDER=oidc`
- `OAUTH2_PROXY_OIDC_ISSUER_URL` (Supabase Auth issuer)
- `OAUTH2_PROXY_CLIENT_ID`
- `OAUTH2_PROXY_CLIENT_SECRET`
- `OAUTH2_PROXY_COOKIE_SECRET`
- LiNKaios and Paperclip runtime env values

## Bring up
```bash
docker compose -f infra/droplet-admin/control-plane/docker-compose.yml up -d --build
```

## Verify
- Gateway reachable over HTTPS.
- Unauthenticated access is redirected to login.
- Authenticated session can access Paperclip UI and `/aios/health`.
