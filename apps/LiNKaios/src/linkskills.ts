import {
  LiNKskillsManagedRunRequestSchema,
  LiNKskillsManagedRunResultSchema,
  type LiNKskillsManagedRunRequest,
  type LiNKskillsManagedRunResult
} from "@linktrend/linkskills";
import { z, type ZodType } from "zod";

const CreateRunResponseSchema = z.object({
  run_id: z.string().min(3),
  status: z.string().min(3),
  next_action: z.string().optional()
});

const IssueDisclosureResponseSchema = z.object({
  receipt_id: z.string().min(3).optional(),
  manifest_ref: z.string().min(3).optional(),
  expires_at: z.string().datetime().optional(),
  run_status: z.string().min(3).optional()
});

const RunLookupSchema = z.object({
  status: z.string().min(3),
  receipt_id: z.string().min(3).optional(),
  manifest_ref: z.string().min(3).optional(),
  expires_at: z.string().datetime().optional()
});

const ReceiptLookupSchema = z.object({
  receipt_id: z.string().min(3),
  manifest_ref: z.string().min(3).optional(),
  expires_at: z.string().datetime().optional()
});

export type LiNKskillsBridge = {
  enabled: boolean;
  executeManagedRun(input: LiNKskillsManagedRunRequest): Promise<LiNKskillsManagedRunResult>;
};

const TERMINAL_RUN_STATUSES = new Set(["completed", "failed", "rejected", "cancelled", "terminated"]);
const RUN_POLL_INTERVAL_MS = 1000;
const RUN_POLL_TIMEOUT_MS = 15000;

class DisabledLiNKskillsBridge implements LiNKskillsBridge {
  enabled = false;

  async executeManagedRun(_input: LiNKskillsManagedRunRequest): Promise<LiNKskillsManagedRunResult> {
    throw new Error("LiNKskills API is not configured");
  }
}

class HttpLiNKskillsBridge implements LiNKskillsBridge {
  enabled = true;

  constructor(
    private readonly baseUrl: string,
    private readonly apiToken: string,
    private readonly principalId: string,
    private readonly billingTrack: "track_1" | "track_2",
    private readonly ventureId?: string,
    private readonly clientId?: string
  ) {}

  async executeManagedRun(input: LiNKskillsManagedRunRequest): Promise<LiNKskillsManagedRunResult> {
    const payload = LiNKskillsManagedRunRequestSchema.parse(input);
    const idempotencyKey = [
      payload.tenantId,
      payload.missionId,
      payload.runId,
      payload.taskId,
      payload.dprId,
      payload.capabilityId ?? payload.packageId,
      payload.stepScope ?? "phase.execute"
    ].join(":");

    const createRun = await this.requestJson(
      "/v1/runs",
      {
        method: "POST",
        headers: { "x-idempotency-key": idempotencyKey },
        body: JSON.stringify({
          tenant_id: payload.tenantId,
          principal_id: this.principalId,
          mission_id: payload.missionId,
          run_id: payload.runId,
          task_id: payload.taskId,
          dpr_id: payload.dprId,
          idempotency_key: idempotencyKey,
          capability_id: payload.capabilityId,
          package_id: payload.packageId,
          version: payload.version,
          input_payload: payload.inputPayload,
          context_refs: payload.contextRefs,
          mode: "MANAGED",
          origin: "AIOS",
          billing_track: this.billingTrack,
          venture_id: this.billingTrack === "track_1" ? this.ventureId : undefined,
          client_id: this.billingTrack === "track_2" ? this.clientId : undefined
        })
      },
      CreateRunResponseSchema
    );

    const disclosure = await this.requestJson(
      "/v1/disclosures/issue",
      {
        method: "POST",
        headers: { "x-idempotency-key": `${idempotencyKey}:disclosure` },
        body: JSON.stringify({
          run_id: createRun.run_id,
          step_scope: payload.stepScope ?? "phase.execute",
          idempotency_key: `${idempotencyKey}:disclosure`
        })
      },
      IssueDisclosureResponseSchema
    );

    let finalStatus = disclosure.run_status ?? createRun.status;
    if (!isTerminalStatus(finalStatus)) {
      finalStatus = await this.pollRunStatus(createRun.run_id, finalStatus);
    }

    const finalRun = await this.requestJson(
      `/v1/runs/${encodeURIComponent(createRun.run_id)}`,
      { method: "GET" },
      RunLookupSchema
    );
    finalStatus = finalRun.status ?? finalStatus;

    const receiptId = disclosure.receipt_id ?? finalRun.receipt_id;
    const receipt = receiptId
      ? await this.requestJson(
          `/v1/receipts/${encodeURIComponent(receiptId)}`,
          { method: "GET" },
          ReceiptLookupSchema
        )
      : null;

    return LiNKskillsManagedRunResultSchema.parse({
      linkskillsRunId: createRun.run_id,
      runStatus: finalStatus,
      receiptId: receipt?.receipt_id ?? receiptId ?? `pending-${createRun.run_id}`,
      manifestRef:
        receipt?.manifest_ref ??
        disclosure.manifest_ref ??
        finalRun.manifest_ref ??
        `manifest-${createRun.run_id}`,
      expiresAt:
        receipt?.expires_at ??
        disclosure.expires_at ??
        finalRun.expires_at ??
        new Date(Date.now() + 15 * 60 * 1000).toISOString()
    });
  }

  private async requestJson<T>(path: string, init: RequestInit, schema: ZodType<T>): Promise<T> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...(this.apiToken ? { authorization: `Bearer ${this.apiToken}` } : {})
    };

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...headers,
        ...(init.headers as Record<string, string> | undefined)
      }
    });

    const text = await response.text();
    let payload: unknown = {};
    if (text.length > 0) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { detail: text };
      }
    }

    if (!response.ok) {
      const reason =
        typeof (payload as { detail?: unknown })?.detail === "string"
          ? String((payload as { detail: string }).detail)
          : `LiNKskills request failed with ${response.status}`;
      throw new Error(reason);
    }

    return schema.parse(payload);
  }

  private async pollRunStatus(runId: string, initialStatus: string): Promise<string> {
    let status = initialStatus;
    const timeoutAt = Date.now() + RUN_POLL_TIMEOUT_MS;

    while (!isTerminalStatus(status) && Date.now() < timeoutAt) {
      await sleep(RUN_POLL_INTERVAL_MS);
      const run = await this.requestJson(
        `/v1/runs/${encodeURIComponent(runId)}`,
        { method: "GET" },
        RunLookupSchema
      );
      status = run.status;
    }

    return status;
  }
}

export function createLiNKskillsBridge(config: {
  apiUrl?: string;
  apiToken?: string;
  principalId?: string;
  billingTrack?: "track_1" | "track_2";
  ventureId?: string;
  clientId?: string;
}): LiNKskillsBridge {
  if (!config.apiUrl || !config.apiToken || !config.principalId) {
    return new DisabledLiNKskillsBridge();
  }

  return new HttpLiNKskillsBridge(
    config.apiUrl,
    config.apiToken,
    config.principalId,
    config.billingTrack ?? "track_1",
    config.ventureId,
    config.clientId
  );
}

function isTerminalStatus(status: string): boolean {
  return TERMINAL_RUN_STATUSES.has(status.toLowerCase());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
