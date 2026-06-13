import type { Alarm } from "./schemas/client-brief.js";

export type RunEvent =
  | { kind: "stage_started"; stage: string }
  | { kind: "stage_completed"; stage: string; durationMs: number }
  | {
      kind: "artifact_written";
      artifactType: string;
      version: number;
      path: string;
    }
  | { kind: "checkpoint"; id: string; passed: boolean; details: unknown }
  | { kind: "guardrail"; id: string; blocked: boolean; feedback: unknown }
  | { kind: "alarm"; alarm: Alarm }
  | {
      kind: "llm_call";
      worker: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      estimatedCostUsd: number;
      latencyMs: number;
    }
  | {
      kind: "tool_call";
      adapter: string;
      success: boolean;
      latencyMs: number;
    }
  | { kind: "human_required"; reason: string }
  | {
      kind: "run_complete";
      exportPath: string;
      totalCostUsd: number;
      totalTokens: number;
    };
