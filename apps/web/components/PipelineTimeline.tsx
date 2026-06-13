"use client";

import type { RunEvent } from "@scout/shared";

const STAGES = [
  { id: "icp", label: "ICP", checkpoint: "CP0" },
  { id: "product", label: "Product", checkpoint: "CP1" },
  { id: "research", label: "Research", checkpoint: "CP2" },
  { id: "score", label: "Score", checkpoint: "CP3" },
  { id: "outreach", label: "Outreach", checkpoint: "CP4" },
  { id: "export", label: "Export", checkpoint: null },
] as const;

type StageStatus = "pending" | "running" | "pass" | "fail" | "retry";

interface StageState {
  status: StageStatus;
  durationMs?: number;
  checkpointPassed?: boolean;
}

function deriveStageStates(events: RunEvent[]): Record<string, StageState> {
  const states: Record<string, StageState> = {};
  for (const stage of STAGES) {
    states[stage.id] = { status: "pending" };
  }

  for (const event of events) {
    if (event.kind === "stage_started") {
      states[event.stage] = { ...states[event.stage], status: "running" };
    }
    if (event.kind === "stage_completed") {
      states[event.stage] = {
        status: "pass",
        durationMs: event.durationMs,
      };
    }
    if (event.kind === "checkpoint") {
      const stage = STAGES.find((s) => s.checkpoint === event.id)?.id;
      if (stage) {
        states[stage] = {
          ...states[stage],
          status: event.passed ? "pass" : "fail",
          checkpointPassed: event.passed,
        };
      }
    }
    if (event.kind === "guardrail" && event.blocked) {
      const running = Object.entries(states).find(([, s]) => s.status === "running");
      if (running) {
        states[running[0]] = { ...states[running[0]], status: "retry" };
      }
    }
    if (event.kind === "human_required") {
      const running = Object.entries(states).find(([, s]) => s.status === "running");
      if (running) {
        states[running[0]] = { ...states[running[0]], status: "fail" };
      }
    }
  }

  return states;
}

function badgeClass(status: StageStatus): string {
  switch (status) {
    case "pass":
      return "badge badge-pass";
    case "fail":
      return "badge badge-fail";
    case "running":
      return "badge badge-running";
    case "retry":
      return "badge badge-retry";
    default:
      return "badge";
  }
}

export function PipelineTimeline({ events }: { events: RunEvent[] }) {
  const states = deriveStageStates(events);

  return (
    <section className="panel">
      <h2 className="panel-title">Pipeline</h2>
      <ol className="timeline">
        {STAGES.map((stage) => {
          const state = states[stage.id];
          return (
            <li key={stage.id} className="timeline-item">
              <span className={badgeClass(state.status)}>{state.status}</span>
              <div>
                <strong>{stage.label}</strong>
                {stage.checkpoint ? (
                  <span className="muted"> · {stage.checkpoint}</span>
                ) : null}
                {state.durationMs != null ? (
                  <span className="muted"> · {state.durationMs}ms</span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
