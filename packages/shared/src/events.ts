import { z } from "zod";
import { AlarmSchema } from "./schemas/alarm.js";

export const RunEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("stage_started"), stage: z.string() }),
  z.object({
    kind: z.literal("stage_completed"),
    stage: z.string(),
    durationMs: z.number(),
  }),
  z.object({
    kind: z.literal("artifact_written"),
    artifactType: z.string(),
    version: z.number().int().positive(),
    path: z.string(),
  }),
  z.object({
    kind: z.literal("checkpoint"),
    id: z.string(),
    passed: z.boolean(),
    details: z.unknown(),
  }),
  z.object({
    kind: z.literal("guardrail"),
    id: z.string(),
    blocked: z.boolean(),
    feedback: z.unknown(),
  }),
  z.object({ kind: z.literal("alarm"), alarm: AlarmSchema }),
  z.object({
    kind: z.literal("llm_call"),
    worker: z.string(),
    model: z.string(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    estimatedCostUsd: z.number().nonnegative(),
    latencyMs: z.number().nonnegative(),
  }),
  z.object({
    kind: z.literal("tool_call"),
    adapter: z.string(),
    success: z.boolean(),
    latencyMs: z.number().nonnegative(),
  }),
  z.object({ kind: z.literal("human_required"), reason: z.string() }),
  z.object({
    kind: z.literal("run_complete"),
    exportPath: z.string(),
    totalCostUsd: z.number().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
  }),
]);

export type RunEvent = z.infer<typeof RunEventSchema>;
