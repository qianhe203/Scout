import type { CreatorCandidate } from "@scout/shared";
import { CreatorCandidateSchema } from "@scout/shared";
import type { ResearchQuery } from "./seed.js";

const BASE_URL = "https://api-dashboard.influencers.club";

/** Max discovery API calls per ResearchWorker run when retry is enabled. */
export const DISCOVERY_MAX_API_CALLS = 3;

function discoveryDebugEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.INFLUENCERS_CLUB_DEBUG === "true" || env.INFLUENCERS_CLUB_DEBUG === "1";
}

/** On by default — set INFLUENCERS_CLUB_RETRY=false to disable minimal retry pass. */
export function discoveryRetryEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = env.INFLUENCERS_CLUB_RETRY?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "no") return false;
  return true;
}

function logDiscoveryRequest(
  body: DiscoveryRequestBody,
  meta: { call: number; tier: DiscoverySearchTier },
): void {
  if (!discoveryDebugEnabled()) return;
  console.log(
    `[scout:influencers-club] POST /public/v1/discovery/ (call ${meta.call}, ${meta.tier})\n` +
      JSON.stringify(body, null, 2),
  );
}

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

const PLATFORM_SEARCH_PRIORITY: DiscoveryApiPlatform[] = [
  "instagram",
  "youtube",
  "tiktok",
  "twitter",
];

const CHANNEL_KEYWORDS = new Set([
  "linkedin",
  "twitter",
  "instagram",
  "youtube",
  "tiktok",
  "github",
  "facebook",
  "twitch",
  "threads",
  "newsletters",
  "conferences",
  "blogs",
  "forums",
]);

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

/** Influencers.club hard limit for ai_search (we stay well under). */
export const AI_SEARCH_API_MAX = 150;
export const AI_SEARCH_MAX_WORDS_BROAD = 6;
export const AI_SEARCH_MAX_WORDS_MINIMAL = 3;

const AI_SEARCH_STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "with",
  "who",
  "that",
  "this",
  "are",
  "is",
  "was",
  "be",
  "to",
  "in",
  "on",
  "at",
  "by",
  "of",
  "from",
  "as",
  "it",
  "their",
  "they",
  "we",
  "our",
  "your",
  "designed",
  "combining",
  "perfect",
  "everyday",
  "making",
  "seamlessly",
  "blends",
  "unparalleled",
  "premium",
  "seeking",
  "want",
  "without",
  "sacrificing",
  "trusted",
  "value",
  "very",
  "really",
  "just",
  "also",
  "about",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "under",
  "over",
  "such",
  "both",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "than",
  "then",
  "too",
  "can",
  "will",
  "has",
  "have",
  "had",
  "not",
  "but",
  "all",
  "any",
  "only",
  "own",
  "same",
  "so",
  "use",
  "used",
  "using",
  "buyers",
  "buy",
  "follow",
  "content",
  "creator",
  "creators",
  "influencer",
  "influencers",
  "audience",
  "partner",
  "partners",
  "discovery",
  "conversions",
  "conversion",
]);

export type DiscoverySearchTier = "broad" | "minimal";

function aiSearchWordLimitForTier(tier: DiscoverySearchTier): number {
  return tier === "minimal"
    ? AI_SEARCH_MAX_WORDS_MINIMAL
    : AI_SEARCH_MAX_WORDS_BROAD;
}

function extractAiSearchTokens(text: string): string[] {
  const tokens: string[] = [];
  for (const token of text.split(/\W+/)) {
    const normalized = token.toLowerCase().replace(/[^\w-]/g, "");
    if (
      normalized.length >= 3 &&
      !AI_SEARCH_STOP_WORDS.has(normalized) &&
      !CHANNEL_KEYWORDS.has(normalized)
    ) {
      tokens.push(normalized);
    }
  }
  return tokens;
}

function dedupeTokens(tokens: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    deduped.push(token);
  }
  return deduped;
}

function truncateAiSearch(text: string, maxLen: number): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxLen) return trimmed;

  const cut = trimmed.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > maxLen * 0.45) {
    return cut.slice(0, lastSpace).trim();
  }
  return cut.trim();
}

function creatorSearchTokens(query: ResearchQuery): string[] {
  const segment = primarySegment(query);
  const fromPersona = extractAiSearchTokens(segment?.persona ?? "");
  const fromDemographics = extractAiSearchTokens(segment?.demographics ?? "");
  const fromAudience = extractAiSearchTokens(query.targetAudience ?? "");

  return dedupeTokens([...fromPersona, ...fromDemographics, ...fromAudience]);
}

function buildCompactAiSearch(
  query: ResearchQuery,
  tier: DiscoverySearchTier,
): string {
  const maxWords = aiSearchWordLimitForTier(tier);
  const tokens = creatorSearchTokens(query);

  if (tokens.length === 0) {
    const fallback = truncateAiSearch(
      primarySegment(query)?.persona ?? query.targetAudience ?? "lifestyle creator",
      AI_SEARCH_API_MAX,
    );
    return fallback.split(/\s+/).slice(0, maxWords).join(" ");
  }

  const phrase = tokens.slice(0, maxWords).join(" ");
  if (phrase.length <= AI_SEARCH_API_MAX) return phrase;
  return truncateAiSearch(phrase, AI_SEARCH_API_MAX);
}

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

/** Pick at most two platforms to conserve discovery credits. */
export function pickDiscoveryPlatforms(
  platforms: string[],
): DiscoveryApiPlatform[] {
  const resolved = resolveDiscoveryPlatforms(platforms);
  const picked: DiscoveryApiPlatform[] = [];

  for (const platform of PLATFORM_SEARCH_PRIORITY) {
    if (resolved.includes(platform) && picked.length < 2) {
      picked.push(platform);
    }
  }

  for (const platform of resolved) {
    if (!picked.includes(platform) && picked.length < 2) {
      picked.push(platform);
    }
  }

  return picked.length > 0 ? picked : ["instagram", "youtube"];
}

export interface DiscoveryRequestBody {
  platform: DiscoveryApiPlatform;
  filters: Record<string, unknown>;
  paging: { limit: number; page: number };
}

function primarySegment(query: ResearchQuery) {
  return (
    query.icp.segments[query.icp.recommendedPrimarySegment] ??
    query.icp.segments[0]
  );
}

/** Compact creator-type search — broad: 6 words, minimal retry: 3 words. */
export function aiSearchPromptFromQuery(
  query: ResearchQuery,
  tier: DiscoverySearchTier = "broad",
): string {
  const aiSearch = buildCompactAiSearch(query, tier);
  const maxWords = aiSearchWordLimitForTier(tier);
  const wordCount = aiSearch.split(/\s+/).filter(Boolean).length;

  if (aiSearch.length > AI_SEARCH_API_MAX) {
    throw new Error(
      `ai_search exceeds Influencers.club limit (${aiSearch.length} > ${AI_SEARCH_API_MAX})`,
    );
  }
  if (wordCount > maxWords) {
    throw new Error(
      `ai_search exceeds tier word limit (${wordCount} > ${maxWords})`,
    );
  }
  return aiSearch;
}

/** Short keyword list — persona/product tokens only (not ICP channel names). */
export function searchKeywordsFromQuery(query: ResearchQuery): string[] {
  const segment = primarySegment(query);
  const tokens = new Set<string>();

  for (const token of (segment?.persona ?? "").split(/\W+/)) {
    const normalized = token.toLowerCase().replace(/[^\w-]/g, "");
    if (normalized.length >= 4 && !CHANNEL_KEYWORDS.has(normalized)) {
      tokens.add(normalized);
    }
  }

  for (const token of query.product.valueProposition.split(/\W+/)) {
    const normalized = token.toLowerCase().replace(/[^\w-]/g, "");
    if (normalized.length >= 4 && !CHANNEL_KEYWORDS.has(normalized)) {
      tokens.add(normalized);
    }
  }

  return [...tokens].slice(0, 2);
}

function followerRangeForTier(tier: DiscoverySearchTier) {
  if (tier === "minimal") {
    return { min: 1_000, max: 5_000_000 };
  }
  return { min: 1_000, max: 2_000_000 };
}

/** Build POST /public/v1/discovery/ body — broad first, minimal on retry. */
export function buildDiscoveryRequestBody(
  platform: DiscoveryApiPlatform,
  query: ResearchQuery,
  limit: number,
  tier: DiscoverySearchTier,
): DiscoveryRequestBody {
  const aiSearch = aiSearchPromptFromQuery(query, tier);
  const keywords = searchKeywordsFromQuery(query);
  const paging = { limit, page: 0 };

  if (tier === "minimal") {
    return buildMinimalDiscoveryBody(platform, query, paging);
  }

  const followers = followerRangeForTier("broad");

  switch (platform) {
    case "youtube":
      return {
        platform,
        filters: {
          ai_search: aiSearch,
          ...(keywords.length > 0
            ? { keywords_in_description: keywords.slice(0, 1) }
            : {}),
          number_of_subscribers: followers,
        },
        paging,
      };
    case "twitter":
      return {
        platform,
        filters: {
          ai_search: aiSearch,
          ...(keywords.length > 0 ? { keywords_in_bio: keywords.slice(0, 1) } : {}),
          number_of_followers: followers,
        },
        paging,
      };
    case "tiktok":
      return {
        platform,
        filters: {
          ai_search: aiSearch,
          ...(keywords.length > 0 ? { keywords_in_bio: keywords.slice(0, 1) } : {}),
          number_of_followers: followers,
        },
        paging,
      };
    case "twitch":
      return {
        platform,
        filters: {
          ai_search: aiSearch,
          ...(keywords.length > 0
            ? { keywords_in_description: keywords.slice(0, 1) }
            : {}),
        },
        paging,
      };
    case "onlyfans":
      return {
        platform,
        filters: { ai_search: aiSearch },
        paging,
      };
    case "instagram":
    default:
      return {
        platform: "instagram",
        filters: {
          ai_search: aiSearch,
          ...(keywords.length > 0
            ? { keywords_in_bio: keywords.slice(0, 1) }
            : {}),
          number_of_followers: followers,
        },
        paging,
      };
  }
}

function buildMinimalDiscoveryBody(
  platform: DiscoveryApiPlatform,
  query: ResearchQuery,
  paging: { limit: number; page: number },
): DiscoveryRequestBody {
  const followers = followerRangeForTier("minimal");
  const aiSearch = aiSearchPromptFromQuery(query, "minimal");

  switch (platform) {
    case "youtube":
      return {
        platform,
        filters: {
          ai_search: aiSearch,
          number_of_subscribers: followers,
        },
        paging,
      };
    case "twitter":
    case "tiktok":
    case "instagram":
      return {
        platform: platform === "instagram" ? "instagram" : platform,
        filters: {
          ai_search: aiSearch,
          number_of_followers: followers,
        },
        paging,
      };
    case "twitch":
    case "onlyfans":
      return {
        platform,
        filters: { ai_search: aiSearch },
        paging,
      };
    default:
      return { platform, filters: { ai_search: aiSearch }, paging };
  }
}

function normalizeCreator(
  raw: Record<string, unknown>,
  platform: string,
  index: number,
  fallbackTags: string[],
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
      : fallbackTags.slice(0, 4);

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

  private async fetchCreators(
    body: DiscoveryRequestBody,
    fallbackTags: string[],
    meta: { call: number; tier: DiscoverySearchTier },
  ): Promise<CreatorCandidate[]> {
    logDiscoveryRequest(body, meta);

    const response = await this.fetchImpl(`${BASE_URL}/public/v1/discovery/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new InfluencersClubApiError(
        `Influencers.club discovery failed (${response.status}) for platform "${body.platform}": ${text.slice(0, 300)}`,
        response.status,
      );
    }

    const payload = (await response.json()) as unknown;
    const rows = extractResults(payload);
    const creators = rows
      .map((row, index) =>
        normalizeCreator(row, body.platform, index, fallbackTags),
      )
      .filter((creator): creator is CreatorCandidate => creator != null);

    if (discoveryDebugEnabled()) {
      console.log(
        `[scout:influencers-club] ${body.platform} (${meta.tier}) → ${creators.length} creator(s)`,
      );
    }

    return creators;
  }

  async discover(query: ResearchQuery): Promise<CreatorCandidate[]> {
    const apiPlatforms = pickDiscoveryPlatforms(query.platforms);
    const perPlatform = Math.max(
      5,
      Math.ceil(query.maxResults / Math.max(apiPlatforms.length, 1)),
    );
    const fallbackTags = searchKeywordsFromQuery(query);
    const creators: CreatorCandidate[] = [];
    let apiCalls = 0;

    for (const platform of apiPlatforms) {
      if (apiCalls >= DISCOVERY_MAX_API_CALLS) break;

      const broad = buildDiscoveryRequestBody(
        platform,
        query,
        perPlatform,
        "broad",
      );
      creators.push(
        ...(await this.fetchCreators(broad, fallbackTags, {
          call: apiCalls + 1,
          tier: "broad",
        })),
      );
      apiCalls += 1;
    }

    if (
      discoveryRetryEnabled() &&
      creators.length === 0 &&
      apiCalls < DISCOVERY_MAX_API_CALLS
    ) {
      const retryPlatform = apiPlatforms[0] ?? "instagram";
      const minimal = buildDiscoveryRequestBody(
        retryPlatform,
        query,
        perPlatform,
        "minimal",
      );
      creators.push(
        ...(await this.fetchCreators(minimal, fallbackTags, {
          call: apiCalls + 1,
          tier: "minimal",
        })),
      );
      apiCalls += 1;
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
