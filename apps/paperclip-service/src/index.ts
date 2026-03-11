import "dotenv/config";
import express from "express";
import {
  MissionPayloadSchema,
  SecurityExceptionSchema,
  type MissionPayload,
  type SecurityException
} from "@linktrend/interfaces";
import {
  assertTenantMatch,
  parseIdentityTenant,
  requireTenantContext
} from "@linktrend/shared-logic";
import { loadEnv } from "./env.js";
import { embedText } from "./ollama.js";
import { StudioBrainClient } from "./studio-brain.js";

const env = loadEnv(process.env);
const studioBrain = new StudioBrainClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "paperclip-service" });
});

app.post("/missions/start", async (req, res) => {
  const parsed = MissionPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const payload = parsed.data;

  try {
    validateMissionSecurity(payload);
    const embedding = await embedText(
      env.OLLAMA_EMBEDDING_URL,
      env.OLLAMA_EMBEDDING_MODEL,
      payload.goal
    );
    await studioBrain.upsertMission({
      tenantId: payload.tenantId,
      missionKey: payload.missionId,
      goal: payload.goal,
      status: payload.status,
      runId: payload.runId,
      taskId: payload.taskId,
      agentId: payload.agentId,
      embedding
    });
    await studioBrain.logAuditRun({
      tenantId: payload.tenantId,
      runId: payload.runId,
      taskId: payload.taskId,
      agentId: payload.agentId,
      status: "active",
      details: { source: "paperclip-service", action: "mission_start_accepted" }
    });
    return res.status(202).json({
      accepted: true,
      missionId: payload.missionId,
      runId: payload.runId,
      nextAction: "dispatch_to_management_queue"
    });
  } catch (error) {
    const securityException: SecurityException = {
      runId: payload.runId,
      taskId: payload.taskId,
      agentId: payload.agentId,
      tenantId: payload.tenantId,
      reason: error instanceof Error ? error.message : "Unknown security validation failure",
      severity: "critical"
    };

    SecurityExceptionSchema.parse(securityException);
    await studioBrain
      .logAuditRun({
        tenantId: payload.tenantId,
        runId: payload.runId,
        taskId: payload.taskId,
        agentId: payload.agentId,
        status: "security_exception",
        details: securityException
      })
      .catch(() => null);

    return res.status(409).json({
      accepted: false,
      securityException,
      action: "halt_agent_and_raise_alert"
    });
  }
});

app.post("/events/urgent", (req, res) => {
  const payload = req.body as {
    source?: "slack" | "webhook" | "email";
    tenantId?: string;
    summary?: string;
  };

  try {
    requireTenantContext(payload.tenantId);
    return res.status(202).json({
      accepted: true,
      source: payload.source ?? "webhook",
      forwardedTo: env.N8N_WEBHOOK_URL
    });
  } catch (error) {
    return res.status(400).json({
      accepted: false,
      reason: error instanceof Error ? error.message : "Invalid event payload"
    });
  }
});

app.listen(env.PORT, () => {
  console.log(`paperclip-service listening on :${env.PORT}`);
});

function validateMissionSecurity(payload: MissionPayload): void {
  const tenantId = requireTenantContext(payload.tenantId);
  const identityTenant = parseIdentityTenant(payload.identityPath);
  assertTenantMatch(tenantId, identityTenant);
}
