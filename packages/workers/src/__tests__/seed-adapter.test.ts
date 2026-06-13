import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createSeedAdapter,
  extractIcpKeywords,
  seedPipelineICP,
  seedPipelineProductBrief,
} from "../index.js";

const repoRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const creatorsPath = join(repoRoot, "data/creators.json");

describe("seed adapter", () => {
  it("returns at least five candidates when ICP tags match seed data", async () => {
    const adapter = createSeedAdapter({ creatorsPath });
    const keywords = extractIcpKeywords(seedPipelineICP);

    expect(keywords.has("fitness")).toBe(true);
    expect(keywords.has("millennials")).toBe(true);

    const creators = await adapter.discover(
      {
        icp: seedPipelineICP,
        product: seedPipelineProductBrief,
        platforms: ["tiktok", "instagram", "youtube", "threads"],
        maxResults: 20,
      },
      {
        runId: "test-run",
        clientBrief: {
          company: "Acme",
          companyDescription: "Protein shakes",
          product: "Shake",
          budget: 5000,
          risk: "low",
        },
        artifacts: {},
        config: {
          runsDir: "/tmp",
          runTokenBudget: 50_000,
          runCostCapUsd: 2,
          maxRetriesPerStage: 2,
        },
        telemetry: {} as never,
        retryCounts: {},
      },
    );

    expect(creators.length).toBeGreaterThanOrEqual(5);
    expect(new Set(creators.map((creator) => creator.platform)).size).toBeGreaterThanOrEqual(
      2,
    );
    expect(creators.every((creator) => creator.source === "seed")).toBe(true);
  });
});
