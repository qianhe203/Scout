import { z } from "zod";
import { AlarmSchema } from "./alarm.js";

export const ToolCallTelemetrySchema = z.object({
  adapter: z.string(),
  latencyMs: z.number().nonnegative(),
  success: z.boolean(),
});

export const StageTelemetrySchema = z.object({
  stage: z.string(),
  durationMs: z.number().nonnegative(),
  llmCalls: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
  toolCalls: z.array(ToolCallTelemetrySchema),
  checkpoint: z
    .object({
      id: z.string(),
      passed: z.boolean(),
    })
    .optional(),
  guardrailHits: z.array(z.string()).optional(),
});

export const HarnessRunLogSchema = z.object({
  runId: z.string().uuid(),
  stages: z.array(StageTelemetrySchema),
  totalInputTokens: z.number().int().nonnegative(),
  totalOutputTokens: z.number().int().nonnegative(),
  totalEstimatedCostUsd: z.number().nonnegative(),
  alarms: z.array(AlarmSchema),
  otelTraceId: z.string().optional(),
});

export type StageTelemetry = z.infer<typeof StageTelemetrySchema>;
export type HarnessRunLog = z.infer<typeof HarnessRunLogSchema>;
