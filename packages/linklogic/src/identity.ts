import { readFileSync } from "node:fs";

export type AgentType =
  | "chairman"
  | "ceo"
  | "cto"
  | "product_owner"
  | "team_lead"
  | "backend_engineer"
  | "frontend_engineer"
  | "qa_engineer"
  | "uiux_designer";

export type IdentityMetadata = {
  dprId: string;
  tenantId: string;
  functionalBaseline?: string;
  currentRole?: string;
  agentType?: AgentType;
  agencyPersonaRef?: string;
  personaVersion?: string;
  personaSourceRepo?: string;
  personaFingerprint?: string;
};

const KNOWN_AGENT_TYPES = new Set<AgentType>([
  "chairman",
  "ceo",
  "cto",
  "product_owner",
  "team_lead",
  "backend_engineer",
  "frontend_engineer",
  "qa_engineer",
  "uiux_designer"
]);

const AGENT_TYPE_ALIASES: Record<string, AgentType> = {
  backend_developer: "backend_engineer",
  frontend_developer: "frontend_engineer",
  qa: "qa_engineer",
  qa_tester: "qa_engineer",
  ui_ux_designer: "uiux_designer",
  uiux_designer: "uiux_designer",
  ux_designer: "uiux_designer",
  visual_designer: "uiux_designer",
  product_owner: "product_owner",
  team_lead: "team_lead"
};

const ROLE_TO_AGENT_TYPE: Record<string, AgentType> = {
  chairman: "chairman",
  "studio ceo": "ceo",
  ceo: "ceo",
  "studio cto": "cto",
  cto: "cto",
  "product owner": "product_owner",
  "team lead": "team_lead",
  "backend developer": "backend_engineer",
  "frontend developer": "frontend_engineer",
  "qa engineer": "qa_engineer",
  "ui/ux designer": "uiux_designer",
  "ui ux designer": "uiux_designer"
};

function parseIdentityField(content: string, key: string): string | null {
  const pattern = new RegExp(`^${key}:\\s*"?([^"\\n]+)"?$`, "im");
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

function parseAnyIdentityField(content: string, keys: string[]): string | null {
  for (const key of keys) {
    const value = parseIdentityField(content, key);
    if (value) {
      return value;
    }
  }
  return null;
}

function normalizeAgentType(raw: string): AgentType | undefined {
  const normalized = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const aliased = AGENT_TYPE_ALIASES[normalized] ?? normalized;
  if (KNOWN_AGENT_TYPES.has(aliased as AgentType)) {
    return aliased as AgentType;
  }
  return undefined;
}

export function inferAgentType(currentRole: string | undefined): AgentType | undefined {
  if (!currentRole) {
    return undefined;
  }
  return ROLE_TO_AGENT_TYPE[currentRole.trim().toLowerCase()];
}

export function parseIdentityMetadata(identityPath: string): IdentityMetadata {
  const content = readFileSync(identityPath, "utf8");

  const dprId = parseAnyIdentityField(content, ["dpr_id", "DPR_ID"]);
  const tenantId = parseAnyIdentityField(content, [
    "authorized_tenant_id",
    "AUTHORIZED_TENANT_ID",
    "tenant_id",
    "TENANT_ID"
  ]);
  const functionalBaseline = parseAnyIdentityField(content, ["functional_baseline", "FUNCTIONAL_BASELINE"]);
  const currentRole = parseAnyIdentityField(content, ["current_role", "CURRENT_ROLE"]);
  const agentType =
    normalizeAgentType(parseAnyIdentityField(content, ["agent_type", "AGENT_TYPE"]) ?? "") ??
    inferAgentType(currentRole ?? undefined);
  const agencyPersonaRef = parseAnyIdentityField(content, ["agency_persona_ref", "AGENCY_PERSONA_REF"]);
  const personaVersion = parseAnyIdentityField(content, ["persona_version", "PERSONA_VERSION"]);
  const personaSourceRepo = parseAnyIdentityField(content, ["persona_source_repo", "PERSONA_SOURCE_REPO"]);
  const personaFingerprint = parseAnyIdentityField(content, [
    "persona_fingerprint",
    "PERSONA_FINGERPRINT"
  ]);

  if (!dprId) {
    throw new Error(`IDENTITY.md missing dpr_id in ${identityPath}`);
  }

  if (!tenantId) {
    throw new Error(`IDENTITY.md missing authorized_tenant_id in ${identityPath}`);
  }

  const metadata: IdentityMetadata = { dprId, tenantId };
  if (functionalBaseline) {
    metadata.functionalBaseline = functionalBaseline;
  }
  if (currentRole) {
    metadata.currentRole = currentRole;
  }
  if (agentType) {
    metadata.agentType = agentType;
  }
  if (agencyPersonaRef) {
    metadata.agencyPersonaRef = agencyPersonaRef;
  }
  if (personaVersion) {
    metadata.personaVersion = personaVersion;
  }
  if (personaSourceRepo) {
    metadata.personaSourceRepo = personaSourceRepo;
  }
  if (personaFingerprint) {
    metadata.personaFingerprint = personaFingerprint;
  }

  return metadata;
}

export function parseIdentityTenant(identityPath: string): string {
  return parseIdentityMetadata(identityPath).tenantId;
}

export function parseIdentityDpr(identityPath: string): string {
  return parseIdentityMetadata(identityPath).dprId;
}
