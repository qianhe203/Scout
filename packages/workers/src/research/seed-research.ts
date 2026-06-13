import type { CreatorCandidates, ICPProposal, ProductBrief } from "@scout/shared";
import { CreatorCandidatesSchema } from "@scout/shared";
import type { HarnessContext, Worker } from "@scout/harness";
import {
  createSeedAdapter,
  resolveResearchPlatforms,
  type SeedAdapter,
} from "../adapters/seed.js";

export interface SeedResearchWorkerOptions {
  creatorsPath: string;
  adapter?: SeedAdapter;
  maxResults?: number;
}

function requireArtifact<T>(ctx: HarnessContext, type: string): T {
  const artifact = ctx.artifacts[type];
  if (!artifact) {
    throw new Error(`SeedResearchWorker requires ${type} artifact`);
  }
  return artifact.data as T;
}

export class SeedResearchWorker implements Worker {
  readonly name = "SeedResearchWorker";
  private readonly adapter: SeedAdapter;
  private readonly maxResults: number;

  constructor(options: SeedResearchWorkerOptions) {
    this.adapter =
      options.adapter ??
      createSeedAdapter({ creatorsPath: options.creatorsPath });
    this.maxResults = options.maxResults ?? 20;
  }

  async run(ctx: HarnessContext): Promise<CreatorCandidates> {
    const icp = requireArtifact<ICPProposal>(ctx, "ICPProposal");
    const product = requireArtifact<ProductBrief>(ctx, "ProductBrief");
    const platforms = resolveResearchPlatforms(ctx, icp);

    const creators = await this.adapter.discover(
      {
        icp,
        product,
        platforms,
        maxResults: this.maxResults,
      },
      ctx,
    );

    return CreatorCandidatesSchema.parse({ creators });
  }
}
