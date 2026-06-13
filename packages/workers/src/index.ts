import type { HarnessContext, Worker, WorkerRegistry } from "@scout/harness";

export type { HarnessContext, Worker, WorkerRegistry };

/** Placeholder workers — replaced by real implementations in U5/U8/U9. */
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

export { callLLM, exceedsTokenBudget } from "./llm.js";
export type {
  LLMCallOptions,
  LLMProvider,
  LLMResult,
  LLMTelemetrySink,
} from "./llm.js";
export { createProviderFromEnv, MockLLMProvider } from "./llm-provider.js";
