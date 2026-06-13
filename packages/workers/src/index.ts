export type { HarnessContext, Worker, WorkerRegistry } from "@scout/harness";

export {
  createStubWorkers,
  createWorkers,
  type CreateWorkersOptions,
  type WorkerMode,
} from "./create-workers.js";
export {
  createCreatorGraphAdapterFromEnv,
  MockCreatorGraphAdapter,
  SeedCreatorGraphAdapter,
  type CreatorGraphAdapter,
  type CreatorGraphResult,
} from "./adapters/creator-graph.js";
export {
  createWebSearchAdapterFromEnv,
  MockWebSearchAdapter,
  SerperWebSearchAdapter,
  TavilyWebSearchAdapter,
  type WebSearchAdapter,
  type WebSearchResult,
} from "./adapters/web-search.js";
export {
  createWebsiteAdapterFromEnv,
  extractTextFromHtml,
  FetchWebsiteAdapter,
  MockWebsiteAdapter,
  type WebsiteAdapter,
  type WebsitePage,
} from "./adapters/website.js";
export {
  buildCategoryQueries,
  buildCompetitorQueries,
  collectClientBriefEvidence,
  collectIcpResearch,
  ICPWorker,
  type ICPWorkerOptions,
  type ResearchEvidence,
} from "./icp.js";
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
