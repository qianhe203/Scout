import type {
  ICPProposal,
  OutreachDrafts,
  ProductBrief,
} from "@scout/shared";

/** ICP aligned with `data/creators.json` fitness/wellness/millennials tags. */
export const seedPipelineICP: ICPProposal = {
  segments: [
    {
      persona: "Fitness and wellness millennials",
      demographics: "25-38, health-conscious urban adults",
      channels: ["tiktok", "instagram", "youtube", "threads"],
      rationale:
        "Millennials follow home workout, wellness, and fitness creators for product discovery",
      confidence: "high",
      evidence: [
        {
          source: "web_search_category",
          snippet: "Fitness creators drive supplement and meal-kit conversions",
        },
        {
          source: "web_search_competitor",
          snippet: "Competitors partner with wellness influencers on TikTok",
        },
        {
          source: "creator_graph",
          snippet: "Top creators tag fitness, wellness, and millennials audiences",
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

export const seedPipelineProductBrief: ProductBrief = {
  valueProposition:
    "Organic protein shakes for busy millennials who want convenient post-workout nutrition",
  differentiators: ["Plant-based protein", "Ready in 30 seconds"],
  toneGuidance: "Energetic, authentic, and wellness-focused",
  keyMessages: [
    "Fuel your workout without sacrificing clean ingredients",
    "Trusted by fitness creators who value transparency",
  ],
};

export const seedPipelineOutreach: OutreachDrafts = {
  drafts: [
    {
      creatorId: "creator_001",
      subject: "Collab idea for your fitness community",
      body: "Hi! We love your home-workout content and think our shakes would resonate with your audience.",
      tone: "warm",
    },
  ],
};
