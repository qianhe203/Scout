import { z } from "zod";

export const OutreachDraftSchema = z.object({
  creatorId: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().min(1),
  tone: z.string().min(1),
});

export const OutreachDraftsSchema = z.object({
  drafts: z.array(OutreachDraftSchema).min(1),
});

export type OutreachDraft = z.infer<typeof OutreachDraftSchema>;
export type OutreachDrafts = z.infer<typeof OutreachDraftsSchema>;
