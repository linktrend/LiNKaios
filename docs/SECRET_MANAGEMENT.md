# LiNKtrend Secret Management

## Purpose

LiNKtrend stores operational credentials in Google Secret Manager (GSM) so AIOS and LiNKbots can retrieve secrets at runtime without embedding credentials in source files.

## Source of Truth Policy

- Production: GSM is authoritative for all sensitive credentials.
- MVO transition mode: services attempt local `.env` fallback first, then retrieve from GSM.
- Local `.env` remains a bootstrap-only mechanism and must never be committed.

## Secret Naming Convention

All secrets follow:

`LINKTREND_[SERVICE]_[ENV]_[RESOURCE]_[IDENTIFIER]`

Examples:

- `LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE`
- `LINKTREND_AIOS_PROD_POSTMARK_SERVER_TOKEN`
- `LINKTREND_AIOS_PROD_OPENROUTER_API_KEY`
- `LINKTREND_AIOS_PROD_ANTHROPIC_API_KEY`

## Labeling Strategy

Every secret must include labels for filtering, ownership, and rotation workflows:

- `venture`: `linktrend`, `linkapps`, `linksites`, `linktrade`
- `provider`: `google`, `supabase`, `postmark`, `anthropic`, `openrouter`
- `owner`: `agent_ceo`, `agent_cto`, `linkbot_fe`, `linkbot_be`, `linkbot_qa`

## Access Control Model

- Use least-privilege service accounts.
- Grant each bot only the GSM secrets needed for its current venture scope.
- Separate role-bound service accounts for management agents and worker agents.

## Rotation Policy

- Rotate by publishing a new GSM secret version.
- Services read `versions/latest`, so no code redeploy is required for normal key rotations.
- Rotation events must be logged in AIOS operational audit records.

## Runtime Contract

Applications use the `GSMSecretProvider` from `packages/linklogic`:

1. Check local `.env` fallback variable first (MVO compatibility).
2. If missing, resolve from `projects/$GOOGLE_CLOUD_PROJECT/secrets/$SECRET_NAME/versions/latest`.
3. Fail fast if neither local fallback nor GSM value is available.

## Required Environment Variables

- `GOOGLE_CLOUD_PROJECT` (or `GCP_PROJECT`)
- `GOOGLE_APPLICATION_CREDENTIALS`

No Google project IDs are hard-coded in repository code.

## Initial MVO Secret Set

Create these secrets in GSM before production rollout:

- `LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE`
- `LINKTREND_AIOS_PROD_POSTMARK_SERVER_TOKEN`
- `LINKTREND_AIOS_PROD_OPENROUTER_API_KEY`
- `LINKTREND_AIOS_PROD_ANTHROPIC_API_KEY`
- `LINKTREND_AIOS_PROD_N8N_WEBHOOK_SIGNING_KEY`
- `LINKTREND_AIOS_PROD_GDRIVE_SERVICE_ACCOUNT_JSON`

## Operational Notes

- Keep service account key files outside git (`secrets/` path is local-only).
- Use labels to support future automated budget and secret lifecycle audits.
- During MVO, fallback env values are allowed only on trusted internal hosts.
