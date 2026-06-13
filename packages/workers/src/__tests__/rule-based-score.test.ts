import { describe, expect, it } from "vitest";
import type { CreatorCandidates } from "@scout/shared";
import {
  RuleBasedScoreWorker,
  seedPipelineICP,
  seedPipelineProductBrief,
} from "../index.js";

const sampleCandidates: CreatorCandidates = {
  creators: [
    {
      id: "c-high",
      handle: "@high_fit",
      platform: "tiktok",
      followerCount: 80_000,
      engagementRate: 0.07,
      estimatedRate: 500,
      audienceTags: ["fitness", "millennials", "wellness"],
      scandalFlag: false,
      trendingScore: 0.8,
      source: "seed",
    },
    {
      id: "c-mid",
      handle: "@mid_fit",
      platform: "instagram",
      followerCount: 60_000,
      engagementRate: 0.05,
      estimatedRate: 700,
      audienceTags: ["wellness", "millennials"],
      scandalFlag: false,
      trendingScore: 0.6,
      source: "seed",
    },
    {
      id: "c-low",
      handle: "@low_fit",
      platform: "youtube",
      followerCount: 40_000,
      engagementRate: 0.03,
      estimatedRate: 900,
      audienceTags: ["health"],
      scandalFlag: true,
      trendingScore: 0.4,
      source: "seed",
    },
  ],
};

function buildContext(budget = 5000) {
  return {
    runId: "score-run",
    clientBrief: {
      company: "Acme",
      companyDescription: "Protein shakes",
      product: "Shake",
      budget,
      risk: "low" as const,
    },
    artifacts: {
      CreatorCandidates: { data: sampleCandidates },
      ICPProposal: { data: seedPipelineICP },
      ProductBrief: { data: seedPipelineProductBrief },
    },
    config: {
      runsDir: "/tmp",
      runTokenBudget: 50_000,
      runCostCapUsd: 2,
      maxRetriesPerStage: 2,
    },
    telemetry: {} as never,
    retryCounts: {},
  };
}

describe("RuleBasedScoreWorker", () => {
  it("produces a ranked list with monotonic fitScore ordering", async () => {
    const worker = new RuleBasedScoreWorker();
    const result = await worker.run(buildContext() as never);

    const scores = result.creators.map((creator) => creator.fitScore);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
    expect(result.creators[0]?.id).toBe("c-high");
    expect(result.creators[0]?.fitScore).toBeGreaterThan(
      result.creators.at(-1)?.fitScore ?? 0,
    );
  });

  it("trims the shortlist when G1 budget feedback is present", async () => {
    const worker = new RuleBasedScoreWorker();
    const ctx = buildContext(800);
    ctx.feedback = {
      kind: "budget_exceeded",
      trimToBudget: 800,
      currentTotal: 2100,
      creatorsToRemove: ["c-low"],
    };

    const result = await worker.run(ctx as never);
    expect(result.totalEstimatedCost).toBeLessThanOrEqual(800);
    expect(result.creators.some((creator) => creator.id === "c-low")).toBe(false);
  });
});
