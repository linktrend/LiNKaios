import { z } from "zod";

export const ModelRoleSchema = z.enum(["reasoning", "context", "execution", "review"]);

export const AgentModelProfileSchema = z.object({
  tenantId: z.string().uuid(),
  dprId: z.string().min(3),
  reasoningModel: z.string().min(3),
  contextModel: z.string().min(3),
  executionModel: z.string().min(3),
  reviewModel: z.string().min(3).optional(),
  heartbeatModel: z.string().min(3).optional(),
  dynamicSequencing: z.boolean().default(true),
  reviewRequired: z.boolean().default(true),
  maxReviewLoops: z.number().int().min(0).max(5).default(1),
  policyMetadata: z.record(z.unknown()).default({})
});

export const TaskOrchestrationInputSchema = z.object({
  taskPrompt: z.string().min(1),
  contextRefs: z.array(z.string().min(1)).default([]),
  metadata: z.record(z.unknown()).default({})
});

export type AgentModelProfile = z.infer<typeof AgentModelProfileSchema>;
export type TaskOrchestrationInput = z.infer<typeof TaskOrchestrationInputSchema>;

export type OrchestrationPhase = {
  role: z.infer<typeof ModelRoleSchema>;
  model: string;
  objective: string;
};

export type OrchestrationPlan = {
  sequence: OrchestrationPhase[];
  reviewLoop: {
    enabled: boolean;
    maxLoops: number;
    reviewerModel: string;
    escalationRule: string;
  };
  decision: {
    includeContextPhase: boolean;
    reason: string;
  };
};

const CONTEXT_HINT_TERMS = [
  "review",
  "analyze",
  "analyse",
  "read",
  "document",
  "contract",
  "policy",
  "summar",
  "compare",
  "context",
  "evidence",
  "trace"
];

const EXECUTION_ONLY_HINT_TERMS = ["quick", "simple", "direct", "just do", "execute now"];

function inferContextNeed(input: TaskOrchestrationInput): { includeContextPhase: boolean; reason: string } {
  const lower = input.taskPrompt.toLowerCase();
  if (input.contextRefs.length > 0) {
    return {
      includeContextPhase: true,
      reason: "Context references were provided, so context ingestion is required before execution."
    };
  }

  if (CONTEXT_HINT_TERMS.some((term) => lower.includes(term))) {
    return {
      includeContextPhase: true,
      reason: "Task wording indicates analysis/review needs; context phase enabled."
    };
  }

  if (EXECUTION_ONLY_HINT_TERMS.some((term) => lower.includes(term))) {
    return {
      includeContextPhase: false,
      reason: "Task appears direct and low-context; skipping context phase."
    };
  }

  return {
    includeContextPhase: true,
    reason: "Default safety policy keeps context phase enabled unless task is clearly execution-only."
  };
}

export function buildDynamicOrchestrationPlan(
  profileInput: AgentModelProfile,
  taskInput: TaskOrchestrationInput
): OrchestrationPlan {
  const profile = AgentModelProfileSchema.parse(profileInput);
  const task = TaskOrchestrationInputSchema.parse(taskInput);

  const decision = inferContextNeed(task);
  const sequence: OrchestrationPhase[] = [
    {
      role: "reasoning",
      model: profile.reasoningModel,
      objective: "Reason about task intent, constraints, and phase order."
    }
  ];

  if (profile.dynamicSequencing && decision.includeContextPhase) {
    sequence.push({
      role: "context",
      model: profile.contextModel,
      objective: "Ingest and structure task context required by the reasoning step."
    });
  }

  sequence.push({
    role: "execution",
    model: profile.executionModel,
    objective: "Execute deterministic output generation and task actions."
  });

  if (profile.reviewRequired) {
    sequence.push({
      role: "review",
      model: profile.reviewModel ?? profile.reasoningModel,
      objective: "Validate execution output against original intent and quality criteria."
    });
  }

  return {
    sequence,
    reviewLoop: {
      enabled: profile.reviewRequired,
      maxLoops: profile.reviewRequired ? profile.maxReviewLoops : 0,
      reviewerModel: profile.reviewModel ?? profile.reasoningModel,
      escalationRule:
        "If review fails after max loops, escalate with explicit failure reasons and attempted remediations."
    },
    decision
  };
}
