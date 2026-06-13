import { describe, expect, it, vi } from "vitest";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { InfluencersClubApiError, MockInfluencersClubAdapter } from "../adapters/influencers-club.js";
import { createSeedAdapter } from "../adapters/seed.js";
import { ResearchWorker } from "../research.js";
import { seedPipelineICP, seedPipelineProductBrief } from "../fixtures/seed-pipeline.js";

const creatorsPath = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../data/creators.json",
);

describe("ResearchWorker", () => {
  it("falls back to seed and emits RESEARCH_SOURCE_DOWN when Influencers.club fails", async () => {
    const failingAdapter = {
      name: "influencers_club",
      discover: vi.fn().mockRejectedValue(new InfluencersClubApiError("down", 503)),
    };
    const alarms: string[] = [];

    const worker = new ResearchWorker({
      influencersClub: failingAdapter,
      seed: createSeedAdapter({ creatorsPath }),
      creatorsPath,
    });

    const result = await worker.run({
      runId: "00000000-0000-4000-8000-000000000099",
      clientBrief: {
        company: "FitCo",
        companyDescription: "Protein shakes",
        product: "Plant protein",
        budget: 5000,
        risk: "low",
      },
      artifacts: {
        ICPProposal: {
          meta: {
            id: "1",
            type: "ICPProposal",
            version: 1,
            runId: "x",
            createdAt: new Date().toISOString(),
          },
          data: seedPipelineICP,
          path: "x",
        },
        ProductBrief: {
          meta: {
            id: "1",
            type: "ProductBrief",
            version: 1,
            runId: "x",
            createdAt: new Date().toISOString(),
          },
          data: seedPipelineProductBrief,
          path: "x",
        },
      },
      config: {
        runsDir: "./runs",
        runTokenBudget: 50_000,
        runCostCapUsd: 2,
        maxRetriesPerStage: 2,
      },
      telemetry: {
        startStage: () => ({
          stage: "research",
          runId: "x",
          startedAt: Date.now(),
        }),
        endStage: () => 1,
        sink: {
          append: async () => {},
          exceedsTokenBudget: async () => false,
          exceedsCostCap: async () => false,
          recordStageTelemetry: async () => {},
        },
      },
      retryCounts: {},
      emitAlarm: async (alarm) => {
        alarms.push(alarm.type);
      },
    });

    expect(result.creators.length).toBeGreaterThanOrEqual(5);
    expect(alarms).toContain("RESEARCH_SOURCE_DOWN");
  });

  it("uses Influencers.club results when available", async () => {
    const mockAdapter = new MockInfluencersClubAdapter([
      {
        id: "ic_1",
        handle: "@live_creator",
        platform: "tiktok",
        followerCount: 50000,
        engagementRate: 0.05,
        estimatedRate: 600,
        audienceTags: ["fitness"],
        scandalFlag: false,
        trendingScore: 0.6,
        source: "influencers_club",
      },
    ]);

    const worker = new ResearchWorker({
      influencersClub: mockAdapter,
      seed: createSeedAdapter({ creatorsPath }),
      creatorsPath,
    });

    const result = await worker.run({
      runId: "00000000-0000-4000-8000-000000000098",
      clientBrief: {
        company: "FitCo",
        companyDescription: "Protein shakes",
        product: "Plant protein",
        budget: 5000,
        risk: "low",
      },
      artifacts: {
        ICPProposal: {
          meta: {
            id: "1",
            type: "ICPProposal",
            version: 1,
            runId: "x",
            createdAt: new Date().toISOString(),
          },
          data: seedPipelineICP,
          path: "x",
        },
        ProductBrief: {
          meta: {
            id: "1",
            type: "ProductBrief",
            version: 1,
            runId: "x",
            createdAt: new Date().toISOString(),
          },
          data: seedPipelineProductBrief,
          path: "x",
        },
      },
      config: {
        runsDir: "./runs",
        runTokenBudget: 50_000,
        runCostCapUsd: 2,
        maxRetriesPerStage: 2,
      },
      telemetry: {
        startStage: () => ({
          stage: "research",
          runId: "x",
          startedAt: Date.now(),
        }),
        endStage: () => 1,
        sink: {
          append: async () => {},
          exceedsTokenBudget: async () => false,
          exceedsCostCap: async () => false,
          recordStageTelemetry: async () => {},
        },
      },
      retryCounts: {},
    });

    expect(result.creators[0]?.source).toBe("influencers_club");
  });
});
