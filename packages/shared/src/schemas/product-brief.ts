import { z } from "zod";

export const ProductBriefSchema = z.object({
  valueProposition: z.string().min(1),
  differentiators: z.array(z.string()).min(1),
  toneGuidance: z.string().min(1),
  keyMessages: z.array(z.string()).min(1),
  avoidPhrases: z.array(z.string()).optional(),
});

export type ProductBrief = z.infer<typeof ProductBriefSchema>;
