# n8n Workflows

This app contains workflow JSON templates for the MVO automation plane.

## Workflows

- `urgent-event-ingestion.json`: Slack/webhook/email event intake routed to Paperclip wake-up endpoint.
- `hot-cold-migration.json`: Heartbeat-triggered archival workflow for Supabase hot storage to Google Drive.

## Runtime integrations

- Trigger source: Paperclip heartbeat + external event hooks
- Data source: Supabase metadata and storage APIs
- Archive sink: Google Drive service account
- Notification sink: Postmark SMTP

## Secret sourcing

- Uses `loadLiNKautoworkEnv` in `src/env.ts`.
- Resolution order for MVO: local `.env` value first, then Google Secret Manager.
- GSM reads require `GOOGLE_CLOUD_PROJECT` and `GOOGLE_APPLICATION_CREDENTIALS`.
