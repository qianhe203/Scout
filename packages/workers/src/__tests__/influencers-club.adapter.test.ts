import { describe, expect, it, vi } from "vitest";
import type { CreatorCandidate } from "@scout/shared";
import {
  AI_SEARCH_MAX_BROAD,
  AI_SEARCH_MAX_MINIMAL,
  DISCOVERY_API_PLATFORMS,
  DISCOVERY_MAX_API_CALLS,
  InfluencersClubAdapterImpl,
  InfluencersClubApiError,
  aiSearchPromptFromQuery,
  buildDiscoveryRequestBody,
  discoveryRetryEnabled,
  mapPlatformToApi,
  pickDiscoveryPlatforms,
  resolveDiscoveryPlatforms,
  searchKeywordsFromQuery,
} from "../adapters/influencers-club.js";
import type { ResearchQuery } from "../adapters/seed.js";
import { seedPipelineICP, seedPipelineProductBrief } from "../fixtures/seed-pipeline.js";

const sampleQuery: ResearchQuery = {
  icp: seedPipelineICP,
  product: seedPipelineProductBrief,
  platforms: ["instagram", "tiktok"],
  maxResults: 5,
};

const hairClipQuery: ResearchQuery = {
  icp: {
    segments: [
      {
        persona: "Style-conscious millennials",
        demographics: "22-35, fashion-forward",
        channels: ["instagram", "tiktok"],
        rationale: "Hair accessory buyers follow style creators",
        confidence: "high",
        evidence: [],
      },
    ],
    clientAlignment: "no_client_input",
    recommendedPrimarySegment: 0,
    evidenceSourceTypes: [],
    icpRetryPasses: 0,
  },
  product: {
    valueProposition:
      "Premium hair clips designed for style-conscious millennials, combining cute aesthetics with unparalleled durability, perfect for everyday use.",
    differentiators: ["Cute + durable"],
    toneGuidance: "Playful",
    keyMessages: [
      "The SuperClip seamlessly blends cuteness with serious hold, making bad hair days impossible.",
    ],
  },
  platforms: ["instagram"],
  maxResults: 10,
};

describe("InfluencersClubAdapterImpl", () => {
  it("caps broad ai_search at 100 chars with high-signal tokens only", () => {
    const aiSearch = aiSearchPromptFromQuery(hairClipQuery, "broad");
    expect(aiSearch.length).toBeLessThanOrEqual(AI_SEARCH_MAX_BROAD);
    expect(aiSearch).not.toMatch(/designed|combining|perfect|everyday|seamlessly/i);
    expect(aiSearch).toMatch(/hair|clip|millennial|style/i);
  });

  it("caps minimal ai_search at 50 chars on retry", () => {
    const broad = aiSearchPromptFromQuery(hairClipQuery, "broad");
    const minimal = aiSearchPromptFromQuery(hairClipQuery, "minimal");
    expect(minimal.length).toBeLessThanOrEqual(AI_SEARCH_MAX_MINIMAL);
    expect(minimal.length).toBeLessThanOrEqual(broad.length);
  });
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

  it("limits search to two platforms for credit conservation", () => {
    expect(pickDiscoveryPlatforms(["instagram", "youtube", "tiktok", "twitter"])).toEqual(
      ["instagram", "youtube"],
    );
  });

  it("excludes channel names from keyword search", () => {
    const keywords = searchKeywordsFromQuery({
      ...sampleQuery,
      icp: {
        ...seedPipelineICP,
        segments: [
          {
            persona: "Tech executives on LinkedIn seeking AI talent",
            demographics: "",
            channels: ["linkedin", "twitter"],
            rationale: "B2B audience on professional networks",
            confidence: "high",
            evidence: [],
          },
        ],
      },
    });

    expect(keywords).not.toContain("linkedin");
    expect(keywords.some((k) => k.includes("execut") || k.includes("talent"))).toBe(
      true,
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
    expect(fetchImpl.mock.calls.length).toBeLessThanOrEqual(DISCOVERY_MAX_API_CALLS);
    for (const [url, init] of fetchImpl.mock.calls) {
      expect(url).toBe("https://api-dashboard.influencers.club/public/v1/discovery/");
      const body = JSON.parse(String(init?.body));
      expect(body.platform).not.toBe("linkedin");
      expect(DISCOVERY_API_PLATFORMS).toContain(body.platform);
    }
  });

  it("uses broad ai_search on first pass and minimal filters on retry", async () => {
    vi.stubEnv("INFLUENCERS_CLUB_RETRY", "true");
    try {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [{ username: "broad_creator", follower_count: 12000 }],
          }),
        });

      const adapter = new InfluencersClubAdapterImpl("test-key", fetchImpl);
      const creators = await adapter.discover({
        ...sampleQuery,
        platforms: ["instagram", "youtube"],
      });

      expect(fetchImpl).toHaveBeenCalledTimes(3);
      const firstBody = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
      const lastBody = JSON.parse(String(fetchImpl.mock.calls[2]?.[1]?.body));

      expect(firstBody.filters.ai_search).toBeTruthy();
      expect(String(firstBody.filters.ai_search).length).toBeLessThanOrEqual(
        AI_SEARCH_MAX_BROAD,
      );
      expect(lastBody.filters.number_of_followers).toEqual({
        min: 1_000,
        max: 5_000_000,
      });
      expect(lastBody.filters.ai_search).toBeTruthy();
      expect(String(lastBody.filters.ai_search).length).toBeLessThanOrEqual(
        AI_SEARCH_MAX_MINIMAL,
      );
      expect(creators).toHaveLength(1);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("skips minimal retry when INFLUENCERS_CLUB_RETRY is unset", async () => {
    vi.stubEnv("INFLUENCERS_CLUB_RETRY", "");
    try {
      expect(discoveryRetryEnabled()).toBe(false);

      const fetchImpl = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      });

      const adapter = new InfluencersClubAdapterImpl("test-key", fetchImpl);
      await adapter.discover({
        ...sampleQuery,
        platforms: ["instagram", "youtube"],
      });

      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("uses platform-specific filters from the API contract", () => {
    expect(
      buildDiscoveryRequestBody("youtube", sampleQuery, 5, "broad"),
    ).toMatchObject({
      platform: "youtube",
      filters: {
        ai_search: aiSearchPromptFromQuery(sampleQuery),
        number_of_subscribers: { min: 1_000, max: 2_000_000 },
      },
      paging: { limit: 5, page: 0 },
    });

    expect(
      buildDiscoveryRequestBody("twitter", sampleQuery, 5, "minimal"),
    ).toMatchObject({
      platform: "twitter",
      filters: {
        ai_search: aiSearchPromptFromQuery(sampleQuery, "minimal"),
        number_of_followers: { min: 1_000, max: 5_000_000 },
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
