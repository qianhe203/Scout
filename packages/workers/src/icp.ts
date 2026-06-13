import type { ClientBrief, EvidenceSource, ICPProposal } from "@scout/shared";
import { ICPProposalSchema } from "@scout/shared";
import type { HarnessContext } from "@scout/harness";
import type { CreatorGraphAdapter } from "./adapters/creator-graph.js";
import type { WebSearchAdapter } from "./adapters/web-search.js";
import type { WebsiteAdapter } from "./adapters/website.js";
import { callLLM, type LLMProvider } from "./llm.js";
import { createProviderFromEnv, defaultLlmModelFromEnv } from "./llm-provider.js";
import {
  enrichIcpProposal,
  formatZodError,
  icpProposalExample,
  normalizeIcpRaw,
} from "./icp-normalize.js";
import { extractJson } from "./utils/json.js";

export interface ResearchEvidence {
  source: EvidenceSource;
  url?: string;
  snippet: string;
}

export interface ICPWorkerOptions {
  provider?: LLMProvider;
  webSearch?: WebSearchAdapter;
  website?: WebsiteAdapter;
  creatorGraph?: CreatorGraphAdapter;
  model?: string;
}

function productCategory(brief: ClientBrief): string {
  return brief.product.trim() || brief.companyDescription.trim();
}

export function buildCategoryQueries(brief: ClientBrief): string[] {
  const category = productCategory(brief);
  return [
    `"${category}" buyer persona demographics`,
    `"${category}" customer reviews who uses`,
    `"${category}" influencer marketing creators audience`,
    `"${brief.company}" ${brief.product} target customer audience`,
  ];
}

export function buildCompetitorQueries(brief: ClientBrief): string[] {
  const category = productCategory(brief);
  const queries = [
    `"${category}" alternatives competitors`,
  ];
  if (brief.admiredCompetitor) {
    queries.push(
      `"${brief.admiredCompetitor}" customers reviews OR target audience`,
    );
  }
  if (brief.targetAudience) {
    queries.push(
      `"${category}" "${brief.targetAudience}" fit OR mismatch`,
    );
  }
  return queries;
}

export function buildRetryQueries(brief: ClientBrief): string[] {
  const category = productCategory(brief);
  return [
    `"${category}" site:reddit.com OR site:g2.com reviews`,
    `"${brief.product}" "who is this for" OR "ideal customer"`,
  ];
}

export function buildExpandedQueries(brief: ClientBrief): string[] {
  const category = productCategory(brief);
  return [
    `"${category}" reddit who buys`,
    `"${category}" g2 review ideal customer`,
    `"${brief.company}" customer testimonials audience`,
  ];
}

export function collectClientBriefEvidence(brief: ClientBrief): ResearchEvidence[] {
  const snippets: string[] = [];
  if (brief.targetAudience) {
    snippets.push(`Client stated audience: ${brief.targetAudience}`);
  }
  if (brief.exampleCustomers?.length) {
    snippets.push(`Example customers: ${brief.exampleCustomers.join("; ")}`);
  }
  if (brief.whyTheyBuy) {
    snippets.push(`Why they buy: ${brief.whyTheyBuy}`);
  }
  if (brief.tractionChannels?.length) {
    snippets.push(`Traction channels: ${brief.tractionChannels.join(", ")}`);
  }
  if (brief.admiredCompetitor) {
    snippets.push(`Admired competitor: ${brief.admiredCompetitor}`);
  }

  if (snippets.length === 0) return [];

  return [
    {
      source: "client_brief",
      snippet: snippets.join(" · "),
    },
  ];
}

function websiteEvidence(
  page: Awaited<ReturnType<WebsiteAdapter["fetch"]>>,
  source: Extract<EvidenceSource, "website" | "product_page">,
): ResearchEvidence | null {
  if (!page) return null;
  const snippet = [
    page.title,
    page.aboutText.slice(0, 400),
    page.pricingCues.length
      ? `Pricing cues: ${page.pricingCues.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join(" — ");
  return {
    source,
    url: page.url,
    snippet,
  };
}

export async function collectIcpResearch(
  ctx: HarnessContext,
  deps: {
    webSearch: WebSearchAdapter;
    website: WebsiteAdapter;
    creatorGraph: CreatorGraphAdapter;
  },
): Promise<ResearchEvidence[]> {
  const brief = ctx.clientBrief;
  const retryPass = ctx.retryCounts.icp ?? 0;
  const evidence: ResearchEvidence[] = [];

  evidence.push(...collectClientBriefEvidence(brief));

  const [categoryResults, competitorResults, graph] = await Promise.all([
    deps.webSearch.search(buildCategoryQueries(brief)),
    deps.webSearch.search(buildCompetitorQueries(brief)),
    deps.creatorGraph.infer(brief),
  ]);

  for (const result of categoryResults.slice(0, 4)) {
    evidence.push({
      source: "web_search_category",
      url: result.url || undefined,
      snippet: `${result.title}: ${result.snippet}`.slice(0, 500),
    });
  }

  for (const result of competitorResults.slice(0, 3)) {
    evidence.push({
      source: "web_search_competitor",
      url: result.url || undefined,
      snippet: `${result.title}: ${result.snippet}`.slice(0, 500),
    });
  }

  if (graph.audienceTags.length > 0) {
    evidence.push({
      source: "creator_graph",
      snippet: `${graph.rationale}. Tags: ${graph.audienceTags.join(", ")}. Creators: ${graph.topCreatorHandles.join(", ")}`,
    });
  }

  if (brief.companyWebsiteUrl) {
    const page = await deps.website.fetch(brief.companyWebsiteUrl);
    const item = websiteEvidence(page, "website");
    if (item) evidence.push(item);
  }

  if (retryPass >= 1) {
    if (brief.productUrl) {
      const page = await deps.website.fetch(brief.productUrl);
      const item = websiteEvidence(page, "product_page");
      if (item) evidence.push(item);
    }

    const retryResults = await deps.webSearch.search(buildRetryQueries(brief));
    for (const result of retryResults.slice(0, 3)) {
      evidence.push({
        source: "web_search_category",
        url: result.url || undefined,
        snippet: `[retry] ${result.title}: ${result.snippet}`.slice(0, 500),
      });
    }
  }

  if (retryPass >= 2) {
    const expanded = await deps.webSearch.search(buildExpandedQueries(brief));
    for (const result of expanded.slice(0, 3)) {
      evidence.push({
        source: "web_search_competitor",
        url: result.url || undefined,
        snippet: `[expanded] ${result.title}: ${result.snippet}`.slice(0, 500),
      });
    }
  }

  return evidence;
}

function buildSynthesisPrompt(
  brief: ClientBrief,
  evidence: ResearchEvidence[],
  retryPass: number,
): string {
  const lowConfidence = retryPass >= 3;
  const example = icpProposalExample(retryPass);
  return [
    "You are ICPWorker for Scout. Synthesize an ICPProposal JSON object from independent research evidence.",
    "Rules:",
    "- Return a single JSON object with EXACTLY these top-level keys: segments, clientAlignment, recommendedPrimarySegment, evidenceSourceTypes, icpRetryPasses.",
    "- segments is a non-empty array; each item needs persona, demographics, channels, rationale, confidence, evidence.",
    "- evidenceSourceTypes lists distinct source type strings used across segments (e.g. web_search_category, web_search_competitor, creator_graph).",
    "- clientAlignment must be one of: confirmed, contradicted, partial, no_client_input.",
    "- recommendedPrimarySegment is a 0-based index into segments.",
    `- icpRetryPasses must be ${retryPass}.`,
    "- Do not wrap the object in another key. Do not add markdown.",
    lowConfidence
      ? "- All segments should use confidence low because evidence is thin after retries."
      : "",
    "",
    "Example output shape (fill with research-backed content):",
    JSON.stringify(example, null, 2),
    "",
    "ClientBrief:",
    JSON.stringify(brief, null, 2),
    "",
    "Research evidence:",
    JSON.stringify(evidence, null, 2),
    "",
    "Return ONLY the JSON object matching the example shape.",
  ]
    .filter(Boolean)
    .join("\n");
}

export class ICPWorker {
  name = "ICPWorker";

  private readonly provider: LLMProvider;
  private readonly webSearch: WebSearchAdapter;
  private readonly website: WebsiteAdapter;
  private readonly creatorGraph: CreatorGraphAdapter;
  private readonly model: string;

  constructor(options: ICPWorkerOptions = {}) {
    this.provider = options.provider ?? createProviderFromEnv();
    this.webSearch = options.webSearch ?? { name: "noop", search: async () => [] };
    this.website = options.website ?? { name: "noop", fetch: async () => null };
    this.creatorGraph =
      options.creatorGraph ??
      ({
        name: "noop",
        infer: async () => ({
          audienceTags: [],
          topCreatorHandles: [],
          rationale: "No creator graph configured",
        }),
      } satisfies CreatorGraphAdapter);
    this.model =
      options.model ??
      process.env.ICP_MODEL ??
      defaultLlmModelFromEnv();
  }

  async run(ctx: HarnessContext): Promise<ICPProposal> {
    const retryPass = ctx.retryCounts.icp ?? 0;
    const evidence = await collectIcpResearch(ctx, {
      webSearch: this.webSearch,
      website: this.website,
      creatorGraph: this.creatorGraph,
    });

    const prompt = buildSynthesisPrompt(ctx.clientBrief, evidence, retryPass);
    let lastError: Error | null = null;
    let lastZodDetails = "";

    for (let attempt = 0; attempt < 3; attempt++) {
      const revisionHint =
        attempt === 0
          ? ""
          : `\n\nPrevious output failed validation:\n${lastZodDetails}\nReturn ONLY a corrected JSON object with all required top-level keys.`;

      const result = await callLLM({
        runId: ctx.runId,
        stage: "icp",
        worker: this.name,
        purpose:
          attempt === 0 ? "icp_synthesis" : `icp_synthesis_retry_${attempt}`,
        model: this.model,
        messages: [
          {
            role: "user",
            content: `${prompt}${revisionHint}`,
          },
        ],
        provider: this.provider,
      });

      try {
        const rawJson = JSON.parse(extractJson(result.content)) as unknown;
        const normalized = enrichIcpProposal(
          normalizeIcpRaw(rawJson) as Record<string, unknown>,
          retryPass,
          ctx.clientBrief.targetAudience,
        );
        const validated = ICPProposalSchema.parse(normalized);
        return validated;
      } catch (error) {
        lastZodDetails = formatZodError(error);
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw lastError ?? new Error("ICPWorker failed to produce valid ICPProposal");
  }
}
