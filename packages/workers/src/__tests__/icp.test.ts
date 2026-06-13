import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { HarnessContext } from "@scout/harness";
import { evaluateCP0 } from "@scout/harness";
import { ICPProposalSchema } from "@scout/shared";
import { MockCreatorGraphAdapter, SeedCreatorGraphAdapter } from "../adapters/creator-graph.js";
import { MockWebSearchAdapter } from "../adapters/web-search.js";
import { MockWebsiteAdapter } from "../adapters/website.js";
import {
  buildCategoryQueries,
  collectClientBriefEvidence,
  collectIcpResearch,
  ICPWorker,
} from "../icp.js";
import { MockLLMProvider } from "../llm-provider.js";

const creatorsPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../data/creators.json",
);

const baseBrief = {
  company: "FitFuel Co",
  companyDescription: "Organic protein shakes for busy millennials",
  product: "Plant-based protein shake",
  budget: 5000,
  risk: "low" as const,
};

function makeContext(
  overrides: Partial<HarnessContext> = {},
): HarnessContext {
  return {
    runId: "run-test",
    clientBrief: baseBrief,
    artifacts: {},
    config: {
      runsDir: "/tmp",
      runTokenBudget: 50_000,
      runCostCapUsd: 2,
      maxRetriesPerStage: 2,
    },
    telemetry: {
      startStage: () => ({ stage: "icp", runId: "run-test", startedAt: Date.now() }),
      endStage: () => 0,
      sink: {
        append: async () => {},
        exceedsTokenBudget: async () => false,
        exceedsCostCap: async () => false,
        recordStageTelemetry: async () => {},
      },
    },
    retryCounts: {},
    ...overrides,
  };
}

const validProposalJson = {
  segments: [
    {
      persona: "Fitness-focused millennials",
      demographics: "25-38, urban US",
      channels: ["tiktok", "instagram"],
      rationale: "Category and creator graph evidence align on fitness millennials",
      confidence: "high",
      evidence: [
        {
          source: "web_search_category",
          snippet: "Meal kit buyers skew millennial",
        },
        {
          source: "web_search_competitor",
          snippet: "Competitors target young professionals",
        },
        {
          source: "creator_graph",
          snippet: "Top creators tag fitness and millennials",
        },
      ],
    },
  ],
  clientAlignment: "no_client_input",
  recommendedPrimarySegment: 0,
  evidenceSourceTypes: [
    "web_search_category",
    "web_search_competitor",
    "creator_graph",
  ],
  icpRetryPasses: 0,
};

describe("ICP research helpers", () => {
  it("buildCategoryQueries includes product category templates", () => {
    const queries = buildCategoryQueries(baseBrief);
    expect(queries[0]).toContain("Plant-based protein shake");
    expect(queries.some((q) => q.includes("buyer persona"))).toBe(true);
  });

  it("collectClientBriefEvidence returns client_brief snippets", () => {
    const evidence = collectClientBriefEvidence({
      ...baseBrief,
      targetAudience: "Gen Z fitness",
    });
    expect(evidence[0]?.source).toBe("client_brief");
    expect(evidence[0]?.snippet).toContain("Gen Z fitness");
  });
});

describe("collectIcpResearch", () => {
  it("includes web_search_category evidence from adapter results", async () => {
    const webSearch = new MockWebSearchAdapter([
      {
        url: "https://example.com",
        title: "Market research",
        snippet: "Millennial parents dominate the category",
      },
    ]);

    const evidence = await collectIcpResearch(makeContext(), {
      webSearch,
      website: new MockWebsiteAdapter(),
      creatorGraph: new MockCreatorGraphAdapter({
        audienceTags: ["fitness"],
        topCreatorHandles: ["@a"],
        rationale: "Fitness cluster",
      }),
    });

    expect(evidence.some((e) => e.source === "web_search_category")).toBe(true);
    expect(webSearch.searchedQueries.length).toBeGreaterThan(0);
  });

  it("adds product_page evidence on retry pass when productUrl is set", async () => {
    const website = new MockWebsiteAdapter({
      "https://fitfuel.example/shake": {
        url: "https://fitfuel.example/shake",
        title: "Protein Shake",
        aboutText: "Built for post-workout recovery",
        productText: "20g plant protein per serving",
        pricingCues: ["$39"],
      },
    });

    const evidence = await collectIcpResearch(
      makeContext({
        retryCounts: { icp: 1 },
        clientBrief: {
          ...baseBrief,
          productUrl: "https://fitfuel.example/shake",
        },
      }),
      {
        webSearch: new MockWebSearchAdapter(),
        website,
        creatorGraph: new MockCreatorGraphAdapter({
          audienceTags: [],
          topCreatorHandles: [],
          rationale: "none",
        }),
      },
    );

    expect(website.fetchedUrls).toContain("https://fitfuel.example/shake");
    expect(evidence.some((e) => e.source === "product_page")).toBe(true);
  });
});

describe("ICPWorker", () => {
  it("returns validated ICPProposal with ≥3 evidence source types", async () => {
    const worker = new ICPWorker({
      provider: new MockLLMProvider(JSON.stringify(validProposalJson)),
      webSearch: new MockWebSearchAdapter([
        {
          url: "https://example.com",
          title: "Category",
          snippet: "Millennials buy protein shakes",
        },
      ]),
      website: new MockWebsiteAdapter(),
      creatorGraph: new MockCreatorGraphAdapter({
        audienceTags: ["fitness", "millennials"],
        topCreatorHandles: ["@homeworkout_hannah"],
        rationale: "Fitness cluster",
      }),
    });

    const proposal = await worker.run(makeContext());
    expect(ICPProposalSchema.safeParse(proposal).success).toBe(true);
    expect(proposal.evidenceSourceTypes).toContain("web_search_category");
  });

  it("rejects synthesis that only cites client_brief evidence", async () => {
    const thinProposal = {
      ...validProposalJson,
      evidenceSourceTypes: ["client_brief"],
      segments: [
        {
          ...validProposalJson.segments[0],
          evidence: [{ source: "client_brief", snippet: "Client said Gen Z" }],
        },
      ],
    };

    const worker = new ICPWorker({
      provider: new MockLLMProvider(JSON.stringify(thinProposal)),
      webSearch: new MockWebSearchAdapter(),
      website: new MockWebsiteAdapter(),
      creatorGraph: new MockCreatorGraphAdapter({
        audienceTags: [],
        topCreatorHandles: [],
        rationale: "none",
      }),
    });

    await expect(
      worker.run(
        makeContext({
          clientBrief: {
            ...baseBrief,
            targetAudience: "Gen Z only",
          },
        }),
      ),
    ).rejects.toThrow();

    const cp0 = evaluateCP0({
      ...makeContext(),
      artifacts: {
        ICPProposal: {
          meta: {
            id: "1",
            type: "ICPProposal",
            version: 1,
            runId: "run-test",
            createdAt: new Date().toISOString(),
          },
          data: thinProposal,
          path: "/tmp/ICPProposal_v1.json",
        },
      },
    });
    expect(cp0.passed).toBe(false);
  });

  it("populates clientAlignment when targetAudience contradicts research", async () => {
    const contradictedProposal = {
      ...validProposalJson,
      clientStatedAudience: "Gen Z fitness",
      clientAlignment: "contradicted",
      alignmentNotes: "Research points to millennials, not Gen Z",
    };

    const worker = new ICPWorker({
      provider: new MockLLMProvider(JSON.stringify(contradictedProposal)),
      webSearch: new MockWebSearchAdapter([
        {
          url: "https://example.com",
          title: "Buyers",
          snippet: "Core buyers are millennials aged 28-40",
        },
      ]),
      website: new MockWebsiteAdapter(),
      creatorGraph: new MockCreatorGraphAdapter({
        audienceTags: ["millennials", "fitness"],
        topCreatorHandles: ["@homeworkout_hannah"],
        rationale: "Millennial fitness cluster",
      }),
    });

    const proposal = await worker.run(
      makeContext({
        clientBrief: {
          ...baseBrief,
          targetAudience: "Gen Z fitness",
        },
      }),
    );

    expect(proposal.clientAlignment).toBe("contradicted");
    expect(proposal.clientStatedAudience).toBe("Gen Z fitness");
  });

  it("uses seed creator graph when configured with creatorsPath", async () => {
    const worker = new ICPWorker({
      provider: new MockLLMProvider(JSON.stringify(validProposalJson)),
      webSearch: new MockWebSearchAdapter(),
      website: new MockWebsiteAdapter(),
      creatorGraph: new SeedCreatorGraphAdapter({
        creatorsPath,
      }),
    });

    const proposal = await worker.run(makeContext());
    expect(proposal.segments.length).toBeGreaterThan(0);
  });
});
