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

const PLATFORM_MAP: Record<string, string> = {
  instagram: "instagram",
  tiktok: "tiktok",
  youtube: "youtube",
  x: "twitter",
  twitter: "twitter",
  twitch: "twitch",
  threads: "instagram",
};

function mapPlatform(platform: string): string {
  return PLATFORM_MAP[platform.toLowerCase()] ?? platform.toLowerCase();
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
    const perPlatform = Math.max(
      3,
      Math.ceil(query.maxResults / Math.max(query.platforms.length, 1)),
    );
    const creators: CreatorCandidate[] = [];

    for (const platform of query.platforms) {
      const mapped = mapPlatform(platform);
      const body = {
        platform: mapped,
        filters: {
          keywords_in_captions: keywords,
          number_of_followers: { min: 5_000, max: 750_000 },
        },
        paging: { limit: perPlatform, page: 1 },
      };

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
          `Influencers.club discovery failed (${response.status}): ${text.slice(0, 200)}`,
          response.status,
        );
      }

      const payload = (await response.json()) as unknown;
      const rows = extractResults(payload);
      for (const [index, row] of rows.entries()) {
        const normalized = normalizeCreator(row, platform, creators.length + index);
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
