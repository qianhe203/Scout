import { describe, expect, it } from "vitest";
import { ICPProposalSchema } from "@scout/shared";
import {
  enrichIcpProposal,
  normalizeIcpRaw,
} from "../icp-normalize.js";

describe("normalizeIcpRaw", () => {
  it("unwraps nested ICPProposal wrapper", () => {
    const segment = {
      persona: "Millennial fitness buyers",
      demographics: "25-38",
      channels: ["tiktok"],
      rationale: "Evidence-backed",
      confidence: "high",
      evidence: [{ source: "web_search_category", snippet: "fitness buyers" }],
    };

    const normalized = normalizeIcpRaw({
      ICPProposal: {
        segments: [segment],
      },
    });

    expect(normalized).toEqual({ segments: [segment] });
  });

  it("wraps a bare segment object", () => {
    const segment = {
      persona: "Millennial fitness buyers",
      demographics: "25-38",
      channels: ["tiktok"],
      rationale: "Evidence-backed",
      confidence: "high",
      evidence: [{ source: "creator_graph", snippet: "tags" }],
    };

    expect(normalizeIcpRaw(segment)).toEqual({ segments: [segment] });
  });
});

describe("enrichIcpProposal", () => {
  it("fills missing required top-level fields before Zod parse", () => {
    const enriched = enrichIcpProposal(
      {
        segments: [
          {
            persona: "Millennial fitness buyers",
            demographics: "25-38",
            channels: ["tiktok", "instagram"],
            rationale: "Evidence-backed",
            confidence: "high",
            evidence: [
              {
                source: "web_search_category",
                snippet: "fitness buyers",
              },
              {
                source: "web_search_competitor",
                snippet: "competitors on tiktok",
              },
              {
                source: "creator_graph",
                snippet: "creator tags",
              },
            ],
          },
        ],
      },
      0,
    );

    const parsed = ICPProposalSchema.parse(enriched);
    expect(parsed.clientAlignment).toBe("no_client_input");
    expect(parsed.recommendedPrimarySegment).toBe(0);
    expect(parsed.evidenceSourceTypes).toHaveLength(3);
  });
});
