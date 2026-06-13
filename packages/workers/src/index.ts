import type { ClientBrief } from "@scout/shared";

export interface HarnessContext {
  runId: string;
  clientBrief: ClientBrief;
  artifacts: Record<string, unknown>;
  feedback?: unknown;
}

export interface Worker {
  name: string;
  run(ctx: HarnessContext): Promise<unknown>;
}

export interface WorkerRegistry {
  icp: Worker;
  product: Worker;
  research: Worker;
  score: Worker;
  outreach: Worker;
}

/** Placeholder workers — implemented in U3/U6. */
export function createStubWorkers(): WorkerRegistry {
  const stub = (name: string): Worker => ({
    name,
    async run() {
      throw new Error(`${name} not implemented yet`);
    },
  });

  return {
    icp: stub("ICPWorker"),
    product: stub("ProductWorker"),
    research: stub("ResearchWorker"),
    score: stub("ScoreWorker"),
    outreach: stub("OutreachWorker"),
  };
}
