import type { Stage, StageSpan, TelemetryContext, TelemetrySink } from "../types.js";

export function createTelemetryContext(sink: TelemetrySink): TelemetryContext {
  return {
    sink,
    startStage(stage: Stage, runId: string): StageSpan {
      return { stage, runId, startedAt: Date.now() };
    },
    endStage(span: StageSpan): number {
      const durationMs = Date.now() - span.startedAt;
      span.durationMs = durationMs;
      return durationMs;
    },
  };
}

export function exceedsStageTimeout(
  span: StageSpan,
  timeoutMs: number,
): boolean {
  return Date.now() - span.startedAt > timeoutMs;
}
