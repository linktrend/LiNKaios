import { createClient } from "@supabase/supabase-js";

type Json = Record<string, unknown>;

export type AuditRunRecord = {
  tenant_id: string;
  run_id: string;
  task_id: string;
  dpr_id: string;
  status: string;
  token_usage: number | null;
  command_log: unknown[];
  details: Json;
  created_at: string;
};

export type KnowledgeEntityRecord = {
  id: string;
  tenant_id: string;
  entity_kind: "persona" | "policy" | "guideline" | "guardrail" | "sop";
  content_kind: string;
  scope_kind: "global" | "type" | "role" | "agent_override" | "memory_seed" | "runtime_rules";
  scope_key: string;
  title: string;
  status: "draft" | "review" | "approved" | "published" | "deprecated";
  created_by_agent: string;
  approved_by_agent: string | null;
  metadata: Json;
  published_revision_id: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeRevisionRecord = {
  id: string;
  tenant_id: string;
  entity_id: string;
  revision_number: number;
  status: "draft" | "review" | "approved" | "published" | "deprecated";
  body: string;
  metadata: Json;
  content_hash: string;
  created_by_agent: string;
  approved_by_agent: string | null;
  published_at: string | null;
  rolled_back_from_revision_id: string | null;
  created_at: string;
};

export type PersonaCompiledBundleRecord = {
  id: string;
  tenant_id: string;
  dpr_id: string;
  source_revision_ids: string[];
  bundle: Record<string, string>;
  content_hash: string;
  published_at: string;
  created_by_agent: string;
  created_at: string;
};

export type PersonaAgentSyncStateRecord = {
  id: string;
  tenant_id: string;
  dpr_id: string;
  expected_revision_hash: string | null;
  acknowledged_revision_hash: string | null;
  policy_package: string | null;
  sync_status: "unknown" | "synced" | "drift" | "error";
  sync_metadata: Json;
  last_sync_at: string | null;
  last_ack_at: string | null;
  updated_at: string;
};

export type PolicyDecisionRecord = {
  id: string;
  tenant_id: string;
  run_id: string | null;
  task_id: string | null;
  dpr_id: string;
  policy_package: string | null;
  decision: "allow" | "deny" | "require_approval";
  reason: string;
  destination: string | null;
  tool_name: string | null;
  data_sensitivity: string | null;
  metadata: Json;
  created_at: string;
};

export type KillSwitchStateRecord = {
  id: string;
  tenant_id: string;
  scope: "agent" | "workflow" | "tenant" | "global";
  target_key: string;
  state: "active" | "released";
  reason: string;
  actor_dpr_id: string;
  metadata: Json;
  created_at: string;
};

export type PersonaRevisionAuditRecord = {
  id: string;
  tenant_id: string;
  entity_id: string;
  revision_id: string | null;
  action: "created" | "submitted_review" | "approved" | "published" | "rolled_back";
  actor_dpr_id: string;
  reason: string | null;
  metadata: Json;
  created_at: string;
};

export type AgentModelProfileRecord = {
  id: string;
  tenant_id: string;
  dpr_id: string;
  reasoning_model: string;
  context_model: string;
  execution_model: string;
  review_model: string | null;
  heartbeat_model: string | null;
  dynamic_sequencing: boolean;
  review_required: boolean;
  max_review_loops: number;
  policy_metadata: Json;
  updated_by_agent: string;
  updated_at: string;
};

export class LiNKbrainClient {
  private client;

  constructor(url: string, serviceKey: string) {
    this.client = createClient(url, serviceKey, {
      auth: { persistSession: false }
    });
  }

  async upsertMission(args: {
    tenantId: string;
    missionKey: string;
    goal: string;
    status: string;
    runId: string;
    taskId: string;
    dprId: string;
    embedding: number[] | null;
  }): Promise<void> {
    const { error } = await this.client.rpc("upsert_mission", {
      p_tenant: args.tenantId,
      p_mission_key: args.missionKey,
      p_parent_mission_id: null,
      p_goal: args.goal,
      p_status: args.status,
      p_metadata: { run_id: args.runId, task_id: args.taskId } satisfies Json,
      p_embedding: args.embedding,
      p_created_by_agent: args.dprId
    });

    if (error) {
      throw new Error(`Failed to upsert mission: ${error.message}`);
    }
  }

  async logAuditRun(args: {
    tenantId: string;
    runId: string;
    taskId: string;
    dprId: string;
    status: string;
    tokenUsage?: number;
    commandLog?: unknown[];
    details?: Json;
  }): Promise<void> {
    const { error } = await this.client.rpc("log_audit_run", {
      p_tenant: args.tenantId,
      p_run_id: args.runId,
      p_task_id: args.taskId,
      p_dpr_id: args.dprId,
      p_status: args.status,
      p_token_usage: args.tokenUsage ?? null,
      p_command_log: args.commandLog ?? [],
      p_details: args.details ?? {}
    });

    if (error) {
      throw new Error(`Failed to log audit run: ${error.message}`);
    }
  }

  logAuditRunAsync(args: {
    tenantId: string;
    runId: string;
    taskId: string;
    dprId: string;
    status: string;
    tokenUsage?: number;
    commandLog?: unknown[];
    details?: Json;
  }): void {
    void this.logAuditRun(args).catch((error) => {
      const reason = error instanceof Error ? error.message : "Unknown async audit write failure";
      console.warn("audit_run_async_failed", reason);
    });
  }

  async listAuditRuns(args: {
    tenantId: string;
    runId?: string;
  }): Promise<AuditRunRecord[]> {
    const { data, error } = await this.client.rpc("list_audit_runs", {
      p_tenant: args.tenantId,
      p_run_id: args.runId ?? null
    });

    if (error) {
      throw new Error(`Failed to list audit runs: ${error.message}`);
    }

    return (data ?? []) as AuditRunRecord[];
  }

  async createKnowledgeEntity(args: {
    tenantId: string;
    entityKind: KnowledgeEntityRecord["entity_kind"];
    contentKind: string;
    scopeKind: KnowledgeEntityRecord["scope_kind"];
    scopeKey: string;
    title: string;
    status?: KnowledgeEntityRecord["status"];
    createdByAgent: string;
    metadata?: Json;
  }): Promise<KnowledgeEntityRecord> {
    const { data, error } = await this.client.rpc("create_knowledge_entity", {
      p_tenant: args.tenantId,
      p_entity_kind: args.entityKind,
      p_content_kind: args.contentKind,
      p_scope_kind: args.scopeKind,
      p_scope_key: args.scopeKey,
      p_title: args.title,
      p_status: args.status ?? "draft",
      p_created_by_agent: args.createdByAgent,
      p_metadata: args.metadata ?? {}
    });

    if (error) {
      throw new Error(`Failed to create knowledge entity: ${error.message}`);
    }

    return data as KnowledgeEntityRecord;
  }

  async createKnowledgeRevision(args: {
    tenantId: string;
    entityId: string;
    status?: KnowledgeRevisionRecord["status"];
    body: string;
    metadata?: Json;
    contentHash: string;
    createdByAgent: string;
    rolledBackFromRevisionId?: string | null;
  }): Promise<KnowledgeRevisionRecord> {
    const { data, error } = await this.client.rpc("create_knowledge_revision", {
      p_tenant: args.tenantId,
      p_entity_id: args.entityId,
      p_status: args.status ?? "draft",
      p_body: args.body,
      p_metadata: args.metadata ?? {},
      p_content_hash: args.contentHash,
      p_created_by_agent: args.createdByAgent,
      p_rolled_back_from_revision_id: args.rolledBackFromRevisionId ?? null
    });

    if (error) {
      throw new Error(`Failed to create knowledge revision: ${error.message}`);
    }

    return data as KnowledgeRevisionRecord;
  }

  async publishKnowledgeRevision(args: {
    tenantId: string;
    entityId: string;
    revisionId: string;
    actorDprId: string;
    reason?: string;
  }): Promise<KnowledgeRevisionRecord> {
    const { data, error } = await this.client.rpc("publish_knowledge_revision", {
      p_tenant: args.tenantId,
      p_entity_id: args.entityId,
      p_revision_id: args.revisionId,
      p_actor_dpr_id: args.actorDprId,
      p_reason: args.reason ?? null
    });

    if (error) {
      throw new Error(`Failed to publish knowledge revision: ${error.message}`);
    }

    return data as KnowledgeRevisionRecord;
  }

  async rollbackKnowledgeEntity(args: {
    tenantId: string;
    entityId: string;
    targetRevisionId: string;
    actorDprId: string;
    reason: string;
  }): Promise<KnowledgeRevisionRecord> {
    const { data, error } = await this.client.rpc("rollback_knowledge_entity", {
      p_tenant: args.tenantId,
      p_entity_id: args.entityId,
      p_target_revision_id: args.targetRevisionId,
      p_actor_dpr_id: args.actorDprId,
      p_reason: args.reason
    });

    if (error) {
      throw new Error(`Failed to rollback knowledge entity: ${error.message}`);
    }

    return data as KnowledgeRevisionRecord;
  }

  async listKnowledgeEntities(args: {
    tenantId: string;
    entityKind?: KnowledgeEntityRecord["entity_kind"];
  }): Promise<KnowledgeEntityRecord[]> {
    const { data, error } = await this.client.rpc("list_knowledge_entities", {
      p_tenant: args.tenantId,
      p_entity_kind: args.entityKind ?? null
    });

    if (error) {
      throw new Error(`Failed to list knowledge entities: ${error.message}`);
    }

    return (data ?? []) as KnowledgeEntityRecord[];
  }

  async listKnowledgeRevisions(args: {
    tenantId: string;
    entityId?: string;
  }): Promise<KnowledgeRevisionRecord[]> {
    const { data, error } = await this.client.rpc("list_knowledge_revisions", {
      p_tenant: args.tenantId,
      p_entity_id: args.entityId ?? null
    });

    if (error) {
      throw new Error(`Failed to list knowledge revisions: ${error.message}`);
    }

    return (data ?? []) as KnowledgeRevisionRecord[];
  }

  async upsertPersonaCompiledBundle(args: {
    tenantId: string;
    dprId: string;
    sourceRevisionIds: string[];
    bundle: Record<string, string>;
    contentHash: string;
    createdByAgent: string;
    publishedAt?: string;
  }): Promise<PersonaCompiledBundleRecord> {
    const { data, error } = await this.client.rpc("upsert_persona_compiled_bundle", {
      p_tenant: args.tenantId,
      p_dpr_id: args.dprId,
      p_source_revision_ids: args.sourceRevisionIds,
      p_bundle: args.bundle,
      p_content_hash: args.contentHash,
      p_created_by_agent: args.createdByAgent,
      p_published_at: args.publishedAt ?? new Date().toISOString()
    });

    if (error) {
      throw new Error(`Failed to upsert persona compiled bundle: ${error.message}`);
    }

    return data as PersonaCompiledBundleRecord;
  }

  async getLatestPersonaBundle(args: {
    tenantId: string;
    dprId: string;
  }): Promise<PersonaCompiledBundleRecord | null> {
    const { data, error } = await this.client.rpc("get_latest_persona_bundle", {
      p_tenant: args.tenantId,
      p_dpr_id: args.dprId
    });

    if (error) {
      throw new Error(`Failed to fetch persona bundle: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return data as PersonaCompiledBundleRecord;
  }

  async upsertPersonaAgentSyncState(args: {
    tenantId: string;
    dprId: string;
    expectedRevisionHash?: string | null;
    acknowledgedRevisionHash?: string | null;
    policyPackage?: string | null;
    syncStatus: PersonaAgentSyncStateRecord["sync_status"];
    syncMetadata?: Json;
    lastSyncAt?: string | null;
    lastAckAt?: string | null;
  }): Promise<PersonaAgentSyncStateRecord> {
    const { data, error } = await this.client.rpc("upsert_persona_agent_sync_state", {
      p_tenant: args.tenantId,
      p_dpr_id: args.dprId,
      p_expected_revision_hash: args.expectedRevisionHash ?? null,
      p_acknowledged_revision_hash: args.acknowledgedRevisionHash ?? null,
      p_policy_package: args.policyPackage ?? null,
      p_sync_status: args.syncStatus,
      p_sync_metadata: args.syncMetadata ?? {},
      p_last_sync_at: args.lastSyncAt ?? null,
      p_last_ack_at: args.lastAckAt ?? null
    });

    if (error) {
      throw new Error(`Failed to upsert persona sync state: ${error.message}`);
    }

    return data as PersonaAgentSyncStateRecord;
  }

  async listPersonaAgentSyncState(args: {
    tenantId: string;
    dprId?: string;
  }): Promise<PersonaAgentSyncStateRecord[]> {
    const { data, error } = await this.client.rpc("list_persona_agent_sync_state", {
      p_tenant: args.tenantId,
      p_dpr_id: args.dprId ?? null
    });

    if (error) {
      throw new Error(`Failed to list persona sync state: ${error.message}`);
    }

    return (data ?? []) as PersonaAgentSyncStateRecord[];
  }

  async logPolicyDecision(args: {
    tenantId: string;
    runId?: string;
    taskId?: string;
    dprId: string;
    policyPackage?: string;
    decision: PolicyDecisionRecord["decision"];
    reason: string;
    destination?: string;
    toolName?: string;
    dataSensitivity?: string;
    metadata?: Json;
  }): Promise<PolicyDecisionRecord> {
    const { data, error } = await this.client.rpc("log_policy_decision", {
      p_tenant: args.tenantId,
      p_run_id: args.runId ?? null,
      p_task_id: args.taskId ?? null,
      p_dpr_id: args.dprId,
      p_policy_package: args.policyPackage ?? null,
      p_decision: args.decision,
      p_reason: args.reason,
      p_destination: args.destination ?? null,
      p_tool_name: args.toolName ?? null,
      p_data_sensitivity: args.dataSensitivity ?? null,
      p_metadata: args.metadata ?? {}
    });

    if (error) {
      throw new Error(`Failed to log policy decision: ${error.message}`);
    }

    return data as PolicyDecisionRecord;
  }

  async setKillSwitchState(args: {
    tenantId: string;
    scope: KillSwitchStateRecord["scope"];
    targetKey: string;
    state: KillSwitchStateRecord["state"];
    reason: string;
    actorDprId: string;
    metadata?: Json;
  }): Promise<KillSwitchStateRecord> {
    const { data, error } = await this.client.rpc("set_kill_switch_state", {
      p_tenant: args.tenantId,
      p_scope: args.scope,
      p_target_key: args.targetKey,
      p_state: args.state,
      p_reason: args.reason,
      p_actor_dpr_id: args.actorDprId,
      p_metadata: args.metadata ?? {}
    });

    if (error) {
      throw new Error(`Failed to set kill switch state: ${error.message}`);
    }

    return data as KillSwitchStateRecord;
  }

  async listPersonaRevisionAudit(args: {
    tenantId: string;
    entityId?: string;
  }): Promise<PersonaRevisionAuditRecord[]> {
    const { data, error } = await this.client.rpc("list_persona_revision_audit", {
      p_tenant: args.tenantId,
      p_entity_id: args.entityId ?? null
    });

    if (error) {
      throw new Error(`Failed to list persona revision audit: ${error.message}`);
    }

    return (data ?? []) as PersonaRevisionAuditRecord[];
  }

  async upsertAgentModelProfile(args: {
    tenantId: string;
    dprId: string;
    reasoningModel: string;
    contextModel: string;
    executionModel: string;
    reviewModel?: string;
    heartbeatModel?: string;
    dynamicSequencing: boolean;
    reviewRequired: boolean;
    maxReviewLoops: number;
    policyMetadata?: Json;
    updatedByAgent: string;
  }): Promise<AgentModelProfileRecord> {
    const { data, error } = await this.client.rpc("upsert_agent_model_profile", {
      p_tenant: args.tenantId,
      p_dpr_id: args.dprId,
      p_reasoning_model: args.reasoningModel,
      p_context_model: args.contextModel,
      p_execution_model: args.executionModel,
      p_review_model: args.reviewModel ?? null,
      p_heartbeat_model: args.heartbeatModel ?? null,
      p_dynamic_sequencing: args.dynamicSequencing,
      p_review_required: args.reviewRequired,
      p_max_review_loops: args.maxReviewLoops,
      p_policy_metadata: args.policyMetadata ?? {},
      p_updated_by_agent: args.updatedByAgent
    });

    if (error) {
      throw new Error(`Failed to upsert agent model profile: ${error.message}`);
    }

    return data as AgentModelProfileRecord;
  }

  async getAgentModelProfile(args: {
    tenantId: string;
    dprId: string;
  }): Promise<AgentModelProfileRecord | null> {
    const { data, error } = await this.client.rpc("get_agent_model_profile", {
      p_tenant: args.tenantId,
      p_dpr_id: args.dprId
    });

    if (error) {
      throw new Error(`Failed to fetch agent model profile: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return data as AgentModelProfileRecord;
  }
}
