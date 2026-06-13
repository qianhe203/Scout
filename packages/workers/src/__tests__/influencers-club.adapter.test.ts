import { describe, expect, it, vi } from "vitest";
import type { CreatorCandidate } from "@scout/shared";
import {
  InfluencersClubAdapterImpl,
  InfluencersClubApiError,
} from "../adapters/influencers-club.js";
import type { ResearchQuery } from "../adapters/seed.js";
import { seedPipelineICP, seedPipelineProductBrief } from "../fixtures/seed-pipeline.js";

const sampleQuery: ResearchQuery = {
  icp: seedPipelineICP,
  product: seedPipelineProductBrief,
  platforms: ["instagram", "tiktok"],
  maxResults: 5,
};

describe("InfluencersClubAdapterImpl", () => {
  it("normalizes API response to CreatorCandidate[]", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            username: "fit_creator",
            follower_count: 42000,
            engagement_percent: 4.2,
            audience_tags: ["fitness", "wellness"],
          },
        ],
      }),
    });

    const adapter = new InfluencersClubAdapterImpl("test-key", fetchImpl);
    const creators = await adapter.discover(sampleQuery);

    expect(creators.length).toBeGreaterThan(0);
    expect(creators[0]).toMatchObject({
      handle: "@fit_creator",
      platform: "instagram",
      source: "influencers_club",
    } satisfies Partial<CreatorCandidate>);
  });

  it("throws InfluencersClubApiError on HTTP failure", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "service unavailable",
    });

    const adapter = new InfluencersClubAdapterImpl("test-key", fetchImpl);
    await expect(adapter.discover(sampleQuery)).rejects.toBeInstanceOf(
      InfluencersClubApiError,
    );
  });
});
