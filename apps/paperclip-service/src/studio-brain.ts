import { createClient } from "@supabase/supabase-js";

type Json = Record<string, unknown>;

export class StudioBrainClient {
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
    agentId: string;
    embedding: number[];
  }): Promise<void> {
    await this.withTenant(args.tenantId, async () => {
      const { error } = await this.client.rpc("upsert_mission", {
        p_mission_key: args.missionKey,
        p_parent_mission_id: null,
        p_goal: args.goal,
        p_status: args.status,
        p_metadata: { run_id: args.runId, task_id: args.taskId } satisfies Json,
        p_embedding: args.embedding,
        p_created_by_agent: args.agentId
      });

      if (error) {
        throw new Error(`Failed to upsert mission: ${error.message}`);
      }
    });
  }

  async logAuditRun(args: {
    tenantId: string;
    runId: string;
    taskId: string;
    agentId: string;
    status: string;
    tokenUsage?: number;
    details?: Json;
  }): Promise<void> {
    await this.withTenant(args.tenantId, async () => {
      const { error } = await this.client.rpc("log_audit_run", {
        p_run_id: args.runId,
        p_task_id: args.taskId,
        p_agent_id: args.agentId,
        p_status: args.status,
        p_token_usage: args.tokenUsage ?? null,
        p_command_log: [],
        p_details: args.details ?? {}
      });

      if (error) {
        throw new Error(`Failed to log audit run: ${error.message}`);
      }
    });
  }

  private async withTenant(tenantId: string, fn: () => Promise<void>): Promise<void> {
    const { error } = await this.client.rpc("set_tenant_context", {
      p_tenant: tenantId
    });

    if (error) {
      throw new Error(`Failed to set tenant context: ${error.message}`);
    }

    await fn();
  }
}
