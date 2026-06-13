import { z } from "zod";

export const BudgetExceededFeedbackSchema = z.object({
  kind: z.literal("budget_exceeded"),
  trimToBudget: z.number().positive(),
  currentTotal: z.number().positive(),
  creatorsToRemove: z.array(z.string()),
});

export const ProfessionalismFeedbackSchema = z.object({
  kind: z.literal("professionalism_fail"),
  score: z.number().min(0).max(100),
  failures: z.array(z.string()),
  draftsToRevise: z.array(z.string()),
});

export const CheckpointFeedbackSchema = z.discriminatedUnion("kind", [
  ProfessionalismFeedbackSchema,
  z.object({
    kind: z.literal("checkpoint_fail"),
    checkpointId: z.string(),
    details: z.unknown(),
  }),
]);

export const GuardrailFeedbackSchema = z.discriminatedUnion("kind", [
  BudgetExceededFeedbackSchema,
  z.object({
    kind: z.literal("platform_blocked"),
    blockedPlatforms: z.array(z.string()),
  }),
]);

export const HarnessFeedbackSchema = z.union([
  GuardrailFeedbackSchema,
  CheckpointFeedbackSchema,
]);

export type BudgetExceededFeedback = z.infer<
  typeof BudgetExceededFeedbackSchema
>;
export type ProfessionalismFeedback = z.infer<
  typeof ProfessionalismFeedbackSchema
>;
export type GuardrailFeedback = z.infer<typeof GuardrailFeedbackSchema>;
export type CheckpointFeedback = z.infer<typeof CheckpointFeedbackSchema>;
export type HarnessFeedback = z.infer<typeof HarnessFeedbackSchema>;
