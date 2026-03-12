import { z } from "zod";

export const MissionStatusSchema = z.enum([
  "active",
  "paused",
  "handover_pending",
  "archived"
]);

export const MissionPayloadSchema = z.object({
  missionId: z.string().uuid(),
  tenantId: z.string().uuid(),
  dprId: z.string().min(8),
  goal: z.string().min(1),
  parentGoalId: z.string().uuid().nullable().default(null),
  status: MissionStatusSchema,
  runId: z.string().min(12),
  taskId: z.string().min(8)
});

export const SecurityExceptionSchema = z.object({
  runId: z.string().min(12),
  taskId: z.string().min(8),
  dprId: z.string().min(8),
  tenantId: z.string().uuid(),
  reason: z.string().min(10),
  severity: z.enum(["critical", "high", "medium"])
});

export const PromotionCandidateSchema = z.object({
  tenantId: z.string().uuid(),
  sourceEntryId: z.string().uuid(),
  lessonTitle: z.string().min(5),
  lessonBody: z.string().min(20),
  confidence: z.number().min(0).max(1),
  runId: z.string().min(12),
  dprId: z.string().min(8)
});

export const LiNKSkillFragmentSchema = z.object({
  tenantId: z.string().uuid(),
  skillId: z.string().min(3),
  fragmentVersion: z.string().min(1),
  input: z.record(z.unknown()),
  requestedByAgentId: z.string().min(3)
});

export const LiNKSkillResultSchema = z.object({
  executionId: z.string().min(8),
  success: z.boolean(),
  output: z.record(z.unknown()),
  latencyMs: z.number().int().nonnegative(),
  source: z.enum(["api", "mcp"])
});

export type MissionStatus = z.infer<typeof MissionStatusSchema>;
export type MissionPayload = z.infer<typeof MissionPayloadSchema>;
export type SecurityException = z.infer<typeof SecurityExceptionSchema>;
export type PromotionCandidate = z.infer<typeof PromotionCandidateSchema>;
export type LiNKSkillFragment = z.infer<typeof LiNKSkillFragmentSchema>;
export type LiNKSkillResult = z.infer<typeof LiNKSkillResultSchema>;
