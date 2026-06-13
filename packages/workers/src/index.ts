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
  createInfluencersClubAdapterFromEnv,
  InfluencersClubAdapterImpl,
  InfluencersClubApiError,
  MockInfluencersClubAdapter,
  type InfluencersClubAdapter,
} from "./adapters/influencers-club.js";
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
export { ResearchWorker, type ResearchWorkerOptions } from "./research.js";
export { RuleBasedScoreWorker } from "./score/rule-based-score.js";
export { ScoreWorker } from "./score.js";
export { ProductWorker, type ProductWorkerOptions } from "./product.js";
export { OutreachWorker, type OutreachWorkerOptions } from "./outreach.js";
export {
  createCP4Evaluator,
  createCP4EvaluatorFromEnv,
  type CP4EvaluatorOptions,
} from "./cp4-evaluator.js";
export {
  seedPipelineICP,
  seedPipelineOutreach,
  seedPipelineProductBrief,
} from "./fixtures/seed-pipeline.js";

export {
  assertTokenBudget,
  callLLM,
  exceedsTokenBudget,
  llmTelemetryFromContext,
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
  defaultLlmModelFromEnv,
  MockLLMProvider,
  OpenAILLMProvider,
} from "./llm-provider.js";
