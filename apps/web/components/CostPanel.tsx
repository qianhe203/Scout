"use client";

import type { RunEvent } from "@scout/shared";
import type { RunSummary } from "../lib/api";

interface CostTotals {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  calls: Array<{
    worker: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  }>;
}

function deriveCosts(events: RunEvent[]): CostTotals {
  const calls = events.filter(
    (e): e is Extract<RunEvent, { kind: "llm_call" }> => e.kind === "llm_call",
  );

  return calls.reduce<CostTotals>(
    (acc, call) => ({
      inputTokens: acc.inputTokens + call.inputTokens,
      outputTokens: acc.outputTokens + call.outputTokens,
      estimatedCostUsd: acc.estimatedCostUsd + call.estimatedCostUsd,
      calls: [
        ...acc.calls,
        {
          worker: call.worker,
          model: call.model,
          inputTokens: call.inputTokens,
          outputTokens: call.outputTokens,
          estimatedCostUsd: call.estimatedCostUsd,
        },
      ],
    }),
    { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, calls: [] },
  );
}

export function CostPanel({
  events,
  telemetry,
}: {
  events: RunEvent[];
  telemetry?: RunSummary["telemetry"];
}) {
  const costs = deriveCosts(events);
  const useTelemetryFallback =
    costs.calls.length === 0 &&
    telemetry != null &&
    telemetry.totalInputTokens + telemetry.totalOutputTokens > 0;

  const inputTokens = useTelemetryFallback
    ? telemetry.totalInputTokens
    : costs.inputTokens;
  const outputTokens = useTelemetryFallback
    ? telemetry.totalOutputTokens
    : costs.outputTokens;
  const estimatedCostUsd = useTelemetryFallback
    ? telemetry.totalEstimatedCostUsd
    : costs.estimatedCostUsd;

  return (
    <section className="panel">
      <h2 className="panel-title">Cost & tokens</h2>
      <dl className="cost-summary">
        <div>
          <dt>Input tokens</dt>
          <dd>{inputTokens.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Output tokens</dt>
          <dd>{outputTokens.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Estimated cost</dt>
          <dd>${estimatedCostUsd.toFixed(4)}</dd>
        </div>
        <div>
          <dt>LLM calls</dt>
          <dd>{useTelemetryFallback ? "—" : costs.calls.length}</dd>
        </div>
      </dl>
      {costs.calls.length > 0 ? (
        <ul className="cost-calls">
          {costs.calls.map((call, i) => (
            <li key={`${call.worker}-${i}`}>
              <code>{call.worker}</code> · {call.model} · in{" "}
              {call.inputTokens} / out {call.outputTokens} · $
              {call.estimatedCostUsd.toFixed(4)}
            </li>
          ))}
        </ul>
      ) : useTelemetryFallback ? (
        <p className="muted">
          Totals from run telemetry. Per-call breakdown appears on new runs after
          the cost tracking fix.
        </p>
      ) : (
        <p className="muted">No LLM calls in this run yet.</p>
      )}
    </section>
  );
}
