import { describe, expect, it } from "vitest";
import {
  MissionPayloadSchema,
  MissionStatusSchema,
  PromotionCandidateSchema
} from "../src/contracts.js";

describe("interfaces contracts", () => {
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
      agentId: "ceo",
      identityPath: "agents/managers/ceo/IDENTITY.md"
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
      agentId: "qa"
    });

    expect(parsed.success).toBe(false);
  });
});
