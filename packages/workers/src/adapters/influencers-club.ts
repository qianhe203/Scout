import type { CreatorCandidate } from "@scout/shared";
import { CreatorCandidateSchema } from "@scout/shared";
import type { ResearchQuery } from "./seed.js";
import { extractIcpKeywords } from "./seed.js";

const BASE_URL = "https://api-dashboard.influencers.club";

export interface InfluencersClubAdapter {
  name: string;
  discover(
    query: ResearchQuery,
    ctx?: { runId?: string },
  ): Promise<CreatorCandidate[]>;
}

export class InfluencersClubApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "InfluencersClubApiError";
  }
}

type FetchImpl = typeof fetch;

/** Platforms accepted by POST /public/v1/discovery/ — see docs.influencers.club/openapi/discovery-api */
export const DISCOVERY_API_PLATFORMS = [
  "instagram",
  "youtube",
  "tiktok",
  "twitter",
  "twitch",
  "onlyfans",
] as const;

export type DiscoveryApiPlatform = (typeof DISCOVERY_API_PLATFORMS)[number];

const DEFAULT_DISCOVERY_PLATFORMS: DiscoveryApiPlatform[] = [
  "instagram",
  "youtube",
  "tiktok",
  "twitter",
];

const ICP_TO_API_PLATFORM: Record<string, DiscoveryApiPlatform> = {
  instagram: "instagram",
  ig: "instagram",
  tiktok: "tiktok",
  youtube: "youtube",
  yt: "youtube",
  x: "twitter",
  twitter: "twitter",
  twitch: "twitch",
  threads: "instagram",
  onlyfans: "onlyfans",
};

export function mapPlatformToApi(platform: string): DiscoveryApiPlatform | null {
  const normalized = platform.trim().toLowerCase();
  if (ICP_TO_API_PLATFORM[normalized]) {
    return ICP_TO_API_PLATFORM[normalized];
  }
  if (
    DISCOVERY_API_PLATFORMS.includes(normalized as DiscoveryApiPlatform)
  ) {
    return normalized as DiscoveryApiPlatform;
  }
  return null;
}

/** Map ICP / brief channels to Influencers.club discovery platforms (LinkedIn is not supported). */
export function resolveDiscoveryPlatforms(platforms: string[]): DiscoveryApiPlatform[] {
  const resolved = new Set<DiscoveryApiPlatform>();
  for (const platform of platforms) {
    const mapped = mapPlatformToApi(platform);
    if (mapped) resolved.add(mapped);
  }

  if (resolved.size === 0) {
    return [...DEFAULT_DISCOVERY_PLATFORMS];
  }

  if (resolved.size === 1) {
    for (const fallback of DEFAULT_DISCOVERY_PLATFORMS) {
      resolved.add(fallback);
      if (resolved.size >= 2) break;
    }
  }

  return [...resolved];
}

export interface DiscoveryRequestBody {
  platform: DiscoveryApiPlatform;
  filters: Record<string, unknown>;
  paging: { limit: number; page: number };
}

/** Build a platform-valid POST /public/v1/discovery/ body per API contract. */
export function buildDiscoveryRequestBody(
  platform: DiscoveryApiPlatform,
  keywords: string[],
  limit: number,
  options?: { preferLinkedInCreators?: boolean },
): DiscoveryRequestBody {
  const followerRange = { min: 5_000, max: 750_000 };
  const linkedInFilter =
    options?.preferLinkedInCreators === true
      ? { creator_has: { has_linkedin: true } }
      : {};

  switch (platform) {
    case "youtube":
      return {
        platform,
        filters: {
          keywords_in_description: keywords,
          number_of_subscribers: followerRange,
          ...linkedInFilter,
        },
        paging: { limit, page: 0 },
      };
    case "twitter":
      return {
        platform,
        filters: {
          keywords_in_bio: keywords,
          keywords_in_tweets: keywords,
          number_of_followers: followerRange,
          ...linkedInFilter,
        },
        paging: { limit, page: 0 },
      };
    case "tiktok":
      return {
        platform,
        filters: {
          keywords_in_bio: keywords,
          number_of_followers: followerRange,
          ...linkedInFilter,
        },
        paging: { limit, page: 0 },
      };
    case "twitch":
      return {
        platform,
        filters: {
          keywords_in_description: keywords,
          ...linkedInFilter,
        },
        paging: { limit, page: 0 },
      };
    case "onlyfans":
      return {
        platform,
        filters: {
          ...linkedInFilter,
        },
        paging: { limit, page: 0 },
      };
    case "instagram":
    default:
      return {
        platform: "instagram",
        filters: {
          keywords_in_captions: keywords,
          number_of_followers: followerRange,
          ...linkedInFilter,
        },
        paging: { limit, page: 0 },
      };
  }
}

function icpMentionsLinkedIn(query: ResearchQuery): boolean {
  for (const segment of query.icp.segments) {
    for (const channel of segment.channels) {
      if (channel.toLowerCase().includes("linkedin")) return true;
    }
  }
  return query.platforms.some((p) => p.toLowerCase().includes("linkedin"));
}

function keywordsFromQuery(query: ResearchQuery): string[] {
  const icpKeywords = [...extractIcpKeywords(query.icp)];
  const segment =
    query.icp.segments[query.icp.recommendedPrimarySegment] ??
    query.icp.segments[0];
  const personaTokens = segment?.persona
    .split(/\s+/)
    .map((token) => token.replace(/[^\w-]/g, ""))
    .filter((token) => token.length >= 4)
    .slice(0, 4);

  const combined = [...new Set([...icpKeywords, ...(personaTokens ?? [])])];
  if (combined.length === 0) {
    combined.push(
      query.product.valueProposition.split(/\s+/).slice(0, 3).join(" "),
    );
  }
  return combined.slice(0, 6);
}

function normalizeCreator(
  raw: Record<string, unknown>,
  platform: string,
  index: number,
): CreatorCandidate | null {
  const handle =
    (raw.username as string | undefined) ??
    (raw.handle as string | undefined) ??
    (raw.profile_handle as string | undefined);
  if (!handle) return null;

  const followerCount = Number(
    raw.follower_count ??
      raw.followers ??
      raw.number_of_followers ??
      raw.subscriber_count ??
      0,
  );
  const engagementRate = Number(
    raw.engagement_rate ??
      raw.engagement_percent ??
      raw.engagement ??
      0.03,
  );
  const normalizedEngagement =
    engagementRate > 1 ? engagementRate / 100 : engagementRate;

  const id =
    (raw.id as string | undefined) ??
    (raw.creator_id as string | undefined) ??
    `ic_${platform}_${index}`;

  const audienceTags = Array.isArray(raw.audience_tags)
    ? (raw.audience_tags as string[])
    : Array.isArray(raw.niche_tags)
      ? (raw.niche_tags as string[])
      : keywordsFromQuery({
          icp: {
            segments: [
              {
                persona: String(raw.bio ?? raw.description ?? platform),
                demographics: "",
                channels: [platform],
                rationale: "",
                confidence: "medium",
                evidence: [],
              },
            ],
            clientAlignment: "no_client_input",
            recommendedPrimarySegment: 0,
            evidenceSourceTypes: [],
            icpRetryPasses: 0,
          },
          product: {
            valueProposition: "",
            differentiators: [],
            toneGuidance: "",
            keyMessages: [],
          },
          platforms: [platform],
          maxResults: 1,
        }).slice(0, 4);

  return CreatorCandidateSchema.parse({
    id,
    handle: handle.startsWith("@") ? handle : `@${handle}`,
    platform: platform.toLowerCase(),
    followerCount: Math.max(0, followerCount),
    engagementRate: Math.min(1, Math.max(0, normalizedEngagement)),
    estimatedRate: Math.max(
      200,
      Math.round(followerCount * normalizedEngagement * 0.015),
    ),
    audienceTags,
    scandalFlag: false,
    trendingScore: 0.5,
    source: "influencers_club" as const,
  });
}

function extractResults(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const candidates = [
    record.results,
    record.data,
    record.creators,
    record.items,
    record.profiles,
  ];
  for (const value of candidates) {
    if (Array.isArray(value)) {
      return value.filter(
        (item): item is Record<string, unknown> =>
          item != null && typeof item === "object",
      );
    }
  }
  return [];
}

export class InfluencersClubAdapterImpl implements InfluencersClubAdapter {
  readonly name = "influencers_club";

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: FetchImpl = fetch,
  ) {}

  async discover(query: ResearchQuery): Promise<CreatorCandidate[]> {
    const keywords = keywordsFromQuery(query);
    const apiPlatforms = resolveDiscoveryPlatforms(query.platforms);
    const preferLinkedInCreators = icpMentionsLinkedIn(query);
    const perPlatform = Math.max(
      3,
      Math.ceil(query.maxResults / Math.max(apiPlatforms.length, 1)),
    );
    const creators: CreatorCandidate[] = [];

    for (const platform of apiPlatforms) {
      const body = buildDiscoveryRequestBody(
        platform,
        keywords,
        perPlatform,
        { preferLinkedInCreators },
      );

      const response = await this.fetchImpl(
        `${BASE_URL}/public/v1/discovery/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        const text = await response.text();
        throw new InfluencersClubApiError(
          `Influencers.club discovery failed (${response.status}) for platform "${body.platform}": ${text.slice(0, 300)}`,
          response.status,
        );
      }

      const payload = (await response.json()) as unknown;
      const rows = extractResults(payload);
      for (const [index, row] of rows.entries()) {
        const normalized = normalizeCreator(
          row,
          body.platform,
          creators.length + index,
        );
        if (normalized) creators.push(normalized);
      }
    }

    const deduped = new Map<string, CreatorCandidate>();
    for (const creator of creators) {
      deduped.set(`${creator.platform}:${creator.handle}`, creator);
    }

    return [...deduped.values()].slice(0, query.maxResults);
  }
}

export class MockInfluencersClubAdapter implements InfluencersClubAdapter {
  readonly name = "mock_influencers_club";
  readonly calls: ResearchQuery[] = [];

  constructor(private readonly results: CreatorCandidate[] = []) {}

  async discover(query: ResearchQuery): Promise<CreatorCandidate[]> {
    this.calls.push(query);
    return this.results.slice(0, query.maxResults);
  }
}

export function createInfluencersClubAdapterFromEnv(
  fetchImpl: FetchImpl = fetch,
): InfluencersClubAdapter | null {
  const apiKey = process.env.INFLUENCERS_CLUB_API_KEY?.trim();
  if (!apiKey) return null;
  return new InfluencersClubAdapterImpl(apiKey, fetchImpl);
}
