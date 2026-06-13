import type { ClientBrief, RunStatus } from "@scout/shared";

export interface HarnessConfig {
  runsDir: string;
  runTokenBudget: number;
  runCostCapUsd: number;
  maxRetriesPerStage: number;
}

export interface RunMeta {
  runId: string;
  status: RunStatus;
  currentStage: string | null;
  clientBrief: ClientBrief;
  createdAt: string;
  updatedAt: string;
}

/** Orchestrator stub — full stage machine implemented in U2. */
export class Orchestrator {
  constructor(private readonly config: HarnessConfig) {}

  getConfig(): HarnessConfig {
    return this.config;
  }

  async startRun(_runId: string, _brief: ClientBrief): Promise<void> {
    // U2: stage machine, guardrails, checkpoints, persistence
    throw new Error("Orchestrator not implemented yet — see U2 in HARNESS_PLANNING.md");
  }
}

export { Orchestrator as default };
