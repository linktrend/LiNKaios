import { describe, expect, it } from "vitest";
import {
  AiosEventEnvelopeSchema,
  ApprovalDecisionSchema,
  LiNKskillsManagedRunRequestSchema,
  LiNKskillsManagedRunResultSchema,
  MissionPayloadSchema,
  MissionStatusSchema,
  PromotionCandidateSchema,
  SlackStatusCardSchema
} from "../src/contracts.js";

describe("linkskills contracts", () => {
  it("accepts only supported mission statuses", () => {
    expect(MissionStatusSchema.safeParse("active").success).toBe(true);
    expect(MissionStatusSchema.safeParse("complete").success).toBe(false);
  });

  it("rejects mission payloads without tenant context", () => {
    const parsed = MissionPayloadSchema.safeParse({
      missionId: "5bb916ec-8f53-4424-b9fa-9969f1ab384f",
      goal: "Ship MVO",
      status: "active",
      runId: "run_20260311T000001",
      taskId: "task-123456",
      dprId: "INT-MNG-260311-0001-LISA"
    });

    expect(parsed.success).toBe(false);
  });

  it("enforces promotion confidence boundaries", () => {
    const parsed = PromotionCandidateSchema.safeParse({
      tenantId: "5bb916ec-8f53-4424-b9fa-9969f1ab384f",
      sourceEntryId: "e8eb6adc-8dad-4d1e-8f84-00d23fc854c8",
      lessonTitle: "Queue retries after provider timeout",
      lessonBody: "Use retry with exponential backoff and idempotency keys.",
      confidence: 1.2,
      runId: "run_20260311T000001",
      dprId: "INT-EXE-260311-0006-KATE"
    });

    expect(parsed.success).toBe(false);
  });

  it("validates canonical AIOS event envelope metadata", () => {
    const parsed = AiosEventEnvelopeSchema.safeParse({
      eventId: "6f0458f6-4e8b-4662-a03c-0c1da3267f56",
      eventType: "aios.task.handoff",
      occurredAt: "2026-03-17T00:00:00.000Z",
      schemaVersion: "1.0",
      tenantId: "5bb916ec-8f53-4424-b9fa-9969f1ab384f",
      missionId: "5bb916ec-8f53-4424-b9fa-9969f1ab384f",
      runId: "LT-ALPHA-001",
      taskId: "TASK-001",
      fromDprId: "INT-MNG-260311-0004-MARK",
      toDprId: "INT-EXE-260311-0004-SARAH",
      correlationId: "corr-001",
      idempotencyKey: "idem-001",
      payload: { summary: "handoff" }
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects approval decisions without valid state", () => {
    const parsed = ApprovalDecisionSchema.safeParse({
      approvalId: "89da1f0d-672d-4d74-880f-75b5980b5cf8",
      tenantId: "5bb916ec-8f53-4424-b9fa-9969f1ab384f",
      missionId: "5bb916ec-8f53-4424-b9fa-9969f1ab384f",
      runId: "LT-ALPHA-001",
      taskId: "TASK-001",
      requestedByDprId: "INT-MNG-260311-0002-ERIC",
      decisionByDprId: "INT-MNG-260311-0001-LISA",
      state: "finalized",
      reason: "approved",
      decidedAt: "2026-03-17T00:00:00.000Z"
    });

    expect(parsed.success).toBe(false);
  });

  it("validates Slack status card payload", () => {
    const parsed = SlackStatusCardSchema.safeParse({
      tenantId: "5bb916ec-8f53-4424-b9fa-9969f1ab384f",
      runId: "LT-ALPHA-001",
      taskId: "TASK-001",
      eventType: "aios.task.assigned",
      fromDprId: "INT-MNG-260311-0004-MARK",
      toDprId: "INT-EXE-260311-0005-MIKE",
      summary: "Task assigned to FE"
    });

    expect(parsed.success).toBe(true);
  });

  it("requires exactly one managed run target", () => {
    const parsed = LiNKskillsManagedRunRequestSchema.safeParse({
      tenantId: "5bb916ec-8f53-4424-b9fa-9969f1ab384f",
      missionId: "5bb916ec-8f53-4424-b9fa-9969f1ab384f",
      runId: "LT-ALPHA-001",
      taskId: "TASK-001",
      dprId: "INT-MNG-260311-0004-MARK",
      capabilityId: "lead-engineer",
      packageId: "studio-release"
    });

    expect(parsed.success).toBe(false);
  });

  it("validates managed run result payload", () => {
    const parsed = LiNKskillsManagedRunResultSchema.safeParse({
      linkskillsRunId: "run-0ad2f2196f0b",
      runStatus: "completed",
      receiptId: "rcpt-0ad2f2196f0b",
      manifestRef: "manifest-run-0ad2f2196f0b",
      expiresAt: "2026-03-17T00:00:00.000Z"
    });

    expect(parsed.success).toBe(true);
  });
});
