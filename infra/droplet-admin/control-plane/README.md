# LiNKdroplet Admin Control Plane Bundle

This bundle runs Paperclip + LiNKaios behind a Supabase-authenticated gateway.

## Security contract

- HTTPS/TLS terminated at Caddy.
- Tailscale is the primary ingress path.
- Public ingress should be blocked at firewall except 80/443 from approved sources.
- IP allowlist is a secondary boundary, not the primary travel access control.
- OAuth2 Proxy enforces Supabase-backed OIDC login + MFA policy.

## Runtime env contract

- **`.env.runtime`** on the droplet holds operator-facing secrets (OAuth2 Proxy, Paperclip `BETTER_AUTH_SECRET`) and **non-secret** config plus **`*_SECRET_NAME`** pointers for LiNKaios GSM resolution.
- **Never commit** `.env.runtime`. Use **`.env.runtime.example`** as the template.
- LiNKaios loads credential **values** from Google Secret Manager using the service account mounted at `GOOGLE_APPLICATION_CREDENTIALS` (see compose + example).

## Bootstrap on LiNKdroplet-00 (first time)

1. **GCP service account key (read GSM)**  
   - Save the JSON as **`/opt/linktrend/secrets/gcp-sa.json`** on the droplet.  
   - `chmod 600` and owner readable by root (Docker mounts this path into `linkaios`).

2. **Environment file**  
   - From repo root or this directory:  
     `cp infra/droplet-admin/control-plane/.env.runtime.example infra/droplet-admin/control-plane/.env.runtime`  
   - Edit `.env.runtime`: replace every `REPLACE_*` and set real URLs (FQDN, Supabase ref, n8n URL, OIDC client, cookie secret, `BETTER_AUTH_SECRET`).

3. **Supabase OIDC for oauth2-proxy**  
   - Register an OIDC client in Supabase (or your IdP) compatible with oauth2-proxy.  
   - `OAUTH2_PROXY_OIDC_ISSUER_URL` is typically `https://<project-ref>.supabase.co/auth/v1`.  
   - `OAUTH2_PROXY_REDIRECT_URL` must be exactly `https://<your FQDN>/oauth2/callback`.

4. **Bring up**

```bash
cd /opt/linktrend/repo/linkaios
docker compose -f infra/droplet-admin/control-plane/docker-compose.yml up -d --build
```

## Required env keys (summary)

- **Caddy:** `PUBLIC_HOSTNAME`, `TLS_EMAIL`
- **oauth2-proxy:** `OAUTH2_PROXY_PROVIDER`, `OAUTH2_PROXY_OIDC_ISSUER_URL`, `OAUTH2_PROXY_CLIENT_ID`, `OAUTH2_PROXY_CLIENT_SECRET`, `OAUTH2_PROXY_COOKIE_SECRET`, `OAUTH2_PROXY_REDIRECT_URL`, plus defaults in `.env.runtime.example`
- **Paperclip:** `PAPERCLIP_PUBLIC_URL`, `BETTER_AUTH_SECRET`
- **LiNKaios:** `SUPABASE_URL`, `N8N_WEBHOOK_URL`, `OLLAMA_EMBEDDING_URL`, GSM project + key path, and `*_SECRET_NAME` entries as in the example

## Verify

- Gateway reachable over HTTPS.
- Unauthenticated access is redirected to login.
- Authenticated session can access Paperclip UI and `/aios/health`.
