import "dotenv/config";
import express from "express";
import {
  MissionPayloadSchema,
  SecurityExceptionSchema,
  type MissionPayload,
  type SecurityException
} from "@linktrend/linkskills";
import {
  assertDprMatch,
  assertTenantMatch,
  parseIdentityMetadata,
  requireTenantContext
} from "@linktrend/linklogic";
import { loadEnv } from "./env.js";
import { embedText } from "./ollama.js";
import { LiNKbrainClient } from "./linkbrain.js";
import { discoverInternalAgents, resolveIdentityPath } from "./agents.js";
import { requestCouncilSynthesis } from "./linkboard.js";

const env = await loadEnv(process.env);
const studioBrain = new LiNKbrainClient(env.SUPABASE_URL, env.LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE);
const app = express();
app.use(express.json());

app.use((req, res, next) => {
  if (req.method !== "POST") {
    return next();
  }

  const authHeader = req.header("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const requestToken = bearerToken ?? req.header("x-aios-ingress-token");
  if (!requestToken || requestToken !== env.AIOS_INGRESS_TOKEN) {
    return res.status(401).json({ accepted: false, reason: "Unauthorized ingress token" });
  }

  return next();
});

app.get("/health", (_req, res) => {
  const roster = discoverInternalAgents();
  res.json({
    status: "ok",
    service: "LiNKaios",
    managerCount: roster.managers.length,
    workerCount: roster.workers.length
  });
});

app.get("/agents/discovery", (_req, res) => {
  res.json(discoverInternalAgents());
});

app.post("/missions/start", async (req, res) => {
  const parsed = MissionPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const payload = parsed.data;

  try {
    validateMissionSecurity(payload);
    const linkboardSynthesis = await requestCouncilSynthesis(env.LINKBOARD_URL, {
      missionId: payload.missionId,
      tenantId: payload.tenantId,
      dprId: payload.dprId,
      goal: payload.goal
    });
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
      dprId: payload.dprId,
      embedding
    });
    await studioBrain.logAuditRun({
      tenantId: payload.tenantId,
      runId: payload.runId,
      taskId: payload.taskId,
      dprId: payload.dprId,
      status: "active",
      details: {
        source: "LiNKaios",
        action: "mission_start_accepted",
        linkboard: linkboardSynthesis
      }
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
      dprId: payload.dprId,
      tenantId: payload.tenantId,
      reason: error instanceof Error ? error.message : "Unknown security validation failure",
      severity: "critical"
    };

    SecurityExceptionSchema.parse(securityException);
    console.warn("security_exception", securityException);
    await studioBrain
      .logAuditRun({
        tenantId: payload.tenantId,
        runId: payload.runId,
        taskId: payload.taskId,
        dprId: payload.dprId,
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
  console.log(`LiNKaios listening on :${env.PORT}`);
});

function validateMissionSecurity(payload: MissionPayload): void {
  const tenantId = requireTenantContext(payload.tenantId);
  const identityPath = resolveIdentityPath(payload.dprId);
  const identity = parseIdentityMetadata(identityPath);
  assertTenantMatch(tenantId, identity.tenantId);
  assertDprMatch(payload.dprId, identity.dprId);
}
