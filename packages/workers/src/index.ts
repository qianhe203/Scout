export type { HarnessContext, Worker, WorkerRegistry } from "@scout/harness";

export {
  createStubWorkers,
  createWorkers,
  type CreateWorkersOptions,
  type WorkerMode,
} from "./create-workers.js";
export {
  createSeedAdapter,
  extractIcpKeywords,
  resolveResearchPlatforms,
  type ResearchQuery,
  type SeedAdapter,
  type SeedCreatorRecord,
} from "./adapters/seed.js";
export { SeedResearchWorker } from "./research/seed-research.js";
export { RuleBasedScoreWorker } from "./score/rule-based-score.js";
export {
  seedPipelineICP,
  seedPipelineOutreach,
  seedPipelineProductBrief,
} from "./fixtures/seed-pipeline.js";

export {
  assertTokenBudget,
  callLLM,
  exceedsTokenBudget,
  TokenBudgetExceededError,
} from "./llm.js";
export type {
  LLMCallOptions,
  LLMProvider,
  LLMResult,
  LLMTelemetrySink,
} from "./llm.js";
export {
  AnthropicLLMProvider,
  createProviderFromEnv,
  MockLLMProvider,
  OpenAILLMProvider,
} from "./llm-provider.js";
