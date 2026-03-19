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

const LiNKskillsManagedRunTargetBaseSchema = z.object({
  capabilityId: z.string().min(3).optional(),
  packageId: z.string().min(3).optional(),
  version: z.string().min(1).optional()
});

const hasSingleRunTarget = (value: { capabilityId?: string; packageId?: string }) =>
  Boolean(value.capabilityId) !== Boolean(value.packageId);

export const LiNKskillsManagedRunTargetSchema = LiNKskillsManagedRunTargetBaseSchema.refine(
  hasSingleRunTarget,
  "Exactly one of capabilityId or packageId must be provided"
);

export const LiNKskillsManagedRunRequestSchema = LiNKskillsManagedRunTargetBaseSchema.extend({
  tenantId: z.string().uuid(),
  missionId: z.string().uuid(),
  runId: z.string().min(8),
  taskId: z.string().min(3),
  dprId: z.string().min(3),
  inputPayload: z.record(z.unknown()).default({}),
  contextRefs: z.array(z.string()).default([]),
  stepScope: z.string().min(1).optional()
}).refine(hasSingleRunTarget, "Exactly one of capabilityId or packageId must be provided");

export const LiNKskillsManagedRunResultSchema = z.object({
  linkskillsRunId: z.string().min(3),
  runStatus: z.string().min(3),
  receiptId: z.string().min(3),
  manifestRef: z.string().min(3),
  expiresAt: z.string().datetime()
});

export const AiosEventTypeSchema = z.enum([
  "aios.task.created",
  "aios.task.assigned",
  "aios.task.accepted",
  "aios.task.progress",
  "aios.task.handoff",
  "aios.task.completed",
  "aios.task.failed",
  "aios.approval.requested",
  "aios.approval.decided",
  "aios.security.exception"
]);

export const AiosEventEnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  eventType: AiosEventTypeSchema,
  occurredAt: z.string().datetime(),
  schemaVersion: z.string().min(1).default("1.0"),
  tenantId: z.string().uuid(),
  missionId: z.string().uuid(),
  runId: z.string().min(8),
  taskId: z.string().min(3),
  fromDprId: z.string().min(3),
  toDprId: z.string().min(3).nullable().default(null),
  correlationId: z.string().min(8),
  idempotencyKey: z.string().min(8),
  payload: z.record(z.unknown()).default({})
});

export const ApprovalStateSchema = z.enum(["requested", "recommended", "approved", "rejected"]);

export const ApprovalDecisionSchema = z.object({
  approvalId: z.string().uuid(),
  tenantId: z.string().uuid(),
  missionId: z.string().uuid(),
  runId: z.string().min(8),
  taskId: z.string().min(3),
  requestedByDprId: z.string().min(3),
  decisionByDprId: z.string().min(3),
  state: ApprovalStateSchema,
  reason: z.string().min(3),
  decidedAt: z.string().datetime(),
  metadata: z.record(z.unknown()).default({})
});

export const SlackStatusCardSchema = z.object({
  tenantId: z.string().uuid(),
  runId: z.string().min(8),
  taskId: z.string().min(3),
  eventType: AiosEventTypeSchema,
  fromDprId: z.string().min(3),
  toDprId: z.string().min(3).nullable().default(null),
  summary: z.string().min(3),
  detail: z.string().optional()
});

export type MissionStatus = z.infer<typeof MissionStatusSchema>;
export type MissionPayload = z.infer<typeof MissionPayloadSchema>;
export type SecurityException = z.infer<typeof SecurityExceptionSchema>;
export type PromotionCandidate = z.infer<typeof PromotionCandidateSchema>;
export type LiNKSkillFragment = z.infer<typeof LiNKSkillFragmentSchema>;
export type LiNKSkillResult = z.infer<typeof LiNKSkillResultSchema>;
export type LiNKskillsManagedRunTarget = z.infer<typeof LiNKskillsManagedRunTargetSchema>;
export type LiNKskillsManagedRunRequest = z.infer<typeof LiNKskillsManagedRunRequestSchema>;
export type LiNKskillsManagedRunResult = z.infer<typeof LiNKskillsManagedRunResultSchema>;
export type AiosEventType = z.infer<typeof AiosEventTypeSchema>;
export type AiosEventEnvelope = z.infer<typeof AiosEventEnvelopeSchema>;
export type ApprovalState = z.infer<typeof ApprovalStateSchema>;
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;
export type SlackStatusCard = z.infer<typeof SlackStatusCardSchema>;
