import { describe, expect, it, vi } from "vitest";
import type { CreatorCandidate } from "@scout/shared";
import {
  DISCOVERY_API_PLATFORMS,
  InfluencersClubAdapterImpl,
  InfluencersClubApiError,
  buildDiscoveryRequestBody,
  mapPlatformToApi,
  resolveDiscoveryPlatforms,
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
  it("maps ICP channels to supported discovery platforms", () => {
    expect(mapPlatformToApi("linkedin")).toBeNull();
    expect(mapPlatformToApi("github")).toBeNull();
    expect(mapPlatformToApi("twitter")).toBe("twitter");
    expect(mapPlatformToApi("x")).toBe("twitter");

    expect(
      resolveDiscoveryPlatforms([
        "linkedin",
        "twitter",
        "industry newsletters",
      ]),
    ).toEqual(["twitter", "instagram"]);
  });

  it("falls back to default platforms when ICP has no supported channels", () => {
    expect(resolveDiscoveryPlatforms(["linkedin", "github", "tech blogs"])).toEqual(
      ["instagram", "youtube", "tiktok", "twitter"],
    );
  });

  it("never sends linkedin as the discovery platform", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const adapter = new InfluencersClubAdapterImpl("test-key", fetchImpl);
    await adapter.discover({
      ...sampleQuery,
      platforms: ["linkedin", "github", "tech blogs"],
    });

    expect(fetchImpl).toHaveBeenCalled();
    for (const [url, init] of fetchImpl.mock.calls) {
      expect(url).toBe("https://api-dashboard.influencers.club/public/v1/discovery/");
      const body = JSON.parse(String(init?.body));
      expect(body.platform).not.toBe("linkedin");
      expect(DISCOVERY_API_PLATFORMS).toContain(body.platform);
    }
  });

  it("uses platform-specific filters from the API contract", () => {
    expect(buildDiscoveryRequestBody("youtube", ["saas"], 5)).toMatchObject({
      platform: "youtube",
      filters: {
        keywords_in_description: ["saas"],
        number_of_subscribers: { min: 5_000, max: 750_000 },
      },
      paging: { limit: 5, page: 0 },
    });

    expect(buildDiscoveryRequestBody("twitter", ["b2b"], 5)).toMatchObject({
      platform: "twitter",
      filters: {
        keywords_in_bio: ["b2b"],
        keywords_in_tweets: ["b2b"],
      },
    });
  });

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
