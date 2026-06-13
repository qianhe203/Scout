import type { Alarm } from "@scout/shared";
import type { StageSpan } from "../types.js";
import { exceedsStageTimeout } from "./stage.js";

export function checkStageWatchdog(
  span: StageSpan,
  timeoutMs: number,
): Alarm | null {
  if (!exceedsStageTimeout(span, timeoutMs)) return null;
  return {
    type: "LLM_SPIN_DETECTED",
    severity: "high",
    context: {
      stage: span.stage,
      durationMs: Date.now() - span.startedAt,
      thresholdMs: timeoutMs,
    },
    recommended_action: "Pause stage and inspect worker loop or LLM retries",
    timestamp: new Date().toISOString(),
  };
}
