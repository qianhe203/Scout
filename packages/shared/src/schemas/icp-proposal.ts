import { z } from "zod";

export const EvidenceSourceSchema = z.enum([
  "web_search_category",
  "web_search_competitor",
  "creator_graph",
  "client_brief",
  "website",
  "product_page",
]);

export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;

export const ICPEvidenceSchema = z.object({
  source: EvidenceSourceSchema,
  url: z.string().url().optional(),
  snippet: z.string().min(1),
});

export const ICPSegmentSchema = z.object({
  persona: z.string().min(1),
  demographics: z.string().min(1),
  channels: z.array(z.string()).min(1),
  rationale: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
  evidence: z.array(ICPEvidenceSchema).min(1),
});

export const ICPProposalSchema = z
  .object({
    segments: z.array(ICPSegmentSchema).min(1),
    clientStatedAudience: z.string().optional(),
    clientAlignment: z.enum([
      "confirmed",
      "contradicted",
      "partial",
      "no_client_input",
    ]),
    alignmentNotes: z.string().optional(),
    recommendedPrimarySegment: z.number().int().nonnegative(),
    evidenceSourceTypes: z.array(z.string()).min(1),
    icpRetryPasses: z.number().int().min(0).max(3),
  })
  .superRefine((data, ctx) => {
    if (data.evidenceSourceTypes.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ICPProposal requires at least 3 distinct evidence source types",
        path: ["evidenceSourceTypes"],
      });
    }

    const nonClientTypes = data.evidenceSourceTypes.filter(
      (t) => t !== "client_brief",
    );
    if (nonClientTypes.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "ICPProposal requires at least 2 non-client_brief evidence source types",
        path: ["evidenceSourceTypes"],
      });
    }

    if (data.recommendedPrimarySegment >= data.segments.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "recommendedPrimarySegment must index into segments",
        path: ["recommendedPrimarySegment"],
      });
    }
  });

export type ICPProposal = z.infer<typeof ICPProposalSchema>;
