"use client";

import type { RunEvent } from "@scout/shared";

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

export function CostPanel({ events }: { events: RunEvent[] }) {
  const costs = deriveCosts(events);

  return (
    <section className="panel">
      <h2 className="panel-title">Cost & tokens</h2>
      <dl className="cost-summary">
        <div>
          <dt>Input tokens</dt>
          <dd>{costs.inputTokens.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Output tokens</dt>
          <dd>{costs.outputTokens.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Estimated cost</dt>
          <dd>${costs.estimatedCostUsd.toFixed(4)}</dd>
        </div>
        <div>
          <dt>LLM calls</dt>
          <dd>{costs.calls.length}</dd>
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
      ) : (
        <p className="muted">No LLM calls in this run yet.</p>
      )}
    </section>
  );
}
