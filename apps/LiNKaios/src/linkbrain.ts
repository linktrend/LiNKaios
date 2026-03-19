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
    embedding: number[];
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
}
