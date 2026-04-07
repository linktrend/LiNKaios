# LiNKdroplet-00 control plane — how it fits together

This document explains the **Docker stack** under `infra/droplet-admin/control-plane/` for operators taking over from earlier setup work. Canonical deploy rules remain in `.cursor/rules/15-release-deploy.mdc` and `docs/runbooks/CONTROL_PLANE_OPERATIONS.md`.

## What you open in the browser

Typical access is over **Tailscale**, for example:

`https://linkdroplet-00.<your-tailnet>.ts.net/`

That hostname must match:

- **`PUBLIC_HOSTNAME`** (Caddy site block — **no** `https://` prefix).
- **`PAPERCLIP_PUBLIC_URL`** and **`OAUTH2_PROXY_REDIRECT_URL`** (full URLs **with** `https://`).

## Request path (plain English)

1. **Caddy** (`reverse-proxy`) terminates TLS and receives HTTPS on ports 80/443.
2. For protected routes, Caddy calls **oauth2-proxy** (`forward_auth`). If the user has no valid session, they are sent to the IdP login (configured as **Supabase Auth OIDC**).
3. After auth, Caddy forwards to:
   - **Paperclip** (orchestration UI / API under paths like `/api`, `/agents`, …).
   - **LiNKaios** under `/aios/*` (and related routes in `Caddyfile`).

So: **one Supabase project** can back both **database/RPC** (LiNKaios `SUPABASE_URL` + service role via GSM) and **operator login** (OIDC issuer + OAuth client for oauth2-proxy).

## Environment files

| File | Role |
|------|------|
| **`.env.runtime`** | Lives **only on the droplet** next to `docker-compose.yml`. Holds Tailscale/Caddy hostname, oauth2-proxy secrets, Paperclip `BETTER_AUTH_SECRET`, LiNKaios **non-secret** config and **`*_SECRET_NAME`** pointers for GSM. |
| **`.env.runtime.example`** | Committed template; copy and edit. |

### TLS_EMAIL (what it is)

**`TLS_EMAIL`** is the address **Let’s Encrypt** associates with the certificate (expiry and account mail). It is **not** your Supabase login. Use any real mailbox you monitor (e.g. `sysadmin@…`).

### GCP service account file (`gcp-sa.json`)

**`GOOGLE_APPLICATION_CREDENTIALS`** inside the **linkaios** container points at a **JSON key** for a Google service account that can **read** Secret Manager.

On the droplet you store that file as:

`/opt/linktrend/secrets/gcp-sa.json`

Docker mounts it into the container (see `docker-compose.yml`). It is the **same idea** as `GOOGLE_APPLICATION_CREDENTIALS` on your Mac for `gcloud` — not a Supabase key.

LiNKaios then loads **API keys and tokens** using names like `LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE` from GSM (`apps/LiNKaios/src/env.ts`).

## LiNKaios and n8n

**n8n is optional today.** `N8N_WEBHOOK_URL` is no longer required in `env` schema; the urgent-events route returns `forwardedTo: null` when unset. When LiNKautowork is deployed, add `N8N_WEBHOOK_URL` to `.env.runtime`.

## Related paths in this repo

- Compose: `infra/droplet-admin/control-plane/docker-compose.yml`
- Caddy routing: `infra/droplet-admin/control-plane/Caddyfile`
- LiNKaios env resolution: `apps/LiNKaios/src/env.ts`
- Operator checklist: `infra/droplet-admin/control-plane/README.md`
