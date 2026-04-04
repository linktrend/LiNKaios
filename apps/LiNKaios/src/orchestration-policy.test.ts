import { describe, expect, it } from "vitest";
import { buildDynamicOrchestrationPlan } from "./orchestration-policy.js";

const lisaProfile = {
  tenantId: "00000000-0000-0000-0000-000000000001",
  dprId: "INT-MNG-260311-0001-LISA",
  reasoningModel: "moonshot/kimi-k2.5",
  contextModel: "google/gemini-1.5-pro",
  executionModel: "openai/gpt-4o-mini",
  reviewModel: "moonshot/kimi-k2.5",
  dynamicSequencing: true,
  reviewRequired: true,
  maxReviewLoops: 2,
  policyMetadata: {}
} as const;

describe("dynamic orchestration policy", () => {
  it("keeps context phase when context refs are present", () => {
    const plan = buildDynamicOrchestrationPlan(lisaProfile, {
      taskPrompt: "Review the attached contract and extract key obligations",
      contextRefs: ["doc://contract-1"],
      metadata: {}
    });

    expect(plan.sequence.map((phase) => phase.role)).toEqual(["reasoning", "context", "execution", "review"]);
    expect(plan.sequence[0]?.model).toBe("moonshot/kimi-k2.5");
    expect(plan.sequence[1]?.model).toBe("google/gemini-1.5-pro");
    expect(plan.sequence[2]?.model).toBe("openai/gpt-4o-mini");
    expect(plan.reviewLoop.maxLoops).toBe(2);
  });

  it("skips context phase for direct execution prompts", () => {
    const plan = buildDynamicOrchestrationPlan(lisaProfile, {
      taskPrompt: "Execute now: send quick status update",
      contextRefs: [],
      metadata: {}
    });

    expect(plan.sequence.map((phase) => phase.role)).toEqual(["reasoning", "execution", "review"]);
    expect(plan.decision.includeContextPhase).toBe(false);
  });
});
