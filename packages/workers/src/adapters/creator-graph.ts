import { readFile } from "node:fs/promises";
import type { ClientBrief } from "@scout/shared";
import type { SeedCreatorRecord } from "./seed.js";

export interface CreatorGraphResult {
  audienceTags: string[];
  topCreatorHandles: string[];
  rationale: string;
}

export interface CreatorGraphAdapter {
  name: string;
  infer(brief: ClientBrief): Promise<CreatorGraphResult>;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\W+/)
      .filter((token) => token.length > 2),
  );
}

function scoreCreator(
  creator: SeedCreatorRecord,
  queryTokens: Set<string>,
): number {
  let score = 0;
  for (const tag of creator.audienceTags) {
    const normalized = tag.toLowerCase();
    if (queryTokens.has(normalized)) score += 3;
    for (const token of queryTokens) {
      if (normalized.includes(token) || token.includes(normalized)) score += 1;
    }
  }
  return score;
}

export class SeedCreatorGraphAdapter implements CreatorGraphAdapter {
  name = "seed-creator-graph";

  constructor(
    private readonly options: {
      creatorsPath: string;
      loadCreators?: (path: string) => Promise<SeedCreatorRecord[]>;
    },
  ) {}

  private async load(): Promise<SeedCreatorRecord[]> {
    if (this.options.loadCreators) {
      return this.options.loadCreators(this.options.creatorsPath);
    }
    const raw = await readFile(this.options.creatorsPath, "utf8");
    return JSON.parse(raw) as SeedCreatorRecord[];
  }

  async infer(brief: ClientBrief): Promise<CreatorGraphResult> {
    const creators = await this.load();
    const queryText = [
      brief.company,
      brief.product,
      brief.companyDescription,
      brief.targetAudience ?? "",
      brief.whyTheyBuy ?? "",
    ].join(" ");
    const queryTokens = tokenize(queryText);

    const ranked = creators
      .map((creator) => ({ creator, score: scoreCreator(creator, queryTokens) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (ranked.length === 0) {
      return {
        audienceTags: [],
        topCreatorHandles: [],
        rationale: "No seed creators matched the product description",
      };
    }

    const tagCounts = new Map<string, number>();
    for (const { creator } of ranked) {
      for (const tag of creator.audienceTags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }

    const audienceTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag]) => tag);

    return {
      audienceTags,
      topCreatorHandles: ranked.map(({ creator }) => creator.handle),
      rationale: `Top matching creators cluster around ${audienceTags.slice(0, 3).join(", ")} audiences`,
    };
  }
}

export class MockCreatorGraphAdapter implements CreatorGraphAdapter {
  name = "mock-creator-graph";

  constructor(private readonly result: CreatorGraphResult) {}

  async infer(_brief: ClientBrief): Promise<CreatorGraphResult> {
    return this.result;
  }
}

export function createCreatorGraphAdapterFromEnv(
  options: { creatorsPath?: string } = {},
): CreatorGraphAdapter {
  if (!options.creatorsPath) {
    return new MockCreatorGraphAdapter({
      audienceTags: [],
      topCreatorHandles: [],
      rationale: "Creator graph unavailable without creatorsPath",
    });
  }
  return new SeedCreatorGraphAdapter({ creatorsPath: options.creatorsPath });
}
