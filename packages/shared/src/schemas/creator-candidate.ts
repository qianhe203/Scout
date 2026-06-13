import { z } from "zod";

export const CreatorCandidateSchema = z.object({
  id: z.string().min(1),
  handle: z.string().min(1),
  platform: z.string().min(1),
  followerCount: z.number().nonnegative(),
  engagementRate: z.number().min(0).max(1),
  estimatedRate: z.number().nonnegative(),
  audienceTags: z.array(z.string()),
  scandalFlag: z.boolean(),
  trendingScore: z.number().min(0).max(1),
  source: z.enum(["influencers_club", "seed", "web"]),
});

export const CreatorCandidatesSchema = z.object({
  creators: z.array(CreatorCandidateSchema),
});

export type CreatorCandidate = z.infer<typeof CreatorCandidateSchema>;
export type CreatorCandidates = z.infer<typeof CreatorCandidatesSchema>;
