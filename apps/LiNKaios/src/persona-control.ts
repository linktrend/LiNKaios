import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type express from "express";
import { z } from "zod";
import { parseIdentityMetadata, sha256Hex } from "@linktrend/linklogic";
import type { AiosEventEnvelope } from "@linktrend/linkskills";
import { buildPersonaV1Layers } from "./persona-v1.js";
import {
  INTERNAL_MANAGERS_DIR,
  INTERNAL_WORKERS_DIR,
  discoverInternalAgents,
  evaluateOperationalCertificationFromRoster,
  type AgentLane
} from "./agents.js";
import {
  type AgentModelProfileRecord,
  type KillSwitchStateRecord,
  type KnowledgeEntityRecord,
  type KnowledgeRevisionRecord,
  type LiNKbrainClient,
  type PersonaCompiledBundleRecord,
  type PolicyDecisionRecord
} from "./linkbrain.js";
import {
  AgentModelProfileSchema,
  TaskOrchestrationInputSchema,
  buildDynamicOrchestrationPlan
} from "./orchestration-policy.js";

type PersonaDeps = {
  app: express.Express;
  studioBrain: LiNKbrainClient;
  defaultTenantId: string;
  createEvent: (input: {
    eventType: AiosEventEnvelope["eventType"];
    tenantId: string;
    missionId: string;
    runId: string;
    taskId: string;
    fromDprId: string;
    toDprId: string | null;
    payload: Record<string, unknown>;
  }) => AiosEventEnvelope;
  emitEvent: (event: AiosEventEnvelope) => Promise<void>;
};

type AgentProfile = {
  dprId: string;
  lane: AgentLane;
  tenantId: string;
  currentRole: string | null;
  agentType: string | null;
  agentDir: string;
};

type PersonaReadinessAgent = {
  dprId: string;
  lane: AgentLane;
  baseOperationalReady: boolean;
  hasPublishedBundle: boolean;
  syncAcknowledged: boolean;
  hasPolicyPackage: boolean;
  expectedRevisionHash: string | null;
  acknowledgedRevisionHash: string | null;
  activeBundleHash: string | null;
  ready: boolean;
  gaps: string[];
};

const PERSONA_FILE_SPECS = [
  { contentKind: "user", outputFiles: ["USER.md"] },
  { contentKind: "identity", outputFiles: ["IDENTITY.md"] },
  { contentKind: "soul", outputFiles: ["soul.md"] },
  { contentKind: "agents", outputFiles: ["AGENTS.md"] },
  { contentKind: "memory", outputFiles: ["MEMORY.md", "memory.md"] }
] as const;

const PERSONA_ENTITY_SCHEMA = z.object({
  tenantId: z.string().uuid(),
  entityKind: z.enum(["persona", "policy", "guideline", "guardrail", "sop"]),
  contentKind: z.string().min(1),
  scopeKind: z.enum(["global", "type", "role", "agent_override", "memory_seed", "runtime_rules"]),
  scopeKey: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(["draft", "review", "approved", "published", "deprecated"]).default("draft"),
  createdByDprId: z.string().min(3),
  body: z.string().min(1),
  metadata: z.record(z.unknown()).default({}),
  publishImmediately: z.boolean().default(false)
});

const PERSONA_REVISION_SCHEMA = z.object({
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),
  status: z.enum(["draft", "review", "approved", "published", "deprecated"]).default("draft"),
  createdByDprId: z.string().min(3),
  body: z.string().min(1),
  metadata: z.record(z.unknown()).default({})
});

const PERSONA_PUBLISH_SCHEMA = z.object({
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),
  revisionId: z.string().uuid(),
  actorDprId: z.string().min(3),
  reason: z.string().min(1).optional(),
  compileTargets: z.array(z.string().min(3)).optional()
});

const PERSONA_ROLLBACK_SCHEMA = z.object({
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),
  targetRevisionId: z.string().uuid(),
  actorDprId: z.string().min(3),
  reason: z.string().min(3)
});

const PERSONA_ACK_SCHEMA = z.object({
  tenantId: z.string().uuid(),
  dprId: z.string().min(3),
  acknowledgedRevisionHash: z.string().min(16),
  policyPackage: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).default({})
});

const PERSONA_SYNC_QUERY_SCHEMA = z.object({
  tenantId: z.string().uuid(),
  dprId: z.string().min(3),
  expectedRevision: z.string().min(16).optional()
});

const PERSONA_PREVIEW_QUERY_SCHEMA = z.object({
  tenantId: z.string().uuid(),
  dprId: z.string().min(3)
});

const PERSONA_DIFF_QUERY_SCHEMA = z.object({
  tenantId: z.string().uuid(),
  dprId: z.string().min(3)
});

const PERSONA_APPROVAL_QUEUE_QUERY_SCHEMA = z.object({
  tenantId: z.string().uuid(),
  status: z.enum(["review", "approved"]).optional()
});

const PERSONA_IMPORT_SCHEMA = z.object({
  tenantId: z.string().uuid(),
  actorDprId: z.string().min(3),
  publishImported: z.boolean().default(false),
  policyPackage: z.string().min(1).optional()
});

const PERSONA_MIGRATION_EVIDENCE_QUERY_SCHEMA = z.object({
  tenantId: z.string().uuid()
});

const PERSONA_APPLY_V1_SCHEMA = z.object({
  tenantId: z.string().uuid(),
  actorDprId: z.string().min(3),
  includeBirthDateInUserFile: z.boolean().default(false),
  policyPackage: z.string().min(1).optional(),
  compileAfterPublish: z.boolean().default(true)
});

const POLICY_EVALUATION_SCHEMA = z.object({
  tenantId: z.string().uuid(),
  missionId: z.string().uuid().optional(),
  runId: z.string().min(3),
  taskId: z.string().min(3),
  dprId: z.string().min(3),
  policyPackage: z.string().min(1).optional(),
  toolName: z.string().min(1).optional(),
  destination: z.string().min(1),
  dataSensitivity: z.enum(["low", "medium", "high"]).default("low"),
  allowlist: z.array(z.string().min(1)).default([]),
  metadata: z.record(z.unknown()).default({})
});

const KILLSWITCH_SCHEMA = z.object({
  tenantId: z.string().uuid(),
  missionId: z.string().uuid().optional(),
  runId: z.string().min(3),
  taskId: z.string().min(3),
  actorDprId: z.string().min(3),
  scope: z.enum(["agent", "workflow", "tenant", "global"]),
  targetKey: z.string().min(1),
  state: z.enum(["active", "released"]),
  reason: z.string().min(3),
  metadata: z.record(z.unknown()).default({})
});

const MODEL_PROFILE_UPSERT_SCHEMA = AgentModelProfileSchema.extend({
  actorDprId: z.string().min(3)
});

const MODEL_PROFILE_QUERY_SCHEMA = z.object({
  tenantId: z.string().uuid(),
  dprId: z.string().min(3)
});

const ORCHESTRATION_PLAN_SCHEMA = z.object({
  tenantId: z.string().uuid(),
  dprId: z.string().min(3),
  runId: z.string().min(3),
  taskId: z.string().min(3),
  missionId: z.string().uuid().optional(),
  taskPrompt: z.string().min(1),
  contextRefs: z.array(z.string().min(1)).default([]),
  metadata: z.record(z.unknown()).default({})
});

const LISA_DPR_ID = "INT-MNG-260311-0001-LISA";

function normalizeRoleKey(role: string | null): string {
  return (role ?? "").trim().toLowerCase().replace(/\s+/g, "_");
}

function listAgentProfiles(): AgentProfile[] {
  const roster = discoverInternalAgents();
  const managers = roster.managers.map((dprId) => ({ dprId, lane: "manager" as const }));
  const workers = roster.workers.map((dprId) => ({ dprId, lane: "worker" as const }));

  return [...managers, ...workers].map(({ dprId, lane }) => {
    const identityPath = resolveIdentityPathByLane(lane, dprId);
    const identity = parseIdentityMetadata(identityPath);
    return {
      dprId,
      lane,
      tenantId: identity.tenantId,
      currentRole: identity.currentRole ?? null,
      agentType: identity.agentType ?? null,
      agentDir: dirname(identityPath)
    };
  });
}

function findProfileForTenant(args: { tenantId: string; dprId: string }): AgentProfile | null {
  const profiles = listAgentProfiles().filter((profile) => profile.tenantId === args.tenantId);
  return profiles.find((profile) => profile.dprId === args.dprId) ?? null;
}

function resolveIdentityPathByLane(lane: AgentLane, dprId: string): string {
  const roster = discoverInternalAgents();
  const source = lane === "manager" ? roster.managers : roster.workers;
  if (!source.includes(dprId)) {
    throw new Error(`Unknown agent for lane ${lane}: ${dprId}`);
  }

  const base =
    lane === "manager"
      ? join(INTERNAL_MANAGERS_DIR, dprId)
      : join(INTERNAL_WORKERS_DIR, dprId);

  return join(base, "IDENTITY.md");
}

function readExistingPersonaContent(
  profile: AgentProfile,
  kind: (typeof PERSONA_FILE_SPECS)[number]["contentKind"]
): string {
  const candidates: string[] = [
    ...(PERSONA_FILE_SPECS.find((spec) => spec.contentKind === kind)?.outputFiles ?? [])
  ];
  if (kind === "user" && !candidates.includes("user.md")) {
    candidates.push("user.md");
  }
  for (const candidate of candidates) {
    const path = join(profile.agentDir, candidate);
    try {
      const content = readFileSync(path, "utf8");
      if (content.trim().length > 0) {
        return content;
      }
    } catch {
      continue;
    }
  }
  return "";
}

function composePersonaBody(args: {
  profile: AgentProfile;
  kind: string;
  sections: Array<{ label: string; body: string }>;
  fallback: string;
}): string {
  if (args.sections.length === 0) {
    if (args.kind === "identity") {
      return renderIdentityContract(args.profile, args.fallback);
    }

    if (args.fallback.trim().length > 0) {
      return ensureTrailingNewline(args.fallback);
    }

    return ensureTrailingNewline(`# ${args.profile.dprId} ${args.kind}\n\nNo published persona layer yet.`);
  }

  const layeredBody = args.sections
    .map((section) => `## ${section.label}\n\n${section.body.trim()}`)
    .join("\n\n---\n\n");
  const mergedBody = mergeNonConflictingLines(layeredBody, args.fallback);

  if (args.kind === "identity") {
    return renderIdentityContract(args.profile, mergedBody);
  }

  return ensureTrailingNewline(mergedBody);
}

function renderIdentityContract(profile: AgentProfile, body: string): string {
  const role = profile.currentRole ?? "unknown";
  const type = profile.agentType ?? "unknown";
  const metadata = [
    `dpr_id: "${profile.dprId}"`,
    `authorized_tenant_id: "${profile.tenantId}"`,
    `current_role: "${role}"`,
    `agent_type: "${type}"`,
    `persona_compiler: "linkaios"`
  ].join("\n");

  return ensureTrailingNewline(`${metadata}\n\n${body.trim()}`);
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function mergeNonConflictingLines(primary: string, fallback: string): string {
  if (!fallback.trim()) {
    return primary;
  }

  const primaryLineSet = new Set(
    primary
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  );

  const extraLines = fallback
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .filter((line) => !primaryLineSet.has(line.trim()));

  if (extraLines.length === 0) {
    return primary;
  }

  return ensureTrailingNewline(
    `${primary.trim()}\n\n## Legacy Local Additions (Merged)\n\n${extraLines.join("\n")}`
  );
}

function policyPackageLabel(raw?: string): string {
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim();
  }
  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `agent_persona_policy_${yy}${mm}${dd}`;
}

function toRuntimeModelProfile(record: AgentModelProfileRecord) {
  return AgentModelProfileSchema.parse({
    tenantId: record.tenant_id,
    dprId: record.dpr_id,
    reasoningModel: record.reasoning_model,
    contextModel: record.context_model,
    executionModel: record.execution_model,
    reviewModel: record.review_model ?? undefined,
    heartbeatModel: record.heartbeat_model ?? undefined,
    dynamicSequencing: record.dynamic_sequencing,
    reviewRequired: record.review_required,
    maxReviewLoops: record.max_review_loops,
    policyMetadata: record.policy_metadata ?? {}
  });
}

function resolveLayeredSections(args: {
  profile: AgentProfile;
  kind: string;
  entities: KnowledgeEntityRecord[];
  revisionsById: Map<string, KnowledgeRevisionRecord>;
}): { sections: Array<{ label: string; body: string }>; sourceRevisionIds: string[] } {
  const scopeCandidates: Array<{
    label: string;
    scopeKind: KnowledgeEntityRecord["scope_kind"];
    scopeKeys: string[];
  }> = [
    { label: "Global", scopeKind: "global", scopeKeys: ["all", "*", "global", "company"] }
  ];

  if (args.kind === "memory") {
    scopeCandidates.push({ label: "Memory Seed", scopeKind: "memory_seed", scopeKeys: ["default", "all", "*"] });
  }

  if (args.profile.agentType) {
    scopeCandidates.push({
      label: `Type (${args.profile.agentType})`,
      scopeKind: "type",
      scopeKeys: [args.profile.agentType]
    });
  }

  const roleKey = normalizeRoleKey(args.profile.currentRole);
  if (roleKey) {
    scopeCandidates.push({
      label: `Role (${roleKey})`,
      scopeKind: "role",
      scopeKeys: [roleKey]
    });
  }

  scopeCandidates.push({
    label: `Agent (${args.profile.dprId})`,
    scopeKind: "agent_override",
    scopeKeys: [args.profile.dprId]
  });

  const sections: Array<{ label: string; body: string }> = [];
  const sourceRevisionIds = new Set<string>();

  for (const scope of scopeCandidates) {
    const matching = args.entities
      .filter((entity) => entity.entity_kind === "persona")
      .filter((entity) => entity.content_kind === args.kind)
      .filter((entity) => entity.scope_kind === scope.scopeKind)
      .filter((entity) => scope.scopeKeys.includes(entity.scope_key))
      .filter((entity) => entity.status === "published")
      .filter((entity) => Boolean(entity.published_revision_id))
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at));

    const winner = matching[0];
    if (!winner || !winner.published_revision_id) {
      continue;
    }

    const revision = args.revisionsById.get(winner.published_revision_id);
    if (!revision) {
      continue;
    }

    sourceRevisionIds.add(revision.id);
    sections.push({
      label: `${scope.label} / ${winner.title}`,
      body: revision.body
    });
  }

  return {
    sections,
    sourceRevisionIds: [...sourceRevisionIds]
  };
}

async function buildPersonaBundlePreview(args: {
  studioBrain: LiNKbrainClient;
  tenantId: string;
  profile: AgentProfile;
}): Promise<{
  bundle: Record<string, string>;
  contentHash: string;
  sourceRevisionIds: string[];
  layers: Array<{
    contentKind: string;
    sections: Array<{ label: string; body: string }>;
  }>;
}> {
  const [entities, revisions] = await Promise.all([
    args.studioBrain.listKnowledgeEntities({ tenantId: args.tenantId, entityKind: "persona" }),
    args.studioBrain.listKnowledgeRevisions({ tenantId: args.tenantId })
  ]);
  const revisionsById = new Map(revisions.map((revision) => [revision.id, revision]));
  const bundle: Record<string, string> = {};
  const sourceRevisionIds = new Set<string>();
  const layers: Array<{ contentKind: string; sections: Array<{ label: string; body: string }> }> = [];

  for (const fileSpec of PERSONA_FILE_SPECS) {
    const layerResolution = resolveLayeredSections({
      profile: args.profile,
      kind: fileSpec.contentKind,
      entities,
      revisionsById
    });
    layers.push({
      contentKind: fileSpec.contentKind,
      sections: layerResolution.sections
    });

    for (const revisionId of layerResolution.sourceRevisionIds) {
      sourceRevisionIds.add(revisionId);
    }

    const fallback = readExistingPersonaContent(args.profile, fileSpec.contentKind);
    const composed = composePersonaBody({
      profile: args.profile,
      kind: fileSpec.contentKind,
      sections: layerResolution.sections,
      fallback
    });

    for (const fileName of fileSpec.outputFiles) {
      bundle[fileName] = composed;
    }
  }

  const contentHash = sha256Hex(
    JSON.stringify(Object.entries(bundle).sort(([left], [right]) => left.localeCompare(right)))
  );

  return {
    bundle,
    contentHash,
    sourceRevisionIds: [...sourceRevisionIds],
    layers
  };
}

async function compilePersonaBundleForAgent(args: {
  studioBrain: LiNKbrainClient;
  tenantId: string;
  profile: AgentProfile;
  actorDprId: string;
}): Promise<PersonaCompiledBundleRecord> {
  const preview = await buildPersonaBundlePreview({
    studioBrain: args.studioBrain,
    tenantId: args.tenantId,
    profile: args.profile
  });

  const persisted = await args.studioBrain.upsertPersonaCompiledBundle({
    tenantId: args.tenantId,
    dprId: args.profile.dprId,
    sourceRevisionIds: preview.sourceRevisionIds,
    bundle: preview.bundle,
    contentHash: preview.contentHash,
    createdByAgent: args.actorDprId
  });

  await args.studioBrain.upsertPersonaAgentSyncState({
    tenantId: args.tenantId,
    dprId: args.profile.dprId,
    expectedRevisionHash: persisted.content_hash,
    syncStatus: "drift",
    syncMetadata: {
      source_revision_count: preview.sourceRevisionIds.length,
      compiler: "linkaios",
      compiled_at: new Date().toISOString()
    },
    lastSyncAt: new Date().toISOString()
  });

  return persisted;
}

function applyBundleToLocalFiles(profile: AgentProfile, bundle: Record<string, string>): void {
  for (const [fileName, content] of Object.entries(bundle)) {
    const fullPath = join(profile.agentDir, fileName);
    writeFileSync(fullPath, ensureTrailingNewline(content), "utf8");
  }

  if (bundle["MEMORY.md"]) {
    writeFileSync(join(profile.agentDir, "memory.md"), ensureTrailingNewline(bundle["MEMORY.md"]), "utf8");
  }
}

async function evaluatePersonaReadiness(
  studioBrain: LiNKbrainClient,
  tenantId: string,
  profiles: AgentProfile[]
): Promise<{ summary: Record<string, number | boolean>; agents: PersonaReadinessAgent[] }> {
  const roster = discoverInternalAgents();
  const base = evaluateOperationalCertificationFromRoster(roster.managers, roster.workers);
  const baseByAgent = new Map(base.agents.map((agent) => [agent.dprId, agent]));
  const syncState = await studioBrain.listPersonaAgentSyncState({ tenantId });
  const syncByAgent = new Map(syncState.map((entry) => [entry.dpr_id, entry]));

  const agents: PersonaReadinessAgent[] = [];
  for (const profile of profiles) {
    const baseReady = baseByAgent.get(profile.dprId)?.ready ?? false;
    const bundle = await studioBrain.getLatestPersonaBundle({ tenantId, dprId: profile.dprId });
    const sync = syncByAgent.get(profile.dprId);

    const hasPublishedBundle = Boolean(bundle);
    const activeBundleHash = bundle?.content_hash ?? null;
    const expectedRevisionHash = sync?.expected_revision_hash ?? null;
    const acknowledgedRevisionHash = sync?.acknowledged_revision_hash ?? null;
    const syncAcknowledged = Boolean(activeBundleHash && acknowledgedRevisionHash === activeBundleHash);
    const hasPolicyPackage = Boolean(sync?.policy_package);

    const gaps: string[] = [];
    if (!baseReady) gaps.push("base operational certification failed");
    if (!hasPublishedBundle) gaps.push("missing published persona bundle");
    if (!syncAcknowledged) gaps.push("persona bundle not acknowledged by runtime");
    if (!hasPolicyPackage) gaps.push("policy package not assigned");

    agents.push({
      dprId: profile.dprId,
      lane: profile.lane,
      baseOperationalReady: baseReady,
      hasPublishedBundle,
      syncAcknowledged,
      hasPolicyPackage,
      expectedRevisionHash,
      acknowledgedRevisionHash,
      activeBundleHash,
      ready: gaps.length === 0,
      gaps
    });
  }

  const readyAgents = agents.filter((agent) => agent.ready).length;
  return {
    summary: {
      totalAgents: agents.length,
      readyAgents,
      failedAgents: agents.length - readyAgents,
      publishedBundles: agents.filter((agent) => agent.hasPublishedBundle).length,
      acknowledgedBundles: agents.filter((agent) => agent.syncAcknowledged).length,
      policyAssignedAgents: agents.filter((agent) => agent.hasPolicyPackage).length,
      fullRosterReady: readyAgents === agents.length
    },
    agents
  };
}

function compareBundleToLocal(
  profile: AgentProfile,
  bundle: Record<string, string>
): Array<{ file: string; matches: boolean }> {
  const checks: Array<{ file: string; matches: boolean }> = [];
  for (const [fileName, expected] of Object.entries(bundle)) {
    const fullPath = join(profile.agentDir, fileName);
    try {
      const localContent = readFileSync(fullPath, "utf8");
      checks.push({ file: fileName, matches: sha256Hex(localContent) === sha256Hex(expected) });
    } catch {
      checks.push({ file: fileName, matches: false });
    }
  }
  return checks;
}

function localFileHashes(profile: AgentProfile): Array<{ file: string; hash: string | null }> {
  const files = new Set<string>();
  for (const spec of PERSONA_FILE_SPECS) {
    for (const output of spec.outputFiles) {
      files.add(output);
    }
  }

  const hashes: Array<{ file: string; hash: string | null }> = [];
  for (const file of files) {
    const fullPath = join(profile.agentDir, file);
    try {
      const content = readFileSync(fullPath, "utf8");
      hashes.push({ file, hash: sha256Hex(content) });
    } catch {
      hashes.push({ file, hash: null });
    }
  }
  return hashes;
}

function evaluatePolicyDecision(payload: z.infer<typeof POLICY_EVALUATION_SCHEMA>): {
  decision: PolicyDecisionRecord["decision"];
  reason: string;
} {
  const destinationAllowed = payload.allowlist.includes(payload.destination);
  if (payload.dataSensitivity === "high" && !destinationAllowed) {
    return {
      decision: "deny",
      reason: "Destination is not allowlisted for high-sensitivity data"
    };
  }

  if (!destinationAllowed) {
    return {
      decision: "require_approval",
      reason: "Destination onboarding approval required before egress"
    };
  }

  return {
    decision: "allow",
    reason: "Destination is allowlisted by policy package"
  };
}

function randomMissionId(): string {
  return randomUUID();
}

export function registerPersonaControlRoutes(deps: PersonaDeps): void {
  const { app, studioBrain, defaultTenantId, createEvent, emitEvent } = deps;

  app.get("/persona/readiness", async (req, res) => {
    const tenantIdRaw = typeof req.query.tenantId === "string" ? req.query.tenantId : defaultTenantId;
    const tenantId = z.string().uuid().safeParse(tenantIdRaw);
    if (!tenantId.success) {
      return res.status(400).json({ accepted: false, reason: "tenantId must be a UUID" });
    }

    try {
      const profiles = listAgentProfiles().filter((profile) => profile.tenantId === tenantId.data);
      const readiness = await evaluatePersonaReadiness(studioBrain, tenantId.data, profiles);
      return res.json({
        accepted: true,
        tenantId: tenantId.data,
        summary: readiness.summary,
        agents: readiness.agents
      });
    } catch (error) {
      return res.status(500).json({
        accepted: false,
        reason: error instanceof Error ? error.message : "Unable to compute persona readiness"
      });
    }
  });

  app.get("/persona/entities", async (req, res) => {
    const tenantIdRaw = typeof req.query.tenantId === "string" ? req.query.tenantId : defaultTenantId;
    const tenantId = z.string().uuid().safeParse(tenantIdRaw);
    if (!tenantId.success) {
      return res.status(400).json({ accepted: false, reason: "tenantId must be a UUID" });
    }

    const entityKind = typeof req.query.entityKind === "string"
      ? z.enum(["persona", "policy", "guideline", "guardrail", "sop"]).safeParse(req.query.entityKind)
      : null;
    if (entityKind && !entityKind.success) {
      return res.status(400).json({ accepted: false, reason: "Invalid entityKind" });
    }

    try {
      const entities = await studioBrain.listKnowledgeEntities({
        tenantId: tenantId.data,
        entityKind: entityKind?.data
      });
      return res.json({ accepted: true, tenantId: tenantId.data, entities });
    } catch (error) {
      return res.status(500).json({
        accepted: false,
        reason: error instanceof Error ? error.message : "Unable to list persona entities"
      });
    }
  });

  app.get("/persona/revisions", async (req, res) => {
    const tenantIdRaw = typeof req.query.tenantId === "string" ? req.query.tenantId : defaultTenantId;
    const tenantId = z.string().uuid().safeParse(tenantIdRaw);
    if (!tenantId.success) {
      return res.status(400).json({ accepted: false, reason: "tenantId must be a UUID" });
    }

    const entityId = typeof req.query.entityId === "string" ? req.query.entityId : undefined;
    if (entityId && !z.string().uuid().safeParse(entityId).success) {
      return res.status(400).json({ accepted: false, reason: "entityId must be UUID" });
    }

    try {
      const revisions = await studioBrain.listKnowledgeRevisions({
        tenantId: tenantId.data,
        entityId
      });
      return res.json({ accepted: true, tenantId: tenantId.data, revisions });
    } catch (error) {
      return res.status(500).json({
        accepted: false,
        reason: error instanceof Error ? error.message : "Unable to list persona revisions"
      });
    }
  });

  app.get("/persona/approvals/queue", async (req, res) => {
    const parsed = PERSONA_APPROVAL_QUEUE_QUERY_SCHEMA.safeParse({
      tenantId: typeof req.query.tenantId === "string" ? req.query.tenantId : defaultTenantId,
      status: typeof req.query.status === "string" ? req.query.status : undefined
    });
    if (!parsed.success) {
      return res.status(400).json({ accepted: false, reason: parsed.error.flatten() });
    }

    try {
      const [entities, revisions] = await Promise.all([
        studioBrain.listKnowledgeEntities({ tenantId: parsed.data.tenantId }),
        studioBrain.listKnowledgeRevisions({ tenantId: parsed.data.tenantId })
      ]);
      const queue = revisions
        .filter((revision) => parsed.data.status ? revision.status === parsed.data.status : (revision.status === "review" || revision.status === "approved"))
        .map((revision) => ({
          revision,
          entity: entities.find((entity) => entity.id === revision.entity_id) ?? null
        }))
        .sort((left, right) => right.revision.created_at.localeCompare(left.revision.created_at));

      return res.json({
        accepted: true,
        tenantId: parsed.data.tenantId,
        queue
      });
    } catch (error) {
      return res.status(500).json({
        accepted: false,
        reason: error instanceof Error ? error.message : "Unable to load approval queue"
      });
    }
  });

  app.get("/persona/compile/preview", async (req, res) => {
    const parsed = PERSONA_PREVIEW_QUERY_SCHEMA.safeParse({
      tenantId: req.query.tenantId,
      dprId: req.query.dprId
    });
    if (!parsed.success) {
      return res.status(400).json({ accepted: false, reason: parsed.error.flatten() });
    }

    try {
      const profile = findProfileForTenant({
        tenantId: parsed.data.tenantId,
        dprId: parsed.data.dprId
      });
      if (!profile) {
        return res.status(404).json({ accepted: false, reason: "Agent profile not found for tenant" });
      }

      const preview = await buildPersonaBundlePreview({
        studioBrain,
        tenantId: parsed.data.tenantId,
        profile
      });
      return res.json({
        accepted: true,
        tenantId: parsed.data.tenantId,
        dprId: parsed.data.dprId,
        revisionHash: preview.contentHash,
        sourceRevisionIds: preview.sourceRevisionIds,
        layers: preview.layers,
        bundle: preview.bundle
      });
    } catch (error) {
      return res.status(500).json({
        accepted: false,
        reason: error instanceof Error ? error.message : "Unable to preview compiled persona"
      });
    }
  });

  app.get("/persona/compile/diff", async (req, res) => {
    const parsed = PERSONA_DIFF_QUERY_SCHEMA.safeParse({
      tenantId: req.query.tenantId,
      dprId: req.query.dprId
    });
    if (!parsed.success) {
      return res.status(400).json({ accepted: false, reason: parsed.error.flatten() });
    }

    try {
      const profile = findProfileForTenant({
        tenantId: parsed.data.tenantId,
        dprId: parsed.data.dprId
      });
      if (!profile) {
        return res.status(404).json({ accepted: false, reason: "Agent profile not found for tenant" });
      }

      const [preview, latestBundle] = await Promise.all([
        buildPersonaBundlePreview({
          studioBrain,
          tenantId: parsed.data.tenantId,
          profile
        }),
        studioBrain.getLatestPersonaBundle({
          tenantId: parsed.data.tenantId,
          dprId: parsed.data.dprId
        })
      ]);

      const localDiff = compareBundleToLocal(profile, preview.bundle);
      const bundleDiff = Object.entries(preview.bundle).map(([file, value]) => {
        const latest = latestBundle?.bundle[file];
        const changed = typeof latest !== "string" || sha256Hex(latest) !== sha256Hex(value);
        return {
          file,
          changed,
          latestHash: typeof latest === "string" ? sha256Hex(latest) : null,
          previewHash: sha256Hex(value)
        };
      });

      return res.json({
        accepted: true,
        tenantId: parsed.data.tenantId,
        dprId: parsed.data.dprId,
        latestBundleHash: latestBundle?.content_hash ?? null,
        previewHash: preview.contentHash,
        localDiff,
        bundleDiff
      });
    } catch (error) {
      return res.status(500).json({
        accepted: false,
        reason: error instanceof Error ? error.message : "Unable to compute compile diff"
      });
    }
  });

  app.get("/persona/bundles/:dprId", async (req, res) => {
    const tenantIdRaw = typeof req.query.tenantId === "string" ? req.query.tenantId : defaultTenantId;
    const tenantId = z.string().uuid().safeParse(tenantIdRaw);
    if (!tenantId.success) {
      return res.status(400).json({ accepted: false, reason: "tenantId must be a UUID" });
    }

    try {
      const bundle = await studioBrain.getLatestPersonaBundle({
        tenantId: tenantId.data,
        dprId: req.params.dprId
      });
      return res.json({ accepted: true, tenantId: tenantId.data, dprId: req.params.dprId, bundle });
    } catch (error) {
      return res.status(500).json({
        accepted: false,
        reason: error instanceof Error ? error.message : "Unable to fetch bundle"
      });
    }
  });

  app.get("/persona/sync/bundle", async (req, res) => {
    const parsed = PERSONA_SYNC_QUERY_SCHEMA.safeParse({
      tenantId: req.query.tenantId ?? req.query.tenant_id,
      dprId: req.query.dprId ?? req.query.dpr_id,
      expectedRevision: req.query.expectedRevision ?? req.query.expected_revision
    });

    if (!parsed.success) {
      return res.status(400).json({ accepted: false, reason: parsed.error.flatten() });
    }

    try {
      const bundle = await studioBrain.getLatestPersonaBundle({
        tenantId: parsed.data.tenantId,
        dprId: parsed.data.dprId
      });

      if (!bundle) {
        return res.status(404).json({ accepted: false, reason: "No compiled bundle" });
      }

      if (parsed.data.expectedRevision && parsed.data.expectedRevision !== bundle.content_hash) {
        return res.status(409).json({
          accepted: false,
          reason: "Expected revision hash mismatch",
          expectedRevision: parsed.data.expectedRevision,
          actualRevision: bundle.content_hash
        });
      }

      return res.json({
        accepted: true,
        tenantId: parsed.data.tenantId,
        dprId: parsed.data.dprId,
        revisionId: bundle.id,
        hash: bundle.content_hash,
        bundle: bundle.bundle
      });
    } catch (error) {
      return res.status(500).json({
        accepted: false,
        reason: error instanceof Error ? error.message : "Unable to fetch sync bundle"
      });
    }
  });

  app.post("/persona/sync/ack", async (req, res) => {
    const parsed = PERSONA_ACK_SCHEMA.safeParse({
      tenantId: req.body?.tenantId ?? req.body?.tenant_id,
      dprId: req.body?.dprId ?? req.body?.dpr_id,
      acknowledgedRevisionHash: req.body?.acknowledgedRevisionHash ?? req.body?.acknowledged_revision_hash,
      policyPackage: req.body?.policyPackage ?? req.body?.policy_package,
      metadata: req.body?.metadata
    });
    if (!parsed.success) {
      return res.status(400).json({ accepted: false, reason: parsed.error.flatten() });
    }

    try {
      const state = await studioBrain.upsertPersonaAgentSyncState({
        tenantId: parsed.data.tenantId,
        dprId: parsed.data.dprId,
        acknowledgedRevisionHash: parsed.data.acknowledgedRevisionHash,
        policyPackage: parsed.data.policyPackage,
        syncStatus: "synced",
        syncMetadata: {
          ...parsed.data.metadata,
          acknowledged_at: new Date().toISOString()
        },
        lastAckAt: new Date().toISOString()
      });

      return res.status(202).json({ accepted: true, state });
    } catch (error) {
      return res.status(500).json({
        accepted: false,
        reason: error instanceof Error ? error.message : "Unable to acknowledge persona sync"
      });
    }
  });

  app.post("/persona/entities", async (req, res) => {
    const parsed = PERSONA_ENTITY_SCHEMA.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ accepted: false, reason: parsed.error.flatten() });
    }

    try {
      const entity = await studioBrain.createKnowledgeEntity({
        tenantId: parsed.data.tenantId,
        entityKind: parsed.data.entityKind,
        contentKind: parsed.data.contentKind,
        scopeKind: parsed.data.scopeKind,
        scopeKey: parsed.data.scopeKey,
        title: parsed.data.title,
        status: parsed.data.status,
        createdByAgent: parsed.data.createdByDprId,
        metadata: parsed.data.metadata
      });

      const revision = await studioBrain.createKnowledgeRevision({
        tenantId: parsed.data.tenantId,
        entityId: entity.id,
        status: parsed.data.status,
        body: parsed.data.body,
        metadata: {
          ...parsed.data.metadata,
          source: "persona_control_plane"
        },
        contentHash: sha256Hex(parsed.data.body),
        createdByAgent: parsed.data.createdByDprId
      });

      await emitEvent(
        createEvent({
          eventType: "aios.task.progress",
          tenantId: parsed.data.tenantId,
          missionId: randomMissionId(),
          runId: `persona-${Date.now()}`,
          taskId: `revision-created-${revision.id}`,
          fromDprId: parsed.data.createdByDprId,
          toDprId: null,
          payload: {
            summary: "Persona revision created",
            detail: `${entity.content_kind}/${entity.scope_kind}/${entity.scope_key}`,
            category: "persona_revision_created",
            entityId: entity.id,
            revisionId: revision.id
          }
        })
      );

      let published: KnowledgeRevisionRecord | null = null;
      if (parsed.data.publishImmediately) {
        published = await studioBrain.publishKnowledgeRevision({
          tenantId: parsed.data.tenantId,
          entityId: entity.id,
          revisionId: revision.id,
          actorDprId: parsed.data.createdByDprId,
          reason: "publish_immediately"
        });

        await emitEvent(
          createEvent({
            eventType: "aios.task.progress",
            tenantId: parsed.data.tenantId,
            missionId: randomMissionId(),
            runId: `persona-${Date.now()}`,
            taskId: `revision-published-${published.id}`,
            fromDprId: parsed.data.createdByDprId,
            toDprId: null,
            payload: {
              summary: "Persona revision published",
              detail: `${entity.title} -> ${published.id}`,
              category: "persona_revision_published",
              entityId: entity.id,
              revisionId: published.id
            }
          })
        );
      }

      return res.status(201).json({ accepted: true, entity, revision, published });
    } catch (error) {
      return res.status(500).json({
        accepted: false,
        reason: error instanceof Error ? error.message : "Unable to create persona entity"
      });
    }
  });

  app.post("/persona/revisions", async (req, res) => {
    const parsed = PERSONA_REVISION_SCHEMA.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ accepted: false, reason: parsed.error.flatten() });
    }

    try {
      const revision = await studioBrain.createKnowledgeRevision({
        tenantId: parsed.data.tenantId,
        entityId: parsed.data.entityId,
        status: parsed.data.status,
        body: parsed.data.body,
        metadata: {
          ...parsed.data.metadata,
          source: "persona_control_plane"
        },
        contentHash: sha256Hex(parsed.data.body),
        createdByAgent: parsed.data.createdByDprId
      });

      await emitEvent(
        createEvent({
          eventType: "aios.task.progress",
          tenantId: parsed.data.tenantId,
          missionId: randomMissionId(),
          runId: `persona-${Date.now()}`,
          taskId: `revision-created-${revision.id}`,
          fromDprId: parsed.data.createdByDprId,
          toDprId: null,
          payload: {
            summary: "Persona revision created",
            detail: `${parsed.data.entityId} -> ${revision.id}`,
            category: "persona_revision_created",
            entityId: parsed.data.entityId,
            revisionId: revision.id
          }
        })
      );
      return res.status(201).json({ accepted: true, revision });
    } catch (error) {
      return res.status(500).json({
        accepted: false,
        reason: error instanceof Error ? error.message : "Unable to create revision"
      });
    }
  });

  app.post("/persona/revisions/publish", async (req, res) => {
    const parsed = PERSONA_PUBLISH_SCHEMA.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ accepted: false, reason: parsed.error.flatten() });
    }

    try {
      const published = await studioBrain.publishKnowledgeRevision({
        tenantId: parsed.data.tenantId,
        entityId: parsed.data.entityId,
        revisionId: parsed.data.revisionId,
        actorDprId: parsed.data.actorDprId,
        reason: parsed.data.reason
      });

      await emitEvent(
        createEvent({
          eventType: "aios.task.progress",
          tenantId: parsed.data.tenantId,
          missionId: randomMissionId(),
          runId: `persona-${Date.now()}`,
          taskId: `revision-published-${published.id}`,
          fromDprId: parsed.data.actorDprId,
          toDprId: null,
          payload: {
            summary: "Persona revision published",
            detail: `${parsed.data.entityId} -> ${published.id}`,
            category: "persona_revision_published",
            entityId: parsed.data.entityId,
            revisionId: published.id
          }
        })
      );

      const profiles = listAgentProfiles().filter((profile) => profile.tenantId === parsed.data.tenantId);
      const targets = parsed.data.compileTargets?.length
        ? profiles.filter((profile) => parsed.data.compileTargets?.includes(profile.dprId))
        : profiles;

      const compiled: Array<{ dprId: string; hash: string }> = [];
      for (const profile of targets) {
        const bundle = await compilePersonaBundleForAgent({
          studioBrain,
          tenantId: parsed.data.tenantId,
          profile,
          actorDprId: parsed.data.actorDprId
        });

        compiled.push({ dprId: profile.dprId, hash: bundle.content_hash });

        await emitEvent(
          createEvent({
            eventType: "aios.task.progress",
            tenantId: parsed.data.tenantId,
            missionId: randomMissionId(),
            runId: `persona-${Date.now()}`,
            taskId: `compile-${profile.dprId}`,
            fromDprId: parsed.data.actorDprId,
            toDprId: profile.dprId,
            payload: {
              summary: "Persona bundle compiled",
              detail: `${profile.dprId} hash=${bundle.content_hash}`,
              category: "persona_compiler"
            }
          })
        );
      }

      return res.status(202).json({
        accepted: true,
        published,
        compiled
      });
    } catch (error) {
      return res.status(500).json({
        accepted: false,
        reason: error instanceof Error ? error.message : "Unable to publish revision"
      });
    }
  });

  app.post("/persona/revisions/rollback", async (req, res) => {
    const parsed = PERSONA_ROLLBACK_SCHEMA.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ accepted: false, reason: parsed.error.flatten() });
    }

    try {
      const rollback = await studioBrain.rollbackKnowledgeEntity({
        tenantId: parsed.data.tenantId,
        entityId: parsed.data.entityId,
        targetRevisionId: parsed.data.targetRevisionId,
        actorDprId: parsed.data.actorDprId,
        reason: parsed.data.reason
      });

      await emitEvent(
        createEvent({
          eventType: "aios.task.progress",
          tenantId: parsed.data.tenantId,
          missionId: randomMissionId(),
          runId: `persona-${Date.now()}`,
          taskId: `revision-rollback-${rollback.id}`,
          fromDprId: parsed.data.actorDprId,
          toDprId: null,
          payload: {
            summary: "Persona revision rolled back",
            detail: `${parsed.data.entityId} -> ${rollback.id}`,
            category: "persona_revision_rolled_back",
            entityId: parsed.data.entityId,
            revisionId: rollback.id
          }
        })
      );

      return res.status(202).json({ accepted: true, rollback });
    } catch (error) {
      return res.status(500).json({
        accepted: false,
        reason: error instanceof Error ? error.message : "Unable to rollback revision"
      });
    }
  });

  app.post("/persona/migration/import-local", async (req, res) => {
    const parsed = PERSONA_IMPORT_SCHEMA.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ accepted: false, reason: parsed.error.flatten() });
    }

    try {
      const profiles = listAgentProfiles().filter((profile) => profile.tenantId === parsed.data.tenantId);
      const entities = await studioBrain.listKnowledgeEntities({
        tenantId: parsed.data.tenantId,
        entityKind: "persona"
      });
      const revisions = await studioBrain.listKnowledgeRevisions({ tenantId: parsed.data.tenantId });

      const entityByKey = new Map<string, KnowledgeEntityRecord>();
      for (const entity of entities) {
        entityByKey.set(`${entity.content_kind}:${entity.scope_kind}:${entity.scope_key}:${entity.title}`, entity);
      }

      const revisionHashesByEntity = new Map<string, Set<string>>();
      for (const revision of revisions) {
        const set = revisionHashesByEntity.get(revision.entity_id) ?? new Set<string>();
        set.add(revision.content_hash);
        revisionHashesByEntity.set(revision.entity_id, set);
      }

      const imported: Array<{ dprId: string; file: string; revisionId: string; published: boolean }> = [];
      for (const profile of profiles) {
        for (const fileSpec of PERSONA_FILE_SPECS) {
          const content = readExistingPersonaContent(profile, fileSpec.contentKind);
          if (!content.trim()) {
            continue;
          }

          const title = `${profile.dprId}-${fileSpec.contentKind}`;
          const entityKey = `${fileSpec.contentKind}:agent_override:${profile.dprId}:${title}`;
          const existingEntity = entityByKey.get(entityKey);
          const entity = existingEntity ?? await studioBrain.createKnowledgeEntity({
            tenantId: parsed.data.tenantId,
            entityKind: "persona",
            contentKind: fileSpec.contentKind,
            scopeKind: "agent_override",
            scopeKey: profile.dprId,
            title,
            status: parsed.data.publishImported ? "published" : "draft",
            createdByAgent: parsed.data.actorDprId,
            metadata: {
              source: "migration_local_files",
              source_path: join(profile.agentDir, fileSpec.outputFiles[0])
            }
          });

          entityByKey.set(entityKey, entity);

          const hash = sha256Hex(content);
          const knownHashes = revisionHashesByEntity.get(entity.id) ?? new Set<string>();
          if (knownHashes.has(hash)) {
            continue;
          }

          const revision = await studioBrain.createKnowledgeRevision({
            tenantId: parsed.data.tenantId,
            entityId: entity.id,
            status: parsed.data.publishImported ? "published" : "draft",
            body: content,
            metadata: {
              source: "migration_local_files",
              source_path: join(profile.agentDir, fileSpec.outputFiles[0])
            },
            contentHash: hash,
            createdByAgent: parsed.data.actorDprId
          });

          let published = false;
          if (parsed.data.publishImported) {
            await studioBrain.publishKnowledgeRevision({
              tenantId: parsed.data.tenantId,
              entityId: entity.id,
              revisionId: revision.id,
              actorDprId: parsed.data.actorDprId,
              reason: "migration_publish"
            });
            published = true;
          }

          knownHashes.add(hash);
          revisionHashesByEntity.set(entity.id, knownHashes);
          imported.push({
            dprId: profile.dprId,
            file: fileSpec.outputFiles[0],
            revisionId: revision.id,
            published
          });
        }
      }

      return res.status(202).json({ accepted: true, importedCount: imported.length, imported });
    } catch (error) {
      return res.status(500).json({
        accepted: false,
        reason: error instanceof Error ? error.message : "Unable to import local personas"
      });
    }
  });

  app.post("/persona/migration/compile-all", async (req, res) => {
    const parsed = PERSONA_IMPORT_SCHEMA.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ accepted: false, reason: parsed.error.flatten() });
    }

    try {
      const profiles = listAgentProfiles().filter((profile) => profile.tenantId === parsed.data.tenantId);
      const compiled: Array<{ dprId: string; hash: string }> = [];
      const packageLabel = policyPackageLabel(parsed.data.policyPackage);

      for (const profile of profiles) {
        const bundle = await compilePersonaBundleForAgent({
          studioBrain,
          tenantId: parsed.data.tenantId,
          profile,
          actorDprId: parsed.data.actorDprId
        });

        applyBundleToLocalFiles(profile, bundle.bundle);
        await studioBrain.upsertPersonaAgentSyncState({
          tenantId: parsed.data.tenantId,
          dprId: profile.dprId,
          expectedRevisionHash: bundle.content_hash,
          acknowledgedRevisionHash: bundle.content_hash,
          policyPackage: packageLabel,
          syncStatus: "synced",
          syncMetadata: {
            applied_by: parsed.data.actorDprId,
            applied_at: new Date().toISOString(),
            source: "migration_compile_all",
            policy_package: packageLabel
          },
          lastSyncAt: new Date().toISOString(),
          lastAckAt: new Date().toISOString()
        });

        compiled.push({ dprId: profile.dprId, hash: bundle.content_hash });
      }

      return res.status(202).json({
        accepted: true,
        policyPackage: packageLabel,
        compiledCount: compiled.length,
        compiled
      });
    } catch (error) {
      return res.status(500).json({
        accepted: false,
        reason: error instanceof Error ? error.message : "Unable to compile persona bundles"
      });
    }
  });

  app.get("/persona/migration/parity", async (req, res) => {
    const tenantIdRaw = typeof req.query.tenantId === "string" ? req.query.tenantId : defaultTenantId;
    const tenantId = z.string().uuid().safeParse(tenantIdRaw);
    if (!tenantId.success) {
      return res.status(400).json({ accepted: false, reason: "tenantId must be a UUID" });
    }

    try {
      const profiles = listAgentProfiles().filter((profile) => profile.tenantId === tenantId.data);
      const parity: Array<{ dprId: string; hash: string | null; files: Array<{ file: string; matches: boolean }> }> = [];
      for (const profile of profiles) {
        const bundle = await studioBrain.getLatestPersonaBundle({ tenantId: tenantId.data, dprId: profile.dprId });
        parity.push({
          dprId: profile.dprId,
          hash: bundle?.content_hash ?? null,
          files: bundle ? compareBundleToLocal(profile, bundle.bundle) : []
        });
      }

      return res.json({
        accepted: true,
        tenantId: tenantId.data,
        parity,
        allMatched: parity.every((entry) => entry.files.every((check) => check.matches))
      });
    } catch (error) {
      return res.status(500).json({
        accepted: false,
        reason: error instanceof Error ? error.message : "Unable to evaluate parity"
      });
    }
  });

  app.get("/persona/migration/evidence", async (req, res) => {
    const parsed = PERSONA_MIGRATION_EVIDENCE_QUERY_SCHEMA.safeParse({
      tenantId: typeof req.query.tenantId === "string" ? req.query.tenantId : defaultTenantId
    });
    if (!parsed.success) {
      return res.status(400).json({ accepted: false, reason: parsed.error.flatten() });
    }

    try {
      const profiles = listAgentProfiles().filter((profile) => profile.tenantId === parsed.data.tenantId);
      const [syncStates, auditTrail] = await Promise.all([
        studioBrain.listPersonaAgentSyncState({ tenantId: parsed.data.tenantId }),
        studioBrain.listPersonaRevisionAudit({ tenantId: parsed.data.tenantId })
      ]);
      const syncByDpr = new Map(syncStates.map((state) => [state.dpr_id, state]));

      const perAgent = await Promise.all(
        profiles.map(async (profile) => {
          const [bundle, localHashesBefore] = await Promise.all([
            studioBrain.getLatestPersonaBundle({ tenantId: parsed.data.tenantId, dprId: profile.dprId }),
            Promise.resolve(localFileHashes(profile))
          ]);

          const bundleHashes = Object.entries(bundle?.bundle ?? {}).map(([file, content]) => ({
            file,
            hash: sha256Hex(content)
          }));
          const parity = bundle ? compareBundleToLocal(profile, bundle.bundle) : [];
          const sync = syncByDpr.get(profile.dprId) ?? null;

          return {
            dprId: profile.dprId,
            lane: profile.lane,
            role: profile.currentRole,
            type: profile.agentType,
            latestBundleHash: bundle?.content_hash ?? null,
            localHashesBefore,
            bundleHashes,
            parity,
            syncState: sync
          };
        })
      );

      return res.json({
        accepted: true,
        tenantId: parsed.data.tenantId,
        generatedAt: new Date().toISOString(),
        summary: {
          agents: perAgent.length,
          parityMatchedAgents: perAgent.filter((entry) => entry.parity.every((check) => check.matches)).length,
          policyAssignedAgents: perAgent.filter((entry) => Boolean(entry.syncState?.policy_package)).length,
          ackedAgents: perAgent.filter((entry) => {
            const sync = entry.syncState;
            return Boolean(sync && sync.acknowledged_revision_hash && entry.latestBundleHash === sync.acknowledged_revision_hash);
          }).length
        },
        approvalsAndRollbacks: auditTrail,
        agents: perAgent
      });
    } catch (error) {
      return res.status(500).json({
        accepted: false,
        reason: error instanceof Error ? error.message : "Unable to build migration evidence package"
      });
    }
  });

  app.post("/persona/migration/apply-v1", async (req, res) => {
    const parsed = PERSONA_APPLY_V1_SCHEMA.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ accepted: false, reason: parsed.error.flatten() });
    }

    try {
      const layers = buildPersonaV1Layers({
        includeBirthDate: parsed.data.includeBirthDateInUserFile
      });
      const existing = await studioBrain.listKnowledgeEntities({
        tenantId: parsed.data.tenantId,
        entityKind: "persona"
      });
      const existingByKey = new Map(
        existing.map((entity) => [
          `${entity.content_kind}:${entity.scope_kind}:${entity.scope_key}:${entity.title}`,
          entity
        ])
      );

      const seeded: Array<{ entityId: string; revisionId: string; title: string }> = [];
      for (const layer of layers) {
        const key = `${layer.contentKind}:${layer.scopeKind}:${layer.scopeKey}:${layer.title}`;
        const entity = existingByKey.get(key) ?? await studioBrain.createKnowledgeEntity({
          tenantId: parsed.data.tenantId,
          entityKind: "persona",
          contentKind: layer.contentKind,
          scopeKind: layer.scopeKind,
          scopeKey: layer.scopeKey,
          title: layer.title,
          status: "published",
          createdByAgent: parsed.data.actorDprId,
          metadata: {
            source: "persona_v1_seed",
            seed_version: "v1.0"
          }
        });
        existingByKey.set(key, entity);

        const revision = await studioBrain.createKnowledgeRevision({
          tenantId: parsed.data.tenantId,
          entityId: entity.id,
          status: "published",
          body: layer.body,
          metadata: {
            source: "persona_v1_seed",
            seed_version: "v1.0"
          },
          contentHash: sha256Hex(layer.body),
          createdByAgent: parsed.data.actorDprId
        });
        const published = await studioBrain.publishKnowledgeRevision({
          tenantId: parsed.data.tenantId,
          entityId: entity.id,
          revisionId: revision.id,
          actorDprId: parsed.data.actorDprId,
          reason: "persona_v1_apply"
        });

        seeded.push({ entityId: entity.id, revisionId: published.id, title: layer.title });
      }

      let compile: {
        policyPackage: string;
        compiledCount: number;
        compiled: Array<{ dprId: string; hash: string }>;
      } | null = null;

      if (parsed.data.compileAfterPublish) {
        const packageLabel = policyPackageLabel(parsed.data.policyPackage);
        const profiles = listAgentProfiles().filter((profile) => profile.tenantId === parsed.data.tenantId);
        const compiled: Array<{ dprId: string; hash: string }> = [];
        for (const profile of profiles) {
          const bundle = await compilePersonaBundleForAgent({
            studioBrain,
            tenantId: parsed.data.tenantId,
            profile,
            actorDprId: parsed.data.actorDprId
          });
          applyBundleToLocalFiles(profile, bundle.bundle);
          await studioBrain.upsertPersonaAgentSyncState({
            tenantId: parsed.data.tenantId,
            dprId: profile.dprId,
            expectedRevisionHash: bundle.content_hash,
            acknowledgedRevisionHash: bundle.content_hash,
            policyPackage: packageLabel,
            syncStatus: "synced",
            syncMetadata: {
              source: "persona_v1_apply",
              applied_by: parsed.data.actorDprId,
              applied_at: new Date().toISOString(),
              policy_package: packageLabel
            },
            lastSyncAt: new Date().toISOString(),
            lastAckAt: new Date().toISOString()
          });
          compiled.push({ dprId: profile.dprId, hash: bundle.content_hash });
        }

        compile = {
          policyPackage: packageLabel,
          compiledCount: compiled.length,
          compiled
        };
      }

      return res.status(202).json({
        accepted: true,
        seededCount: seeded.length,
        seeded,
        compile
      });
    } catch (error) {
      return res.status(500).json({
        accepted: false,
        reason: error instanceof Error ? error.message : "Unable to apply v1 persona seed"
      });
    }
  });

  app.post("/orchestration/model-profiles/upsert", async (req, res) => {
    const parsed = MODEL_PROFILE_UPSERT_SCHEMA.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ accepted: false, reason: parsed.error.flatten() });
    }

    if (parsed.data.dprId !== LISA_DPR_ID) {
      return res.status(409).json({
        accepted: false,
        reason: `Lisa-only rollout: only ${LISA_DPR_ID} can be configured at this stage`
      });
    }

    try {
      const stored = await studioBrain.upsertAgentModelProfile({
        tenantId: parsed.data.tenantId,
        dprId: parsed.data.dprId,
        reasoningModel: parsed.data.reasoningModel,
        contextModel: parsed.data.contextModel,
        executionModel: parsed.data.executionModel,
        reviewModel: parsed.data.reviewModel,
        heartbeatModel: parsed.data.heartbeatModel,
        dynamicSequencing: parsed.data.dynamicSequencing,
        reviewRequired: parsed.data.reviewRequired,
        maxReviewLoops: parsed.data.maxReviewLoops,
        policyMetadata: parsed.data.policyMetadata,
        updatedByAgent: parsed.data.actorDprId
      });

      await emitEvent(
        createEvent({
          eventType: "aios.task.progress",
          tenantId: parsed.data.tenantId,
          missionId: randomMissionId(),
          runId: `model-profile-${Date.now()}`,
          taskId: `upsert-${parsed.data.dprId.toLowerCase()}`,
          fromDprId: parsed.data.actorDprId,
          toDprId: parsed.data.dprId,
          payload: {
            summary: "Agent model profile updated",
            detail: `reasoning=${stored.reasoning_model} context=${stored.context_model} execution=${stored.execution_model}`,
            dpr_id: stored.dpr_id
          }
        })
      );

      return res.status(202).json({
        accepted: true,
        profile: stored
      });
    } catch (error) {
      return res.status(500).json({
        accepted: false,
        reason: error instanceof Error ? error.message : "Unable to upsert model profile"
      });
    }
  });

  app.get("/orchestration/model-profiles", async (req, res) => {
    const parsed = MODEL_PROFILE_QUERY_SCHEMA.safeParse({
      tenantId: typeof req.query.tenantId === "string" ? req.query.tenantId : defaultTenantId,
      dprId: typeof req.query.dprId === "string" ? req.query.dprId : undefined
    });
    if (!parsed.success) {
      return res.status(400).json({ accepted: false, reason: parsed.error.flatten() });
    }

    if (parsed.data.dprId !== LISA_DPR_ID) {
      return res.status(409).json({
        accepted: false,
        reason: `Lisa-only rollout: only ${LISA_DPR_ID} is supported now`
      });
    }

    try {
      const profile = await studioBrain.getAgentModelProfile({
        tenantId: parsed.data.tenantId,
        dprId: parsed.data.dprId
      });

      return res.json({
        accepted: true,
        profile
      });
    } catch (error) {
      return res.status(500).json({
        accepted: false,
        reason: error instanceof Error ? error.message : "Unable to fetch model profile"
      });
    }
  });

  app.post("/orchestration/plan", async (req, res) => {
    const parsed = ORCHESTRATION_PLAN_SCHEMA.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ accepted: false, reason: parsed.error.flatten() });
    }

    if (parsed.data.dprId !== LISA_DPR_ID) {
      return res.status(409).json({
        accepted: false,
        reason: `Lisa-only rollout: only ${LISA_DPR_ID} is supported now`
      });
    }

    try {
      const stored = await studioBrain.getAgentModelProfile({
        tenantId: parsed.data.tenantId,
        dprId: parsed.data.dprId
      });

      if (!stored) {
        return res.status(404).json({
          accepted: false,
          reason: "No model profile found for agent. Configure it via /orchestration/model-profiles/upsert."
        });
      }

      const profile = toRuntimeModelProfile(stored);
      const taskInput = TaskOrchestrationInputSchema.parse({
        taskPrompt: parsed.data.taskPrompt,
        contextRefs: parsed.data.contextRefs,
        metadata: parsed.data.metadata
      });
      const plan = buildDynamicOrchestrationPlan(profile, taskInput);

      await studioBrain.logPolicyDecision({
        tenantId: parsed.data.tenantId,
        runId: parsed.data.runId,
        taskId: parsed.data.taskId,
        dprId: parsed.data.dprId,
        policyPackage: "agent_persona_policy_orchestration_lisa",
        decision: "allow",
        reason: "Dynamic model-role orchestration plan generated",
        destination: "local_orchestrator",
        toolName: "model_role_router",
        dataSensitivity: "low",
        metadata: {
          sequence: plan.sequence.map((phase) => ({ role: phase.role, model: phase.model })),
          include_context_phase: plan.decision.includeContextPhase
        }
      });

      return res.status(202).json({
        accepted: true,
        tenantId: parsed.data.tenantId,
        dprId: parsed.data.dprId,
        missionId: parsed.data.missionId ?? null,
        runId: parsed.data.runId,
        taskId: parsed.data.taskId,
        plan
      });
    } catch (error) {
      return res.status(500).json({
        accepted: false,
        reason: error instanceof Error ? error.message : "Unable to generate orchestration plan"
      });
    }
  });

  app.post("/policies/evaluate", async (req, res) => {
    const parsed = POLICY_EVALUATION_SCHEMA.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ accepted: false, reason: parsed.error.flatten() });
    }

    try {
      const resolution = evaluatePolicyDecision(parsed.data);
      const logged = await studioBrain.logPolicyDecision({
        tenantId: parsed.data.tenantId,
        runId: parsed.data.runId,
        taskId: parsed.data.taskId,
        dprId: parsed.data.dprId,
        policyPackage: parsed.data.policyPackage,
        decision: resolution.decision,
        reason: resolution.reason,
        destination: parsed.data.destination,
        toolName: parsed.data.toolName,
        dataSensitivity: parsed.data.dataSensitivity,
        metadata: parsed.data.metadata
      });

      if (resolution.decision === "deny") {
        await emitEvent(
          createEvent({
            eventType: "aios.security.exception",
            tenantId: parsed.data.tenantId,
            missionId: parsed.data.missionId ?? randomMissionId(),
            runId: parsed.data.runId,
            taskId: parsed.data.taskId,
            fromDprId: parsed.data.dprId,
            toDprId: null,
            payload: {
              summary: "Policy denied outbound action",
              detail: `${parsed.data.destination}: ${resolution.reason}`,
              severity: "high"
            }
          })
        );
      }

      if (resolution.decision === "require_approval") {
        await emitEvent(
          createEvent({
            eventType: "aios.approval.requested",
            tenantId: parsed.data.tenantId,
            missionId: parsed.data.missionId ?? randomMissionId(),
            runId: parsed.data.runId,
            taskId: parsed.data.taskId,
            fromDprId: parsed.data.dprId,
            toDprId: null,
            payload: {
              summary: "Destination onboarding approval required",
              detail: parsed.data.destination,
              kind: "destination_onboarding",
              state: "requested"
            }
          })
        );
      }

      return res.status(202).json({
        accepted: true,
        decision: resolution.decision,
        reason: resolution.reason,
        record: logged
      });
    } catch (error) {
      return res.status(500).json({
        accepted: false,
        reason: error instanceof Error ? error.message : "Unable to evaluate policy"
      });
    }
  });

  app.post("/policies/killswitch", async (req, res) => {
    const parsed = KILLSWITCH_SCHEMA.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ accepted: false, reason: parsed.error.flatten() });
    }

    try {
      const state = await studioBrain.setKillSwitchState({
        tenantId: parsed.data.tenantId,
        scope: parsed.data.scope,
        targetKey: parsed.data.targetKey,
        state: parsed.data.state,
        reason: parsed.data.reason,
        actorDprId: parsed.data.actorDprId,
        metadata: parsed.data.metadata
      });

      const eventType: AiosEventEnvelope["eventType"] = parsed.data.state === "active"
        ? "aios.security.exception"
        : "aios.task.progress";

      await emitEvent(
        createEvent({
          eventType,
          tenantId: parsed.data.tenantId,
          missionId: parsed.data.missionId ?? randomMissionId(),
          runId: parsed.data.runId,
          taskId: parsed.data.taskId,
          fromDprId: parsed.data.actorDprId,
          toDprId: null,
          payload: {
            summary: `Kill switch ${parsed.data.state}`,
            detail: `${parsed.data.scope}:${parsed.data.targetKey} ${parsed.data.reason}`,
            scope: parsed.data.scope,
            targetKey: parsed.data.targetKey,
            state: parsed.data.state
          }
        })
      );

      return res.status(202).json({ accepted: true, state });
    } catch (error) {
      return res.status(500).json({
        accepted: false,
        reason: error instanceof Error ? error.message : "Unable to set kill switch"
      });
    }
  });
}
