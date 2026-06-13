import type {
  CreatorCandidates,
  ICPProposal,
  ProductBrief,
  RankedShortlist,
} from "@scout/shared";
import { RankedShortlistSchema } from "@scout/shared";
import type { HarnessContext, Worker } from "@scout/harness";
import { extractIcpKeywords } from "../adapters/seed.js";

interface RubricWeights {
  audienceOverlap: number;
  engagementQuality: number;
  costEfficiency: number;
  platformFit: number;
  brandSafety: number;
}

function weightsForRisk(risk: "low" | "high"): RubricWeights {
  if (risk === "low") {
    return {
      audienceOverlap: 0.35,
      engagementQuality: 0.2,
      costEfficiency: 0.15,
      platformFit: 0.1,
      brandSafety: 0.2,
    };
  }

  return {
    audienceOverlap: 0.3,
    engagementQuality: 0.25,
    costEfficiency: 0.2,
    platformFit: 0.15,
    brandSafety: 0.1,
  };
}

function tagOverlapRatio(
  creatorTags: string[],
  icpKeywords: Set<string>,
): number {
  if (icpKeywords.size === 0) return 0;
  const normalizedTags = creatorTags.map((tag) => tag.toLowerCase());
  const overlap = normalizedTags.filter((tag) => icpKeywords.has(tag)).length;
  return overlap / icpKeywords.size;
}

function platformFitScore(
  platform: string,
  icp: ICPProposal,
): number {
  const primary = icp.segments[icp.recommendedPrimarySegment];
  if (!primary) return 0.5;
  return primary.channels.some(
    (channel) => channel.toLowerCase() === platform.toLowerCase(),
  )
    ? 1
    : 0.5;
}

function scoreCreator(
  candidate: CreatorCandidates["creators"][number],
  ctx: HarnessContext,
  icp: ICPProposal,
  product: ProductBrief,
): {
  fitScore: number;
  audienceOverlap: number;
  rationale: string;
} {
  const weights = weightsForRisk(ctx.clientBrief.risk);
  const icpKeywords = extractIcpKeywords(icp);
  const audienceOverlap = tagOverlapRatio(candidate.audienceTags, icpKeywords);
  const engagementQuality = Math.min(candidate.engagementRate / 0.08, 1);
  const costEfficiency = Math.max(
    0,
    1 - candidate.estimatedRate / Math.max(ctx.clientBrief.budget, 1),
  );
  const platformFit = platformFitScore(candidate.platform, icp);
  const brandSafety = candidate.scandalFlag ? 0 : 1;

  const composite =
    weights.audienceOverlap * audienceOverlap +
    weights.engagementQuality * engagementQuality +
    weights.costEfficiency * costEfficiency +
    weights.platformFit * platformFit +
    weights.brandSafety * brandSafety;

  const fitScore = Math.round(composite * 100);
  const rationale = `${candidate.handle} matches ${product.valueProposition.slice(0, 60)} with ${Math.round(audienceOverlap * 100)}% audience overlap on ${candidate.platform}`;

  return { fitScore, audienceOverlap, rationale };
}

function trimToBudget(
  ranked: RankedShortlist,
  budget: number,
  removeIds: string[] = [],
): RankedShortlist {
  let creators = ranked.creators.filter(
    (creator) => !removeIds.includes(creator.id),
  );

  creators = [...creators].sort((a, b) => b.fitScore - a.fitScore);

  const kept: RankedShortlist["creators"] = [];
  let total = 0;
  for (const creator of creators) {
    if (total + creator.estimatedCost <= budget) {
      kept.push(creator);
      total += creator.estimatedCost;
    }
  }

  if (kept.length === 0 && creators.length > 0) {
    const cheapest = [...creators].sort(
      (a, b) => a.estimatedCost - b.estimatedCost,
    )[0];
    kept.push(cheapest);
    total = cheapest.estimatedCost;
  }

  return {
    summary: `Budget-trimmed shortlist under $${budget}`,
    creators: kept,
    totalEstimatedCost: total,
  };
}

export class RuleBasedScoreWorker implements Worker {
  readonly name = "RuleBasedScoreWorker";

  async run(ctx: HarnessContext): Promise<RankedShortlist> {
    const candidatesArtifact = ctx.artifacts.CreatorCandidates;
    const icpArtifact = ctx.artifacts.ICPProposal;
    const productArtifact = ctx.artifacts.ProductBrief;

    if (!candidatesArtifact || !icpArtifact || !productArtifact) {
      throw new Error(
        "RuleBasedScoreWorker requires CreatorCandidates, ICPProposal, and ProductBrief",
      );
    }

    const candidates = candidatesArtifact.data as CreatorCandidates;
    const icp = icpArtifact.data as ICPProposal;
    const product = productArtifact.data as ProductBrief;

    const rankedCreators = candidates.creators
      .map((candidate) => {
        const scored = scoreCreator(candidate, ctx, icp, product);
        return {
          id: candidate.id,
          handle: candidate.handle,
          platform: candidate.platform,
          fitScore: scored.fitScore,
          rationale: scored.rationale,
          estimatedCost: candidate.estimatedRate,
          audienceOverlap: scored.audienceOverlap,
        };
      })
      .sort((a, b) => b.fitScore - a.fitScore)
      .slice(0, 5);

    let shortlist: RankedShortlist = {
      summary:
        "Rule-based ranking from audience overlap, engagement, cost efficiency, and platform fit",
      creators: rankedCreators,
      totalEstimatedCost: rankedCreators.reduce(
        (sum, creator) => sum + creator.estimatedCost,
        0,
      ),
    };

    if (ctx.feedback?.kind === "budget_exceeded") {
      shortlist = trimToBudget(
        shortlist,
        ctx.feedback.trimToBudget,
        ctx.feedback.creatorsToRemove,
      );
    }

    return RankedShortlistSchema.parse(shortlist);
  }
}
