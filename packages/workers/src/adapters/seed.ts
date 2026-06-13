import { readFile } from "node:fs/promises";
import type {
  CreatorCandidate,
  CreatorCandidates,
  ICPProposal,
  ProductBrief,
} from "@scout/shared";
import { CreatorCandidateSchema } from "@scout/shared";
import type { HarnessContext } from "@scout/harness";

export interface SeedCreatorRecord {
  id: string;
  handle: string;
  platform: string;
  audienceTags: string[];
  estimatedRate: number;
  engagementRate: number;
  followerCount: number;
  scandalFlag: boolean;
  trendingScore: number;
}

export interface ResearchQuery {
  icp: ICPProposal;
  product: ProductBrief;
  platforms: string[];
  maxResults: number;
  /** Optional brief hint — used for creator-type discovery, not product copy. */
  targetAudience?: string;
}

export interface SeedAdapter {
  name: string;
  discover(
    query: ResearchQuery,
    ctx: HarnessContext,
  ): Promise<CreatorCandidate[]>;
}

export interface SeedAdapterOptions {
  creatorsPath: string;
  loadCreators?: (path: string) => Promise<SeedCreatorRecord[]>;
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

export function extractIcpKeywords(icp: ICPProposal): Set<string> {
  const keywords = new Set<string>();

  for (const segment of icp.segments) {
    for (const channel of segment.channels) {
      keywords.add(normalizeToken(channel));
    }

    for (const token of segment.persona.split(/\W+/)) {
      if (token.length > 2) keywords.add(normalizeToken(token));
    }

    for (const token of segment.rationale.split(/\W+/)) {
      if (token.length > 3) keywords.add(normalizeToken(token));
    }
  }

  return keywords;
}

export function resolveResearchPlatforms(
  ctx: HarnessContext,
  icp: ICPProposal,
): string[] {
  const allowlist = ctx.clientBrief.platformAllowlist;
  if (allowlist?.length) {
    return allowlist.map(normalizeToken);
  }

  const platforms = new Set<string>();
  for (const segment of icp.segments) {
    for (const channel of segment.channels) {
      platforms.add(normalizeToken(channel));
    }
  }
  return [...platforms];
}

function tagOverlapScore(
  creatorTags: string[],
  icpKeywords: Set<string>,
): number {
  const normalizedTags = creatorTags.map(normalizeToken);
  return normalizedTags.filter((tag) => icpKeywords.has(tag)).length;
}

export function createSeedAdapter(options: SeedAdapterOptions): SeedAdapter {
  const loadCreators =
    options.loadCreators ??
    (async (path: string) => {
      const raw = await readFile(path, "utf8");
      return JSON.parse(raw) as SeedCreatorRecord[];
    });

  return {
    name: "seed",
    async discover(query, _ctx) {
      const records = await loadCreators(options.creatorsPath);
      const icpKeywords = extractIcpKeywords(query.icp);
      const allowedPlatforms = new Set(
        query.platforms.map(normalizeToken),
      );

      const matched = records
        .filter((record) => {
          if (
            allowedPlatforms.size > 0 &&
            !allowedPlatforms.has(normalizeToken(record.platform))
          ) {
            return false;
          }

          return tagOverlapScore(record.audienceTags, icpKeywords) > 0;
        })
        .map((record) => ({
          record,
          overlap: tagOverlapScore(record.audienceTags, icpKeywords),
        }))
        .sort((a, b) => {
          if (b.overlap !== a.overlap) return b.overlap - a.overlap;
          return b.record.engagementRate - a.record.engagementRate;
        })
        .slice(0, query.maxResults)
        .map(({ record }) =>
          CreatorCandidateSchema.parse({
            id: record.id,
            handle: record.handle,
            platform: record.platform,
            followerCount: record.followerCount,
            engagementRate: record.engagementRate,
            estimatedRate: record.estimatedRate,
            audienceTags: record.audienceTags,
            scandalFlag: record.scandalFlag,
            trendingScore: record.trendingScore,
            source: "seed" as const,
          }),
        );

      return matched;
    },
  };
}

export type { CreatorCandidates };
