import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseIdentityMetadata, type AgentType } from "@linktrend/linklogic";
import { AGENCY_PERSONA_SOURCE_REPO, getAgencyPersonaTemplate } from "./agency-personas.js";

export type AgentDiscovery = {
  managers: string[];
  workers: string[];
  agencyReadiness: AgencyReadinessSummary;
  operationalCertification: OperationalCertificationSummary;
};

export type AgentLane = "manager" | "worker";

export type AgencyReadinessAgent = {
  dprId: string;
  lane: AgentLane;
  identityPath: string;
  currentRole: string | null;
  agentType: AgentType | null;
  agencyPersonaRef: string | null;
  expectedPersonaRef: string | null;
  personaVersion: string | null;
  personaSourceRepo: string | null;
  ready: boolean;
  gaps: string[];
};

export type AgencyReadinessSummary = {
  totalAgents: number;
  readyAgents: number;
  missingAgentType: number;
  missingPersonaRef: number;
  missingPersonaVersion: number;
  missingPersonaSourceRepo: number;
  personaRefMismatch: number;
  personaSourceMismatch: number;
};

export type AgencyReadinessReport = {
  summary: AgencyReadinessSummary;
  agents: AgencyReadinessAgent[];
};

export type OperationalCertificationChecks = {
  identity: boolean;
  soul: boolean;
  memory: boolean;
  runtimeContract: boolean;
  dprTenantBinding: boolean;
  roleMetadata: boolean;
};

export type OperationalCertificationAgent = {
  dprId: string;
  lane: AgentLane;
  ready: boolean;
  checks: OperationalCertificationChecks;
  gaps: string[];
};

export type OperationalCertificationSummary = {
  totalAgents: number;
  readyAgents: number;
  failedAgents: number;
  initialRosterReady: boolean;
  missionIntakeDryRunReady: boolean;
  handoffDryRunReady: boolean;
};

export type OperationalCertificationReport = {
  summary: OperationalCertificationSummary;
  agents: OperationalCertificationAgent[];
};

const CANONICAL_INTERNAL_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const INITIAL_MANAGER_IDS = [
  "INT-MNG-260311-0001-LISA",
  "INT-MNG-260311-0002-ERIC",
  "INT-MNG-260311-0003-JOHN",
  "INT-MNG-260311-0004-MARK"
] as const;
const INITIAL_WORKER_IDS = [
  "INT-EXE-260311-0004-SARAH",
  "INT-EXE-260311-0005-MIKE",
  "INT-EXE-260311-0006-KATE",
  "INT-EXE-260311-0007-ALEX"
] as const;

function findWorkspaceRootFrom(startPath: string): string | null {
  let current = startPath;
  while (true) {
    const candidate = join(current, "linkbots", "internal");
    if (existsSync(candidate)) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function resolveWorkspaceRoot(): string {
  const byCwd = findWorkspaceRootFrom(process.cwd());
  if (byCwd) {
    return byCwd;
  }

  const moduleDirectory = dirname(fileURLToPath(import.meta.url));
  const byModulePath = findWorkspaceRootFrom(moduleDirectory);
  if (byModulePath) {
    return byModulePath;
  }

  throw new Error("Unable to resolve LiNKaios workspace root containing linkbots/internal");
}

const WORKSPACE_ROOT = resolveWorkspaceRoot();

/** Absolute path to `linkbots/internal/managers` under the LiNKaios workspace root. */
export const INTERNAL_MANAGERS_DIR = join(WORKSPACE_ROOT, "linkbots", "internal", "managers");

/** Absolute path to `linkbots/internal/workers` under the LiNKaios workspace root. */
export const INTERNAL_WORKERS_DIR = join(WORKSPACE_ROOT, "linkbots", "internal", "workers");

function listDprDirectories(path: string): string[] {
  if (!existsSync(path)) {
    return [];
  }
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function discoverInternalAgents(): AgentDiscovery {
  const managers = listDprDirectories(INTERNAL_MANAGERS_DIR);
  const workers = listDprDirectories(INTERNAL_WORKERS_DIR);
  const agencyReadiness = evaluateAgencyReadinessFromRoster(managers, workers);
  const operationalCertification = evaluateOperationalCertificationFromRoster(managers, workers);

  return {
    managers,
    workers,
    agencyReadiness: agencyReadiness.summary,
    operationalCertification: operationalCertification.summary
  };
}

function resolveIdentityPathByLane(lane: AgentLane, dprId: string): string {
  const basePath = lane === "manager" ? INTERNAL_MANAGERS_DIR : INTERNAL_WORKERS_DIR;
  const identityPath = join(basePath, dprId, "IDENTITY.md");
  if (!existsSync(identityPath)) {
    throw new Error(`Missing IDENTITY.md for ${dprId}`);
  }
  return identityPath;
}

function buildReadinessAgent(lane: AgentLane, dprId: string): AgencyReadinessAgent {
  const identityPath = resolveIdentityPathByLane(lane, dprId);
  const identity = parseIdentityMetadata(identityPath);
  const expectedTemplate = getAgencyPersonaTemplate(identity.agentType);
  const expectedPersonaRef = expectedTemplate?.agencyPersonaRef ?? null;

  const gaps: string[] = [];

  if (!identity.agentType) {
    gaps.push("missing agent_type");
  }
  if (!identity.agencyPersonaRef) {
    gaps.push("missing agency_persona_ref");
  }
  if (!identity.personaVersion) {
    gaps.push("missing persona_version");
  }
  if (!identity.personaSourceRepo) {
    gaps.push("missing persona_source_repo");
  }
  if (
    identity.agencyPersonaRef &&
    expectedPersonaRef &&
    identity.agencyPersonaRef !== expectedPersonaRef
  ) {
    gaps.push("agency_persona_ref does not match expected template for agent_type");
  }
  if (identity.personaSourceRepo && identity.personaSourceRepo !== AGENCY_PERSONA_SOURCE_REPO) {
    gaps.push("persona_source_repo differs from configured agency source");
  }

  return {
    dprId,
    lane,
    identityPath,
    currentRole: identity.currentRole ?? null,
    agentType: identity.agentType ?? null,
    agencyPersonaRef: identity.agencyPersonaRef ?? null,
    expectedPersonaRef,
    personaVersion: identity.personaVersion ?? null,
    personaSourceRepo: identity.personaSourceRepo ?? null,
    ready: gaps.length === 0,
    gaps
  };
}

function summarizeReadiness(agents: AgencyReadinessAgent[]): AgencyReadinessSummary {
  const hasGap = (agent: AgencyReadinessAgent, text: string) => agent.gaps.some((gap) => gap === text);

  return {
    totalAgents: agents.length,
    readyAgents: agents.filter((agent) => agent.ready).length,
    missingAgentType: agents.filter((agent) => hasGap(agent, "missing agent_type")).length,
    missingPersonaRef: agents.filter((agent) => hasGap(agent, "missing agency_persona_ref")).length,
    missingPersonaVersion: agents.filter((agent) => hasGap(agent, "missing persona_version")).length,
    missingPersonaSourceRepo: agents.filter((agent) => hasGap(agent, "missing persona_source_repo"))
      .length,
    personaRefMismatch: agents.filter((agent) =>
      hasGap(agent, "agency_persona_ref does not match expected template for agent_type")
    ).length,
    personaSourceMismatch: agents.filter((agent) =>
      hasGap(agent, "persona_source_repo differs from configured agency source")
    ).length
  };
}

export function evaluateAgencyReadinessFromRoster(
  managers: string[],
  workers: string[]
): AgencyReadinessReport {
  const agents = [
    ...managers.map((dprId) => buildReadinessAgent("manager", dprId)),
    ...workers.map((dprId) => buildReadinessAgent("worker", dprId))
  ];

  return {
    summary: summarizeReadiness(agents),
    agents
  };
}

export function evaluateAgencyReadiness(): AgencyReadinessReport {
  const managers = listDprDirectories(INTERNAL_MANAGERS_DIR);
  const workers = listDprDirectories(INTERNAL_WORKERS_DIR);
  return evaluateAgencyReadinessFromRoster(managers, workers);
}

function fileExists(path: string): boolean {
  return existsSync(path);
}

function buildOperationalCertificationAgent(
  lane: AgentLane,
  dprId: string
): OperationalCertificationAgent {
  const basePath = lane === "manager" ? INTERNAL_MANAGERS_DIR : INTERNAL_WORKERS_DIR;
  const identityPath = join(basePath, dprId, "IDENTITY.md");
  const soulPath = join(basePath, dprId, "soul.md");
  const memoryPath = join(basePath, dprId, "memory.md");
  const runtimeContractPath = join(basePath, dprId, "AGENTS.md");
  const runtimeEntrypointPath = join(basePath, dprId, "main.py");

  const checks: OperationalCertificationChecks = {
    identity: fileExists(identityPath),
    soul: fileExists(soulPath),
    memory: fileExists(memoryPath),
    runtimeContract: fileExists(runtimeContractPath),
    dprTenantBinding: false,
    roleMetadata: false
  };

  const gaps: string[] = [];

  if (!checks.identity) {
    gaps.push("missing IDENTITY.md");
  }
  if (!checks.soul) {
    gaps.push("missing soul.md");
  }
  if (!checks.memory) {
    gaps.push("missing memory.md");
  }
  if (!checks.runtimeContract) {
    gaps.push("missing AGENTS.md");
  }
  if (lane === "worker" && !fileExists(runtimeEntrypointPath)) {
    gaps.push("missing worker runtime main.py");
  }

  if (checks.identity) {
    const identity = parseIdentityMetadata(identityPath);
    checks.dprTenantBinding =
      identity.dprId === dprId && identity.tenantId === CANONICAL_INTERNAL_TENANT_ID;
    checks.roleMetadata = Boolean(identity.currentRole) && Boolean(identity.agentType);
  }

  if (!checks.dprTenantBinding) {
    gaps.push("dpr/tenant binding mismatch");
  }
  if (!checks.roleMetadata) {
    gaps.push("missing role metadata");
  }

  const ready = gaps.length === 0;
  return { dprId, lane, ready, checks, gaps };
}

function hasAll(ids: readonly string[], roster: string[]): boolean {
  const set = new Set(roster);
  return ids.every((id) => set.has(id));
}

function summarizeOperationalCertification(
  agents: OperationalCertificationAgent[],
  managers: string[],
  workers: string[]
): OperationalCertificationSummary {
  const readyAgents = agents.filter((agent) => agent.ready).length;
  const initialRosterReady = hasAll(INITIAL_MANAGER_IDS, managers) && hasAll(INITIAL_WORKER_IDS, workers);
  const missionIntakeDryRunReady = hasAll(INITIAL_MANAGER_IDS, managers);
  const handoffDryRunReady = managers.includes("INT-MNG-260311-0004-MARK") && hasAll(INITIAL_WORKER_IDS, workers);

  return {
    totalAgents: agents.length,
    readyAgents,
    failedAgents: agents.length - readyAgents,
    initialRosterReady,
    missionIntakeDryRunReady,
    handoffDryRunReady
  };
}

export function evaluateOperationalCertificationFromRoster(
  managers: string[],
  workers: string[]
): OperationalCertificationReport {
  const agents = [
    ...managers.map((dprId) => buildOperationalCertificationAgent("manager", dprId)),
    ...workers.map((dprId) => buildOperationalCertificationAgent("worker", dprId))
  ];

  return {
    summary: summarizeOperationalCertification(agents, managers, workers),
    agents
  };
}

export function evaluateOperationalCertification(): OperationalCertificationReport {
  const managers = listDprDirectories(INTERNAL_MANAGERS_DIR);
  const workers = listDprDirectories(INTERNAL_WORKERS_DIR);
  return evaluateOperationalCertificationFromRoster(managers, workers);
}

export function resolveIdentityPath(dprId: string): string {
  const isDprLike = /^[A-Z]{3}-[A-Z]{3}-\d{6}-[A-F0-9]{4}-[A-Z0-9-]+$/.test(dprId);
  if (!isDprLike) {
    throw new Error(`Invalid DPR identifier format: ${dprId}`);
  }

  const managerIdentity = join(INTERNAL_MANAGERS_DIR, dprId, "IDENTITY.md");
  if (existsSync(managerIdentity)) {
    return managerIdentity;
  }

  const workerIdentity = join(INTERNAL_WORKERS_DIR, dprId, "IDENTITY.md");
  if (existsSync(workerIdentity)) {
    return workerIdentity;
  }

  throw new Error(`Unknown internal agent DPR identifier: ${dprId}`);
}
