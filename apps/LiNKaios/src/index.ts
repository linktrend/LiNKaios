import "dotenv/config";
import { randomUUID } from "node:crypto";
import express from "express";
import { z } from "zod";
import {
  ApprovalDecisionSchema,
  LiNKskillsManagedRunRequestSchema,
  MissionPayloadSchema,
  MissionStatusSchema,
  SecurityExceptionSchema,
  type AiosEventEnvelope,
  type ApprovalState,
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
import { LiNKbrainClient, type AuditRunRecord } from "./linkbrain.js";
import {
  discoverInternalAgents,
  evaluateAgencyReadiness,
  evaluateOperationalCertification,
  resolveIdentityPath
} from "./agents.js";
import { requestCouncilSynthesis } from "./linkboard.js";
import { createLiNKskillsBridge } from "./linkskills.js";
import { createAiosEventBus } from "./nats.js";
import { postSlackStatus, toSlackCard } from "./slack.js";
import { registerPersonaControlRoutes } from "./persona-control.js";
import { renderLiNKaiosHomePage } from "./home-page.js";

const MissionEventRequestSchema = z.object({
  tenantId: z.string().uuid(),
  missionId: z.string().uuid(),
  runId: z.string().min(8),
  taskId: z.string().min(3),
  fromDprId: z.string().min(3),
  toDprId: z.string().min(3).nullable().default(null),
  summary: z.string().min(3),
  detail: z.string().optional(),
  status: MissionStatusSchema.default("active")
});

const TaskLifecycleRequestSchema = z.object({
  tenantId: z.string().uuid(),
  missionId: z.string().uuid(),
  runId: z.string().min(8),
  taskId: z.string().min(3),
  fromDprId: z.string().min(3),
  toDprId: z.string().min(3).nullable().default(null),
  summary: z.string().min(3).optional(),
  detail: z.string().optional(),
  status: MissionStatusSchema.default("active"),
  tokenUsage: z.number().int().nonnegative().optional(),
  commandLog: z.array(z.unknown()).default([]),
  metadata: z.record(z.unknown()).default({})
});

const ApprovalRequestSchema = z.object({
  approvalId: z.string().uuid().optional(),
  tenantId: z.string().uuid(),
  missionId: z.string().uuid(),
  runId: z.string().min(8),
  taskId: z.string().min(3),
  requestedByDprId: z.string().min(3),
  requestedByRole: z.enum(["ceo", "cto"]),
  kind: z.enum(["lesson_promotion", "archive_restore"]),
  reason: z.string().min(3),
  summary: z.string().min(3),
  metadata: z.record(z.unknown()).default({})
});

const ApprovalDecisionRequestSchema = ApprovalDecisionSchema.extend({
  decisionByRole: z.enum(["ceo", "cto", "chairman"])
});

const SkillExecutionRequestSchema = LiNKskillsManagedRunRequestSchema;

const BriefingQuerySchema = z.object({
  tenantId: z.string().uuid(),
  runId: z.string().optional(),
  degraded: z.enum(["0", "1"]).optional()
});

const EvidenceQuerySchema = z.object({
  tenantId: z.string().uuid(),
  runId: z.string().optional()
});

const APPROVAL_EVENT_TYPES = new Set<AiosEventEnvelope["eventType"]>([
  "aios.approval.requested",
  "aios.approval.decided"
]);

const TERMINAL_STATUSES = new Set([
  "completed",
  "failed",
  "security_exception",
  "approval_approved",
  "approval_rejected",
  "archived"
]);

const EVENT_TRACE_MAX_PER_RUN = 500;
const eventTraceStore = new Map<string, AiosEventEnvelope[]>();

const env = await loadEnv(process.env);
const studioBrain = new LiNKbrainClient(env.SUPABASE_URL, env.LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE);
const eventBus = await createAiosEventBus(env.NATS_URL);
const linkskillsBridge = createLiNKskillsBridge({
  apiUrl: env.LINKSKILLS_API_URL,
  apiToken: env.LINKSKILLS_API_TOKEN,
  principalId: env.LINKSKILLS_PRINCIPAL_ID,
  billingTrack: env.LINKSKILLS_BILLING_TRACK,
  ventureId: env.LINKSKILLS_VENTURE_ID,
  clientId: env.LINKSKILLS_CLIENT_ID
});
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

app.get("/health", async (_req, res) => {
  const roster = discoverInternalAgents();
  const agencyReadiness = evaluateAgencyReadiness();
  const operationalCertification = evaluateOperationalCertification();
  const busHealth = eventBus.health();
  const personaCentralization = await buildPersonaCentralizationSummary(
    "00000000-0000-0000-0000-000000000001",
    roster
  );

  res.json({
    status: "ok",
    service: "LiNKaios",
    managerCount: roster.managers.length,
    workerCount: roster.workers.length,
    agencyReadiness: agencyReadiness.summary,
    operationalCertification: operationalCertification.summary,
    eventBus: busHealth,
    personaCentralization,
    linkskills: linkskillsBridge.enabled ? "configured" : "disabled",
    chairmanApprovalWindow: {
      time: env.CHAIRMAN_APPROVAL_TIME,
      timezone: env.CHAIRMAN_APPROVAL_TIMEZONE
    },
    ritualWindows: {
      strategic: env.CHAIRMAN_APPROVAL_TIME,
      operational: env.OPERATIONAL_PULSE_TIME,
      quality: env.QUALITY_GATE_TIME,
      timezone: env.CHAIRMAN_APPROVAL_TIMEZONE
    }
  });
});

app.get("/:companyPrefix/home", (req, res) => {
  const companyPrefix = (req.params.companyPrefix ?? "").trim();
  if (!companyPrefix) {
    return res.status(400).type("text/plain").send("Missing company prefix");
  }
  const html = renderLiNKaiosHomePage({
    companyPrefix
  });
  return res.status(200).type("html").send(html);
});

app.get("/agents/discovery", async (_req, res) => {
  const roster = discoverInternalAgents();
  const agencyReadiness = evaluateAgencyReadiness();
  const operationalCertification = evaluateOperationalCertification();
  const personaCentralization = await buildPersonaCentralizationSummary(
    "00000000-0000-0000-0000-000000000001",
    roster
  );
  res.json({
    managers: roster.managers,
    workers: roster.workers,
    agencyReadiness: agencyReadiness.summary,
    agencyAgents: agencyReadiness.agents,
    operationalCertification: operationalCertification.summary,
    certifiedAgents: operationalCertification.agents,
    personaCentralization
  });
});

registerPersonaControlRoutes({
  app,
  studioBrain,
  defaultTenantId: "00000000-0000-0000-0000-000000000001",
  createEvent: buildEvent,
  emitEvent
});

app.get("/briefings/chairman/daily", async (req, res) => {
  return respondBriefing(req, res, "strategic");
});

app.get("/briefings/chairman/operational-pulse", async (req, res) => {
  return respondBriefing(req, res, "operational");
});

app.get("/briefings/chairman/quality-gate", async (req, res) => {
  return respondBriefing(req, res, "quality");
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
    let embedding: number[] | null = null;
    try {
      embedding = await embedText(
        env.OLLAMA_EMBEDDING_URL,
        env.OLLAMA_EMBEDDING_MODEL,
        payload.goal
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown";
      console.warn(`embedding_unavailable mission_id=${payload.missionId} reason=${reason}`);
    }

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

    await logAuditCritical({
      tenantId: payload.tenantId,
      runId: payload.runId,
      taskId: payload.taskId,
      dprId: payload.dprId,
      status: "active",
      details: {
        source: "LiNKaios",
        action: "mission_start_accepted",
        trigger_source: "missions/start",
        linkboard: linkboardSynthesis
      }
    });

    const createdEvent = buildEvent({
      eventType: "aios.task.created",
      tenantId: payload.tenantId,
      missionId: payload.missionId,
      runId: payload.runId,
      taskId: payload.taskId,
      fromDprId: payload.dprId,
      toDprId: payload.dprId,
      payload: {
        summary: "Mission accepted and created",
        detail: payload.goal,
        status: payload.status
      }
    });

    const assignedEvent = buildEvent({
      eventType: "aios.task.assigned",
      tenantId: payload.tenantId,
      missionId: payload.missionId,
      runId: payload.runId,
      taskId: payload.taskId,
      fromDprId: payload.dprId,
      toDprId: payload.dprId,
      payload: {
        summary: "Mission assigned to management queue",
        detail: "dispatch_to_management_queue",
        status: payload.status
      }
    });

    await emitEvent(createdEvent);
    await emitEvent(assignedEvent);

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

    await logAuditCritical({
      tenantId: payload.tenantId,
      runId: payload.runId,
      taskId: payload.taskId,
      dprId: payload.dprId,
      status: "security_exception",
      details: securityException
    });

    const exceptionEvent = buildEvent({
      eventType: "aios.security.exception",
      tenantId: payload.tenantId,
      missionId: payload.missionId,
      runId: payload.runId,
      taskId: payload.taskId,
      fromDprId: payload.dprId,
      toDprId: null,
      payload: {
        summary: "Mission halted due to security exception",
        detail: securityException.reason,
        severity: securityException.severity
      }
    });

    await emitEvent(exceptionEvent).catch(() => null);

    return res.status(409).json({
      accepted: false,
      securityException,
      action: "halt_agent_and_raise_alert"
    });
  }
});

app.post("/tasks/handoff", async (req, res) => {
  const parsed = MissionEventRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const payload = parsed.data;
  try {
    const event = buildEvent({
      eventType: "aios.task.handoff",
      tenantId: payload.tenantId,
      missionId: payload.missionId,
      runId: payload.runId,
      taskId: payload.taskId,
      fromDprId: payload.fromDprId,
      toDprId: payload.toDprId,
      payload: {
        summary: payload.summary,
        detail: payload.detail,
        status: payload.status
      }
    });

    logAuditNonCritical({
      tenantId: payload.tenantId,
      runId: payload.runId,
      taskId: payload.taskId,
      dprId: payload.fromDprId,
      status: "handoff",
      details: {
        ...event,
        trigger_source: "tasks/handoff"
      }
    });

    await emitEvent(event);

    return res.status(202).json({ accepted: true, eventType: event.eventType, eventId: event.eventId });
  } catch (error) {
    return res.status(500).json({
      accepted: false,
      reason: error instanceof Error ? error.message : "Unable to process task handoff"
    });
  }
});

app.post("/tasks/accept", async (req, res) => {
  return handleTaskLifecycle(req.body, res, {
    eventType: "aios.task.accepted",
    defaultSummary: "Task accepted for execution",
    auditStatus: "accepted"
  });
});

app.post("/tasks/complete", async (req, res) => {
  return handleTaskLifecycle(req.body, res, {
    eventType: "aios.task.completed",
    defaultSummary: "Task execution completed",
    auditStatus: "completed"
  });
});

app.post("/skills/execute", async (req, res) => {
  const parsed = SkillExecutionRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const payload = parsed.data;
  const target = payload.capabilityId ?? payload.packageId;
  const stepScope = payload.stepScope ?? env.LINKSKILLS_DEFAULT_STEP_SCOPE;
  const startTime = Date.now();

  try {
    validateAgentSecurity(payload.tenantId, payload.dprId);
    if (!linkskillsBridge.enabled) {
      return res.status(503).json({ accepted: false, reason: "LiNKskills API is not configured" });
    }

    const execution = await linkskillsBridge.executeManagedRun({
      ...payload,
      stepScope
    });

    const latencyMs = Date.now() - startTime;

    await logAuditCritical({
      tenantId: payload.tenantId,
      runId: payload.runId,
      taskId: payload.taskId,
      dprId: payload.dprId,
      status: `linkskills_${execution.runStatus}`,
      details: {
        source: "LiNKskills",
        trigger_source: "skills/execute",
        mission_id: payload.missionId,
        target,
        step_scope: stepScope,
        linkskills_run_id: execution.linkskillsRunId,
        receipt_id: execution.receiptId,
        manifest_ref: execution.manifestRef,
        latency_ms: latencyMs,
        retry_count: 0,
        attempt_count: 1
      }
    });

    await emitEvent(
      buildEvent({
        eventType: "aios.task.progress",
        tenantId: payload.tenantId,
        missionId: payload.missionId,
        runId: payload.runId,
        taskId: payload.taskId,
        fromDprId: payload.dprId,
        toDprId: null,
        payload: {
          summary: `LiNKskills managed execution completed (${execution.runStatus})`,
          detail: `target=${target} run=${execution.linkskillsRunId} receipt=${execution.receiptId}`,
          latency_ms: latencyMs
        }
      })
    );

    return res.status(202).json({
      accepted: true,
      missionId: payload.missionId,
      runId: payload.runId,
      taskId: payload.taskId,
      target,
      execution
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    await logAuditCritical({
      tenantId: payload.tenantId,
      runId: payload.runId,
      taskId: payload.taskId,
      dprId: payload.dprId,
      status: "linkskills_failed",
      details: {
        source: "LiNKskills",
        trigger_source: "skills/execute",
        mission_id: payload.missionId,
        target,
        step_scope: stepScope,
        reason: error instanceof Error ? error.message : "LiNKskills call failed",
        latency_ms: latencyMs,
        retry_count: 0,
        attempt_count: 1
      }
    });

    await emitEvent(
      buildEvent({
        eventType: "aios.task.failed",
        tenantId: payload.tenantId,
        missionId: payload.missionId,
        runId: payload.runId,
        taskId: payload.taskId,
        fromDprId: payload.dprId,
        toDprId: null,
        payload: {
          summary: "LiNKskills managed execution failed",
          detail: error instanceof Error ? error.message : "LiNKskills call failed",
          latency_ms: latencyMs
        }
      })
    ).catch(() => null);

    return res.status(502).json({
      accepted: false,
      reason: error instanceof Error ? error.message : "Unable to execute LiNKskills managed run"
    });
  }
});

app.post("/approvals/request", async (req, res) => {
  const parsed = ApprovalRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const payload = parsed.data;
  const approvalId = payload.approvalId ?? randomUUID();

  try {
    const event = buildEvent({
      eventType: "aios.approval.requested",
      tenantId: payload.tenantId,
      missionId: payload.missionId,
      runId: payload.runId,
      taskId: payload.taskId,
      fromDprId: payload.requestedByDprId,
      toDprId: null,
      payload: {
        approvalId,
        state: "requested",
        kind: payload.kind,
        requestedByRole: payload.requestedByRole,
        reason: payload.reason,
        summary: payload.summary,
        metadata: payload.metadata
      }
    });

    await logAuditCritical({
      tenantId: payload.tenantId,
      runId: payload.runId,
      taskId: payload.taskId,
      dprId: payload.requestedByDprId,
      status: "approval_requested",
      details: {
        ...event,
        trigger_source: "approvals/request"
      }
    });

    await emitEvent(event);

    return res.status(202).json({ accepted: true, approvalId, state: "requested" });
  } catch (error) {
    return res.status(500).json({
      accepted: false,
      reason: error instanceof Error ? error.message : "Unable to create approval request"
    });
  }
});

app.post("/approvals/decide", async (req, res) => {
  const parsed = ApprovalDecisionRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const payload = parsed.data;

  try {
    validateApprovalTransition(payload.state, payload.decisionByRole);

    const event = buildEvent({
      eventType: "aios.approval.decided",
      tenantId: payload.tenantId,
      missionId: payload.missionId,
      runId: payload.runId,
      taskId: payload.taskId,
      fromDprId: payload.decisionByDprId,
      toDprId: payload.requestedByDprId,
      payload: {
        approvalId: payload.approvalId,
        state: payload.state,
        decidedAt: payload.decidedAt,
        reason: payload.reason,
        decisionByRole: payload.decisionByRole,
        metadata: payload.metadata
      }
    });

    await logAuditCritical({
      tenantId: payload.tenantId,
      runId: payload.runId,
      taskId: payload.taskId,
      dprId: payload.decisionByDprId,
      status: `approval_${payload.state}`,
      details: {
        ...event,
        trigger_source: "approvals/decide"
      }
    });

    await emitEvent(event);

    return res.status(202).json({ accepted: true, approvalId: payload.approvalId, state: payload.state });
  } catch (error) {
    return res.status(409).json({
      accepted: false,
      reason: error instanceof Error ? error.message : "Unable to apply approval decision"
    });
  }
});

app.post("/events/urgent", async (req, res) => {
  const payload = req.body as {
    source?: "slack" | "webhook" | "email";
    tenantId?: string;
    summary?: string;
    missionId?: string;
    runId?: string;
    taskId?: string;
    dprId?: string;
  };

  try {
    const tenantId = requireTenantContext(payload.tenantId);
    const missionId = payload.missionId ?? randomUUID();
    const runId = payload.runId ?? `urgent-${Date.now()}`;
    const taskId = payload.taskId ?? `urgent-${Date.now()}`;
    const dprId = payload.dprId ?? "INT-MNG-260311-0001-LISA";

    const event = buildEvent({
      eventType: "aios.task.created",
      tenantId,
      missionId,
      runId,
      taskId,
      fromDprId: dprId,
      toDprId: dprId,
      payload: {
        summary: payload.summary ?? "Urgent interrupt received",
        detail: payload.source ?? "webhook",
        source: payload.source ?? "webhook"
      }
    });

    logAuditNonCritical({
      tenantId,
      runId,
      taskId,
      dprId,
      status: "urgent_interrupt",
      details: {
        ...event,
        trigger_source: payload.source ?? "webhook"
      }
    });

    await emitEvent(event);

    return res.status(202).json({
      accepted: true,
      source: payload.source ?? "webhook",
      forwardedTo: env.N8N_WEBHOOK_URL ?? null
    });
  } catch (error) {
    return res.status(400).json({
      accepted: false,
      reason: error instanceof Error ? error.message : "Invalid event payload"
    });
  }
});

app.get("/evidence/mvo/predeploy", async (req, res) => {
  const parsed = EvidenceQuerySchema.safeParse({
    tenantId: req.query.tenantId,
    runId: req.query.runId
  });

  if (!parsed.success) {
    return res.status(400).json({ accepted: false, reason: parsed.error.flatten() });
  }

  const { tenantId, runId } = parsed.data;

  try {
    const normalizedTenant = requireTenantContext(tenantId);
    const audits = await studioBrain.listAuditRuns({ tenantId: normalizedTenant, runId });
    const events = getRecordedEvents(normalizedTenant, runId);

    const taskIds = Array.from(new Set([...audits.map((entry) => entry.task_id), ...events.map((entry) => entry.taskId)]));
    const dprIds = Array.from(new Set([...audits.map((entry) => entry.dpr_id), ...events.map((entry) => entry.fromDprId)]));
    const statusCounts = countStatuses(audits);

    const evidence = {
      accepted: true,
      generatedAt: new Date().toISOString(),
      tenantId: normalizedTenant,
      runId: runId ?? null,
      lineage: {
        tenant_id: normalizedTenant,
        run_id: runId ?? null,
        task_id: taskIds,
        dpr_id: dprIds
      },
      summary: {
        auditEntries: audits.length,
        eventEntries: events.length,
        uniqueTaskCount: taskIds.length,
        uniqueDprCount: dprIds.length,
        statusCounts,
        successPathObserved: audits.some((entry) => TERMINAL_STATUSES.has(entry.status)),
        securityExceptionObserved: audits.some((entry) => entry.status === "security_exception"),
        approvalsObserved: audits.some((entry) => entry.status.startsWith("approval_"))
      },
      audits,
      events
    };

    return res.json(evidence);
  } catch (error) {
    return res.status(500).json({
      accepted: false,
      reason: error instanceof Error ? error.message : "Unable to build MVO evidence package"
    });
  }
});

app.listen(env.PORT, () => {
  console.log(`LiNKaios listening on :${env.PORT}`);
  console.log(`Event bus: ${eventBus.health().mode}`);
});

process.on("SIGINT", async () => {
  await eventBus.close().catch(() => null);
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await eventBus.close().catch(() => null);
  process.exit(0);
});

async function respondBriefing(
  req: express.Request,
  res: express.Response,
  mode: "strategic" | "operational" | "quality"
): Promise<express.Response> {
  const parsed = BriefingQuerySchema.safeParse({
    tenantId: req.query.tenantId,
    runId: req.query.runId,
    degraded: req.query.degraded
  });

  if (!parsed.success) {
    return res.status(400).json({ accepted: false, reason: parsed.error.flatten() });
  }

  const { tenantId, runId, degraded } = parsed.data;

  try {
    const briefing = await buildChairmanBriefingPayload({
      tenantId: requireTenantContext(tenantId),
      runId,
      mode,
      degradeSource: degraded === "1"
    });

    return res.json(briefing);
  } catch (error) {
    return res.status(500).json({
      accepted: false,
      reason: error instanceof Error ? error.message : "Unable to build chairman briefing"
    });
  }
}

async function buildChairmanBriefingPayload(args: {
  tenantId: string;
  runId?: string;
  mode: "strategic" | "operational" | "quality";
  degradeSource: boolean;
}): Promise<Record<string, unknown>> {
  let audits: AuditRunRecord[] = [];
  const sourceErrors: string[] = [];

  if (args.degradeSource) {
    sourceErrors.push("degraded source simulation requested");
  } else {
    try {
      audits = await studioBrain.listAuditRuns({ tenantId: args.tenantId, runId: args.runId });
    } catch (error) {
      sourceErrors.push(error instanceof Error ? error.message : "Unknown audit source error");
    }
  }

  const summary = summarizeAudits(audits);
  const confidenceScore = summary.totalEntries === 0
    ? 0.5
    : Math.max(0, Number((1 - summary.negativeSignals / summary.totalEntries).toFixed(3)));
  const confidenceFlag = confidenceScore < 0.8 || sourceErrors.length > 0;

  const strategicFeed = {
    pendingApprovals: summary.pendingApprovals,
    recommendedApprovals: summary.recommendedApprovals,
    securityExceptions: summary.securityExceptions,
    runCount: summary.runCount
  };

  const operationalFeed = {
    totalEntries: summary.totalEntries,
    tokenUsageTotal: summary.tokenUsageTotal,
    negativeSignals: summary.negativeSignals,
    handoffCount: summary.handoffCount,
    inProgressCount: summary.inProgressCount
  };

  const qualityFeed = {
    completedCount: summary.completedCount,
    failedCount: summary.failedCount,
    securityExceptions: summary.securityExceptions,
    approvalFinalizedCount: summary.approvalFinalizedCount,
    qualityGateReady: summary.failedCount === 0 && summary.securityExceptions === 0
  };

  return {
    accepted: true,
    mode: args.mode,
    generatedAt: new Date().toISOString(),
    tenantId: args.tenantId,
    runId: args.runId ?? null,
    approvalWindow: {
      time: env.CHAIRMAN_APPROVAL_TIME,
      timezone: env.CHAIRMAN_APPROVAL_TIMEZONE,
      channel: env.SLACK_CHANNEL_STRATEGIC
    },
    operationalWindow: {
      time: env.OPERATIONAL_PULSE_TIME,
      timezone: env.CHAIRMAN_APPROVAL_TIMEZONE,
      channel: env.SLACK_CHANNEL_OPERATIONAL
    },
    qualityWindow: {
      time: env.QUALITY_GATE_TIME,
      timezone: env.CHAIRMAN_APPROVAL_TIMEZONE,
      channel: env.SLACK_CHANNEL_QUALITY
    },
    confidence: {
      score: confidenceScore,
      flagged: confidenceFlag,
      threshold: 0.8,
      sourceErrors
    },
    feeds: {
      strategic: strategicFeed,
      operational: operationalFeed,
      quality: qualityFeed
    },
    selectedFeed:
      args.mode === "strategic"
        ? strategicFeed
        : args.mode === "operational"
          ? operationalFeed
          : qualityFeed
  };
}

function summarizeAudits(audits: AuditRunRecord[]): {
  totalEntries: number;
  runCount: number;
  pendingApprovals: number;
  recommendedApprovals: number;
  securityExceptions: number;
  tokenUsageTotal: number;
  negativeSignals: number;
  handoffCount: number;
  inProgressCount: number;
  completedCount: number;
  failedCount: number;
  approvalFinalizedCount: number;
} {
  const runCount = new Set(audits.map((entry) => entry.run_id)).size;
  let tokenUsageTotal = 0;

  for (const audit of audits) {
    tokenUsageTotal += audit.token_usage ?? 0;
  }

  const pendingApprovals = audits.filter((entry) => entry.status === "approval_requested").length;
  const recommendedApprovals = audits.filter((entry) => entry.status === "approval_recommended").length;
  const securityExceptions = audits.filter((entry) => entry.status === "security_exception").length;
  const failedCount = audits.filter(
    (entry) => entry.status.includes("failed") || entry.status === "security_exception"
  ).length;

  return {
    totalEntries: audits.length,
    runCount,
    pendingApprovals,
    recommendedApprovals,
    securityExceptions,
    tokenUsageTotal,
    negativeSignals: failedCount,
    handoffCount: audits.filter((entry) => entry.status === "handoff").length,
    inProgressCount: audits.filter((entry) => entry.status === "active").length,
    completedCount: audits.filter((entry) => entry.status === "completed").length,
    failedCount,
    approvalFinalizedCount: audits.filter(
      (entry) => entry.status === "approval_approved" || entry.status === "approval_rejected"
    ).length
  };
}

async function handleTaskLifecycle(
  requestBody: unknown,
  res: express.Response,
  config: {
    eventType: AiosEventEnvelope["eventType"];
    defaultSummary: string;
    auditStatus: string;
  }
): Promise<express.Response> {
  const parsed = TaskLifecycleRequestSchema.safeParse(requestBody);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const payload = parsed.data;
  try {
    const event = buildEvent({
      eventType: config.eventType,
      tenantId: payload.tenantId,
      missionId: payload.missionId,
      runId: payload.runId,
      taskId: payload.taskId,
      fromDprId: payload.fromDprId,
      toDprId: payload.toDprId,
      payload: {
        summary: payload.summary ?? config.defaultSummary,
        detail: payload.detail,
        status: payload.status,
        metadata: payload.metadata
      }
    });

    await logAuditCritical({
      tenantId: payload.tenantId,
      runId: payload.runId,
      taskId: payload.taskId,
      dprId: payload.fromDprId,
      status: config.auditStatus,
      tokenUsage: payload.tokenUsage,
      commandLog: payload.commandLog,
      details: {
        ...event,
        trigger_source: config.eventType,
        metadata: payload.metadata
      }
    });

    await emitEvent(event);

    return res.status(202).json({ accepted: true, eventType: event.eventType, eventId: event.eventId });
  } catch (error) {
    return res.status(500).json({
      accepted: false,
      reason: error instanceof Error ? error.message : "Unable to process task lifecycle"
    });
  }
}

function validateMissionSecurity(payload: MissionPayload): void {
  validateAgentSecurity(payload.tenantId, payload.dprId);
}

function validateAgentSecurity(tenantIdRaw: string, dprId: string): void {
  const tenantId = requireTenantContext(tenantIdRaw);
  const identityPath = resolveIdentityPath(dprId);
  const identity = parseIdentityMetadata(identityPath);
  assertTenantMatch(tenantId, identity.tenantId);
  assertDprMatch(dprId, identity.dprId);
}

function validateApprovalTransition(state: ApprovalState, decisionByRole: "ceo" | "cto" | "chairman"): void {
  if (state === "requested") {
    throw new Error("Use /approvals/request to create requests");
  }

  if (state === "recommended" && decisionByRole === "chairman") {
    throw new Error("Chairman cannot mark recommendation state");
  }

  if ((state === "approved" || state === "rejected") && decisionByRole !== "chairman") {
    throw new Error("Only Chairman can finalize approved/rejected decisions during MVO");
  }
}

function buildEvent(input: {
  eventType: AiosEventEnvelope["eventType"];
  tenantId: string;
  missionId: string;
  runId: string;
  taskId: string;
  fromDprId: string;
  toDprId: string | null;
  payload: Record<string, unknown>;
}): AiosEventEnvelope {
  return {
    eventId: randomUUID(),
    eventType: input.eventType,
    occurredAt: new Date().toISOString(),
    schemaVersion: "1.0",
    tenantId: input.tenantId,
    missionId: input.missionId,
    runId: input.runId,
    taskId: input.taskId,
    fromDprId: input.fromDprId,
    toDprId: input.toDprId,
    correlationId: `${input.runId}:${input.taskId}`,
    idempotencyKey: `${input.eventType}:${input.runId}:${input.taskId}:${input.fromDprId}:${input.toDprId ?? "none"}`,
    payload: input.payload
  };
}

async function emitEvent(event: AiosEventEnvelope): Promise<void> {
  await eventBus.publish(event);
  rememberEvent(event);
  await dispatchSlackCard(event);
}

async function dispatchSlackCard(event: AiosEventEnvelope): Promise<void> {
  const card = toSlackCard(event);
  const webhooks = new Set<string>();

  if (APPROVAL_EVENT_TYPES.has(event.eventType)) {
    if (env.SLACK_APPROVALS_WEBHOOK_URL) {
      webhooks.add(env.SLACK_APPROVALS_WEBHOOK_URL);
    } else if (env.SLACK_OPERATIONS_WEBHOOK_URL) {
      webhooks.add(env.SLACK_OPERATIONS_WEBHOOK_URL);
    }
  } else if (env.SLACK_OPERATIONS_WEBHOOK_URL) {
    webhooks.add(env.SLACK_OPERATIONS_WEBHOOK_URL);
  }

  for (const webhook of webhooks) {
    await postSlackStatus(webhook, card).catch((error) => {
      console.warn("slack_status_failed", error instanceof Error ? error.message : error);
    });
  }
}

function rememberEvent(event: AiosEventEnvelope): void {
  const key = `${event.tenantId}:${event.runId}`;
  const events = eventTraceStore.get(key) ?? [];
  events.push(event);

  if (events.length > EVENT_TRACE_MAX_PER_RUN) {
    events.splice(0, events.length - EVENT_TRACE_MAX_PER_RUN);
  }

  eventTraceStore.set(key, events);
}

function getRecordedEvents(tenantId: string, runId?: string): AiosEventEnvelope[] {
  if (runId) {
    return [...(eventTraceStore.get(`${tenantId}:${runId}`) ?? [])];
  }

  const entries: AiosEventEnvelope[] = [];
  for (const [key, events] of eventTraceStore.entries()) {
    if (key.startsWith(`${tenantId}:`)) {
      entries.push(...events);
    }
  }

  return entries.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

function countStatuses(audits: AuditRunRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const audit of audits) {
    counts[audit.status] = (counts[audit.status] ?? 0) + 1;
  }
  return counts;
}

async function buildPersonaCentralizationSummary(
  tenantId: string,
  roster: ReturnType<typeof discoverInternalAgents>
): Promise<{
  totalAgents: number;
  publishedBundles: number;
  acknowledgedBundles: number;
  policyAssignedAgents: number;
  readyAgents: number;
}> {
  const dprIds = [...roster.managers, ...roster.workers];
  const syncState = await studioBrain.listPersonaAgentSyncState({ tenantId }).catch(() => []);
  const syncByDpr = new Map(syncState.map((entry) => [entry.dpr_id, entry]));

  let publishedBundles = 0;
  let acknowledgedBundles = 0;
  let policyAssignedAgents = 0;
  let readyAgents = 0;

  for (const dprId of dprIds) {
    const bundle = await studioBrain.getLatestPersonaBundle({ tenantId, dprId }).catch(() => null);
    const sync = syncByDpr.get(dprId);

    const hasBundle = Boolean(bundle);
    const hasAck = Boolean(bundle && sync?.acknowledged_revision_hash === bundle.content_hash);
    const hasPolicyPackage = Boolean(sync?.policy_package);

    if (hasBundle) publishedBundles += 1;
    if (hasAck) acknowledgedBundles += 1;
    if (hasPolicyPackage) policyAssignedAgents += 1;
    if (hasBundle && hasAck && hasPolicyPackage) readyAgents += 1;
  }

  return {
    totalAgents: dprIds.length,
    publishedBundles,
    acknowledgedBundles,
    policyAssignedAgents,
    readyAgents
  };
}

async function logAuditCritical(args: {
  tenantId: string;
  runId: string;
  taskId: string;
  dprId: string;
  status: string;
  tokenUsage?: number;
  commandLog?: unknown[];
  details?: Record<string, unknown>;
}): Promise<void> {
  await studioBrain.logAuditRun(args);
}

function logAuditNonCritical(args: {
  tenantId: string;
  runId: string;
  taskId: string;
  dprId: string;
  status: string;
  tokenUsage?: number;
  commandLog?: unknown[];
  details?: Record<string, unknown>;
}): void {
  studioBrain.logAuditRunAsync(args);
}
