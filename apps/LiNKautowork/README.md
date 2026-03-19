# n8n Workflows

This app contains workflow JSON templates for the MVO automation plane.

## Workflows

- `urgent-event-ingestion.json`: Slack/webhook/email event intake routed to Paperclip wake-up endpoint.
- `hot-cold-migration.json`: Heartbeat-triggered archival workflow for Supabase hot storage to Google Drive.
- `heartbeat-triage.json`: Paperclip heartbeat-triggered triage packet generation and Slack delivery.
- `daily-chairman-briefing.json`: 08:00 Asia/Taipei daily briefing with pending approvals and risk summary.
- `security-exception-response.json`: Incident opening and leadership notification for security exceptions.
- `promotion-review-governance.json`: CEO/CTO recommendation gate and Chairman final approval prompt.
- `restore-authorization-governance.json`: CEO/CTO recommendation gate and Chairman final restore approval prompt.

## Runtime integrations

- Trigger source: Paperclip heartbeat + external event hooks
- Data source: Supabase metadata and storage APIs
- Archive sink: Google Drive service account
- Notification sink: Postmark SMTP
- Operations channel: Slack webhook delivery

## Secret sourcing

- Uses `loadLiNKautoworkEnv` in `src/env.ts`.
- Resolution order for MVO: local `.env` value first, then Google Secret Manager.
- GSM reads require `GOOGLE_CLOUD_PROJECT` and `GOOGLE_APPLICATION_CREDENTIALS`.

## MVO governance rules

- Telegram is disabled in MVO; Slack is the only communications channel.
- Promotion and restore actions require CEO/CTO recommendation before Chairman final decision in the daily 08:00 Asia/Taipei briefing.
