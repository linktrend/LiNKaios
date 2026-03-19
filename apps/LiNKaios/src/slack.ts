import { SlackStatusCardSchema, type AiosEventEnvelope, type SlackStatusCard } from "@linktrend/linkskills";

export async function postSlackStatus(
  webhookUrl: string | undefined,
  card: SlackStatusCard
): Promise<void> {
  if (!webhookUrl) {
    return;
  }

  const parsed = SlackStatusCardSchema.parse(card);
  const source = parsed.fromDprId;
  const destination = parsed.toDprId ? ` -> ${parsed.toDprId}` : "";
  const message = `${source}${destination}: ${parsed.summary} (run ${parsed.runId}, task ${parsed.taskId})`;

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: message })
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed: ${response.status}`);
  }
}

export function toSlackCard(event: AiosEventEnvelope): SlackStatusCard {
  return {
    tenantId: event.tenantId,
    runId: event.runId,
    taskId: event.taskId,
    eventType: event.eventType,
    fromDprId: event.fromDprId,
    toDprId: event.toDprId,
    summary: event.payload.summary ? String(event.payload.summary) : event.eventType,
    detail: event.payload.detail ? String(event.payload.detail) : undefined
  };
}
