import { describe, expect, it } from "vitest";
import {
  BudgetExceededFeedbackSchema,
  ClientBriefSchema,
  ICPProposalSchema,
  RankedShortlistSchema,
  RunEventSchema,
} from "../../index.js";

describe("ClientBriefSchema", () => {
  it("accepts expanded optional fields", () => {
    const result = ClientBriefSchema.safeParse({
      company: "Acme Co",
      companyDescription: "Meal kits for busy parents",
      product: "Weekly meal box",
      budget: 2000,
      risk: "low",
      exampleCustomers: ["Sarah, 34, suburban mom who meal-preps"],
      admiredCompetitor: "HelloFresh",
      tractionChannels: ["tiktok", "instagram"],
      whyTheyBuy: "Too busy to cook from scratch",
    });
    expect(result.success).toBe(true);
  });
});

describe("ICPProposalSchema", () => {
  const validSegment = {
    persona: "Health-conscious millennial parents",
    demographics: "28-40, suburban US",
    channels: ["tiktok", "instagram"],
    rationale: "Busy parents seeking convenient nutrition",
    confidence: "high" as const,
    evidence: [
      {
        source: "web_search_category" as const,
        snippet: "Category buyers are millennial parents",
      },
      {
        source: "web_search_competitor" as const,
        snippet: "Competitors target young families",
      },
      {
        source: "creator_graph" as const,
        snippet: "Top creators tag family-meal content",
      },
    ],
  };

  it("accepts proposal with ≥3 evidence source types", () => {
    const result = ICPProposalSchema.safeParse({
      segments: [validSegment],
      clientAlignment: "no_client_input",
      recommendedPrimarySegment: 0,
      evidenceSourceTypes: [
        "web_search_category",
        "web_search_competitor",
        "creator_graph",
      ],
      icpRetryPasses: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects when evidenceSourceTypes has fewer than 3 types", () => {
    const result = ICPProposalSchema.safeParse({
      segments: [
        {
          ...validSegment,
          evidence: [
            { source: "client_brief" as const, snippet: "Client said Gen Z" },
          ],
        },
      ],
      clientAlignment: "partial",
      recommendedPrimarySegment: 0,
      evidenceSourceTypes: ["client_brief"],
      icpRetryPasses: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects when fewer than 2 non-client evidence types", () => {
    const result = ICPProposalSchema.safeParse({
      segments: [validSegment],
      clientAlignment: "confirmed",
      recommendedPrimarySegment: 0,
      evidenceSourceTypes: [
        "client_brief",
        "client_brief",
        "website",
      ],
      icpRetryPasses: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("RankedShortlistSchema", () => {
  it("requires rationale and fitScore per creator", () => {
    const missingRationale = RankedShortlistSchema.safeParse({
      summary: "Micro-heavy portfolio under budget",
      creators: [
        {
          id: "c1",
          handle: "@chef",
          platform: "tiktok",
          fitScore: 85,
          estimatedCost: 500,
          audienceOverlap: 0.7,
        },
      ],
      totalEstimatedCost: 500,
    });
    expect(missingRationale.success).toBe(false);

    const valid = RankedShortlistSchema.safeParse({
      summary: "Micro-heavy portfolio under budget",
      creators: [
        {
          id: "c1",
          handle: "@chef",
          platform: "tiktok",
          fitScore: 85,
          rationale: "Strong audience overlap with home-cook beginners",
          estimatedCost: 500,
          audienceOverlap: 0.7,
        },
      ],
      totalEstimatedCost: 500,
    });
    expect(valid.success).toBe(true);
  });
});

describe("RunEventSchema", () => {
  const cases = [
    { kind: "stage_started", stage: "icp" },
    { kind: "stage_completed", stage: "icp", durationMs: 1200 },
    {
      kind: "artifact_written",
      artifactType: "ICPProposal",
      version: 1,
      path: "runs/x/artifacts/ICPProposal_v1.json",
    },
    { kind: "checkpoint", id: "CP0", passed: true, details: {} },
    {
      kind: "guardrail",
      id: "G1",
      blocked: true,
      feedback: { kind: "budget_exceeded" },
    },
    {
      kind: "alarm",
      alarm: {
        type: "BUDGET_EXCEEDED",
        context: {},
        severity: "high",
        recommended_action: "Revise shortlist",
        timestamp: "2026-06-13T00:00:00.000Z",
      },
    },
    {
      kind: "llm_call",
      worker: "ICPWorker",
      model: "claude-sonnet-4-20250514",
      inputTokens: 100,
      outputTokens: 200,
      estimatedCostUsd: 0.01,
      latencyMs: 800,
    },
    {
      kind: "tool_call",
      adapter: "web-search",
      success: true,
      latencyMs: 400,
    },
    { kind: "human_required", reason: "Export approval needed" },
    {
      kind: "run_complete",
      exportPath: "runs/x/export",
      totalCostUsd: 0.12,
      totalTokens: 5000,
    },
  ] as const;

  it.each(cases)("parses %s event", (event) => {
    const result = RunEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe("BudgetExceededFeedbackSchema", () => {
  it("parses G1 feedback payload", () => {
    const result = BudgetExceededFeedbackSchema.safeParse({
      kind: "budget_exceeded",
      trimToBudget: 2000,
      currentTotal: 2800,
      creatorsToRemove: ["c3", "c7"],
    });
    expect(result.success).toBe(true);
  });
});
