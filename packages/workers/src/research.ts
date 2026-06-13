import type { CreatorCandidates, ICPProposal, ProductBrief } from "@scout/shared";
import { CreatorCandidatesSchema } from "@scout/shared";
import type { HarnessContext, Worker } from "@scout/harness";
import {
  createSeedAdapter,
  resolveResearchPlatforms,
  type SeedAdapter,
} from "./adapters/seed.js";
import {
  createInfluencersClubAdapterFromEnv,
  InfluencersClubApiError,
  type InfluencersClubAdapter,
} from "./adapters/influencers-club.js";

export interface ResearchWorkerOptions {
  influencersClub?: InfluencersClubAdapter | null;
  seed?: SeedAdapter;
  creatorsPath: string;
  maxResults?: number;
}

function requireArtifact<T>(ctx: HarnessContext, type: string): T {
  const artifact = ctx.artifacts[type];
  if (!artifact) {
    throw new Error(`ResearchWorker requires ${type} artifact`);
  }
  return artifact.data as T;
}

export class ResearchWorker implements Worker {
  readonly name = "ResearchWorker";
  private readonly influencersClub: InfluencersClubAdapter | null;
  private readonly seed: SeedAdapter;
  private readonly maxResults: number;

  constructor(options: ResearchWorkerOptions) {
    this.influencersClub =
      options.influencersClub === undefined
        ? createInfluencersClubAdapterFromEnv()
        : options.influencersClub;
    this.seed =
      options.seed ??
      createSeedAdapter({ creatorsPath: options.creatorsPath });
    this.maxResults = options.maxResults ?? 20;
  }

  async run(ctx: HarnessContext): Promise<CreatorCandidates> {
    const icp = requireArtifact<ICPProposal>(ctx, "ICPProposal");
    const product = requireArtifact<ProductBrief>(ctx, "ProductBrief");
    const platforms = resolveResearchPlatforms(ctx, icp);
    const query = {
      icp,
      product,
      platforms,
      maxResults: this.maxResults,
      targetAudience: ctx.clientBrief.targetAudience,
    };

    if (this.influencersClub) {
      try {
        const creators = await this.influencersClub.discover(query, {
          runId: ctx.runId,
        });
        if (creators.length > 0) {
          return CreatorCandidatesSchema.parse({ creators });
        }
      } catch (error) {
        const message =
          error instanceof InfluencersClubApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : String(error);

        await ctx.emitAlarm?.({
          type: "RESEARCH_SOURCE_DOWN",
          severity: "medium",
          context: { source: "influencers_club", message },
          recommended_action:
            "Using seed adapter fallback; check platform mapping and INFLUENCERS_CLUB_API_KEY",
          timestamp: new Date().toISOString(),
        });
      }
    }

    const creators = await this.seed.discover(query, ctx);
    return CreatorCandidatesSchema.parse({ creators });
  }
}
