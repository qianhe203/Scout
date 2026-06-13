import type {
  CampaignPack,
  CreatorCandidates,
  ICPProposal,
  OutreachDrafts,
  ProductBrief,
  RankedShortlist,
} from "@scout/shared";

export const validICPProposal: ICPProposal = {
  segments: [
    {
      persona: "Health-conscious millennial parents",
      demographics: "28-40, suburban US",
      channels: ["tiktok", "instagram"],
      rationale: "Busy parents seeking convenient nutrition",
      confidence: "high",
      evidence: [
        {
          source: "web_search_category",
          snippet: "Category buyers are millennial parents",
        },
        {
          source: "web_search_competitor",
          snippet: "Competitors target young families",
        },
        {
          source: "creator_graph",
          snippet: "Top creators tag family-meal content",
        },
      ],
    },
  ],
  clientAlignment: "no_client_input",
  recommendedPrimarySegment: 0,
  evidenceSourceTypes: [
    "web_search_category",
    "web_search_competitor",
    "creator_graph",
  ],
  icpRetryPasses: 0,
};

export const validProductBrief: ProductBrief = {
  valueProposition:
    "Fresh organic meal kits delivered weekly to busy families seeking convenient nutrition",
  differentiators: ["Organic ingredients", "15-minute prep"],
  toneGuidance: "Warm, practical, and family-friendly professional voice",
  keyMessages: [
    "Save time without sacrificing nutrition for busy parents",
    "Help millennial parents cook healthy meals in 15 minutes",
  ],
};

export const validCreatorCandidates: CreatorCandidates = {
  creators: [
    {
      id: "c1",
      handle: "mealmom",
      platform: "tiktok",
      followerCount: 50_000,
      engagementRate: 0.05,
      estimatedRate: 200,
      audienceTags: ["parenting", "meals"],
      scandalFlag: false,
      trendingScore: 0.6,
      source: "seed",
    },
    {
      id: "c2",
      handle: "fitfoodie",
      platform: "instagram",
      followerCount: 80_000,
      engagementRate: 0.04,
      estimatedRate: 350,
      audienceTags: ["health", "food"],
      scandalFlag: false,
      trendingScore: 0.5,
      source: "seed",
    },
    {
      id: "c3",
      handle: "quickdinners",
      platform: "tiktok",
      followerCount: 30_000,
      engagementRate: 0.06,
      estimatedRate: 150,
      audienceTags: ["cooking"],
      scandalFlag: false,
      trendingScore: 0.7,
      source: "seed",
    },
    {
      id: "c4",
      handle: "familyfeast",
      platform: "instagram",
      followerCount: 45_000,
      engagementRate: 0.05,
      estimatedRate: 220,
      audienceTags: ["family"],
      scandalFlag: false,
      trendingScore: 0.55,
      source: "seed",
    },
    {
      id: "c5",
      handle: "budgetbites",
      platform: "tiktok",
      followerCount: 60_000,
      engagementRate: 0.05,
      estimatedRate: 180,
      audienceTags: ["budget", "meals"],
      scandalFlag: false,
      trendingScore: 0.65,
      source: "seed",
    },
  ],
};

export const validRankedShortlist: RankedShortlist = {
  summary: "Micro creators with strong family-meal overlap under budget",
  creators: [
    {
      id: "c1",
      handle: "mealmom",
      platform: "tiktok",
      fitScore: 82,
      rationale: "Strong parenting overlap",
      estimatedCost: 200,
      audienceOverlap: 0.7,
    },
    {
      id: "c2",
      handle: "fitfoodie",
      platform: "instagram",
      fitScore: 78,
      rationale: "Health-focused audience",
      estimatedCost: 350,
      audienceOverlap: 0.65,
    },
    {
      id: "c3",
      handle: "quickdinners",
      platform: "tiktok",
      fitScore: 75,
      rationale: "Quick meal content",
      estimatedCost: 150,
      audienceOverlap: 0.6,
    },
  ],
  totalEstimatedCost: 700,
};

export const overBudgetRankedShortlist: RankedShortlist = {
  summary: "Shortlist exceeds client budget",
  creators: [
    {
      id: "c1",
      handle: "mealmom",
      platform: "tiktok",
      fitScore: 82,
      rationale: "Strong parenting overlap",
      estimatedCost: 1500,
      audienceOverlap: 0.7,
    },
    {
      id: "c2",
      handle: "fitfoodie",
      platform: "instagram",
      fitScore: 78,
      rationale: "Health-focused audience",
      estimatedCost: 1200,
      audienceOverlap: 0.65,
    },
  ],
  totalEstimatedCost: 2700,
};

export const validOutreachDrafts: OutreachDrafts = {
  drafts: [
    {
      creatorId: "c1",
      subject: "Partnership idea",
      body: "Hi! We love your meal content and think our kits would resonate.",
      tone: "warm",
    },
  ],
};

export function buildCampaignPack(): CampaignPack {
  return {
    shortlist: validRankedShortlist,
    outreach: validOutreachDrafts,
    icp: validICPProposal,
    runLogSummary: "Seed pipeline run complete",
    exportedAt: new Date().toISOString(),
  };
}
