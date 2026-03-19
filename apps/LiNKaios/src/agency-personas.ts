import type { AgentType } from "@linktrend/linklogic";

export const AGENCY_PERSONA_SOURCE_REPO = "https://github.com/linktrend/link-agency-agents";

export type AgencyPersonaTemplate = {
  agentType: AgentType;
  agencyPersonaRef: string;
  sourceRepo: string;
  description: string;
};

export const AGENCY_PERSONA_REGISTRY: Record<AgentType, AgencyPersonaTemplate> = {
  chairman: {
    agentType: "chairman",
    agencyPersonaRef: "agency.chairman",
    sourceRepo: AGENCY_PERSONA_SOURCE_REPO,
    description: "Final governance approvals and mission closeout."
  },
  ceo: {
    agentType: "ceo",
    agencyPersonaRef: "agency.ceo",
    sourceRepo: AGENCY_PERSONA_SOURCE_REPO,
    description: "Mission decomposition, priority triage, and executive escalation."
  },
  cto: {
    agentType: "cto",
    agencyPersonaRef: "agency.cto",
    sourceRepo: AGENCY_PERSONA_SOURCE_REPO,
    description: "Technical governance, architecture quality, and security gates."
  },
  product_owner: {
    agentType: "product_owner",
    agencyPersonaRef: "agency.product_owner",
    sourceRepo: AGENCY_PERSONA_SOURCE_REPO,
    description: "Scope control, acceptance criteria, and requirement precision."
  },
  team_lead: {
    agentType: "team_lead",
    agencyPersonaRef: "agency.team_lead",
    sourceRepo: AGENCY_PERSONA_SOURCE_REPO,
    description: "Task orchestration from management to execution lanes."
  },
  backend_engineer: {
    agentType: "backend_engineer",
    agencyPersonaRef: "agency.backend_engineer",
    sourceRepo: AGENCY_PERSONA_SOURCE_REPO,
    description: "Server-side implementation and integration ownership."
  },
  frontend_engineer: {
    agentType: "frontend_engineer",
    agencyPersonaRef: "agency.frontend_engineer",
    sourceRepo: AGENCY_PERSONA_SOURCE_REPO,
    description: "Frontend implementation and UI integration ownership."
  },
  qa_engineer: {
    agentType: "qa_engineer",
    agencyPersonaRef: "agency.qa_engineer",
    sourceRepo: AGENCY_PERSONA_SOURCE_REPO,
    description: "Validation, regression detection, and release confidence."
  },
  uiux_designer: {
    agentType: "uiux_designer",
    agencyPersonaRef: "agency.uiux_designer",
    sourceRepo: AGENCY_PERSONA_SOURCE_REPO,
    description: "Interaction and visual design quality."
  }
};

export function getAgencyPersonaTemplate(
  agentType: AgentType | undefined
): AgencyPersonaTemplate | undefined {
  if (!agentType) {
    return undefined;
  }
  return AGENCY_PERSONA_REGISTRY[agentType];
}
