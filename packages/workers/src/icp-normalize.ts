import type { ICPProposal } from "@scout/shared";

const WRAPPER_KEYS = [
  "ICPProposal",
  "icpProposal",
  "icp_proposal",
  "proposal",
  "data",
  "result",
  "output",
];

function isSegmentLike(value: unknown): value is Record<string, unknown> {
  return (
    value != null &&
    typeof value === "object" &&
    "persona" in value &&
    typeof (value as Record<string, unknown>).persona === "string"
  );
}

/** Unwrap common LLM response shapes before Zod validation. */
export function normalizeIcpRaw(raw: unknown): unknown {
  if (raw == null) return raw;

  if (Array.isArray(raw)) {
    if (raw.every(isSegmentLike)) {
      return { segments: raw };
    }
    return raw;
  }

  if (typeof raw !== "object") return raw;
  const record = raw as Record<string, unknown>;

  for (const key of WRAPPER_KEYS) {
    const nested = record[key];
    if (nested != null && typeof nested === "object") {
      return normalizeIcpRaw(nested);
    }
  }

  if (isSegmentLike(record) && !("segments" in record)) {
    return { segments: [record] };
  }

  return record;
}

/** Fill required top-level fields the local model often omits. */
export function enrichIcpProposal(
  raw: Record<string, unknown>,
  retryPass: number,
  clientStatedAudience?: string,
): Record<string, unknown> {
  const segments = Array.isArray(raw.segments)
    ? (raw.segments as Array<{ evidence?: Array<{ source?: string }> }>)
    : [];

  if (!raw.evidenceSourceTypes && segments.length > 0) {
    const types = new Set<string>();
    for (const segment of segments) {
      for (const item of segment.evidence ?? []) {
        if (item.source) types.add(item.source);
      }
    }
    raw.evidenceSourceTypes = [...types];
  }

  if (raw.recommendedPrimarySegment === undefined) {
    raw.recommendedPrimarySegment = 0;
  }

  if (!raw.clientAlignment) {
    raw.clientAlignment = clientStatedAudience
      ? "partial"
      : "no_client_input";
  }

  raw.icpRetryPasses = retryPass;

  if (clientStatedAudience && !raw.clientStatedAudience) {
    raw.clientStatedAudience = clientStatedAudience;
  }

  return raw;
}

export function icpProposalExample(retryPass: number): ICPProposal {
  return {
    segments: [
      {
        persona: "Fitness-focused millennials",
        demographics: "25-38, urban, health-conscious",
        channels: ["tiktok", "instagram", "youtube"],
        rationale: "Web and creator-graph evidence show fitness millennials convert",
        confidence: "high",
        evidence: [
          {
            source: "web_search_category",
            snippet: "Category buyers skew millennial and fitness-oriented",
          },
          {
            source: "web_search_competitor",
            snippet: "Competitors target wellness creators on TikTok",
          },
          {
            source: "creator_graph",
            snippet: "Top niche creators tag fitness and millennials",
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
    icpRetryPasses: retryPass,
  };
}

export function formatZodError(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "issues" in error &&
    Array.isArray((error as { issues: unknown[] }).issues)
  ) {
    return JSON.stringify((error as { issues: unknown[] }).issues, null, 2);
  }
  return error instanceof Error ? error.message : String(error);
}
