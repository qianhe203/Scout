import { z } from "zod";
import { ICPProposalSchema } from "./icp-proposal.js";
import { OutreachDraftsSchema } from "./outreach-drafts.js";
import { RankedShortlistSchema } from "./ranked-shortlist.js";

export const CampaignPackSchema = z.object({
  shortlist: RankedShortlistSchema,
  outreach: OutreachDraftsSchema,
  icp: ICPProposalSchema,
  runLogSummary: z.string().min(1),
  exportedAt: z.string().datetime(),
});

export type CampaignPack = z.infer<typeof CampaignPackSchema>;
