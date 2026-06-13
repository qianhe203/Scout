import { z } from "zod";

export const RankedCreatorSchema = z.object({
  id: z.string().min(1),
  handle: z.string().min(1),
  platform: z.string().min(1),
  fitScore: z.number().min(0).max(100),
  rationale: z.string().min(1),
  estimatedCost: z.number().nonnegative(),
  audienceOverlap: z.number().min(0).max(1),
});

export const RankedShortlistSchema = z.object({
  summary: z.string().min(1),
  creators: z.array(RankedCreatorSchema).min(1),
  totalEstimatedCost: z.number().nonnegative(),
});

export type RankedCreator = z.infer<typeof RankedCreatorSchema>;
export type RankedShortlist = z.infer<typeof RankedShortlistSchema>;
