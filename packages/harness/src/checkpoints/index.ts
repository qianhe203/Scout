import {
  CreatorCandidatesSchema,
  OutreachDraftsSchema,
  ProductBriefSchema,
  RankedShortlistSchema,
} from "@scout/shared";
import type { CheckpointResult, HarnessContext, Stage } from "../types.js";
import { evaluateCP0 } from "./cp0-icp.js";

function evaluateCP1(ctx: HarnessContext): CheckpointResult {
  const artifact = ctx.artifacts.ProductBrief;
  const parsed = artifact
    ? ProductBriefSchema.safeParse(artifact.data)
    : { success: false as const, error: null };
  const passed = parsed.success;
  return {
    id: "CP1",
    passed,
    details: passed
      ? { fields: ["valueProposition", "differentiators", "toneGuidance"] }
      : { reason: "invalid_or_missing_product_brief" },
    ...(passed
      ? {}
      : {
          alarm: {
            type: "PRODUCT_UNCLEAR",
            severity: "medium",
            context: {},
            recommended_action: "Retry ProductWorker with product_unclear feedback",
            timestamp: new Date().toISOString(),
          },
          feedback: {
            kind: "checkpoint_fail" as const,
            checkpointId: "CP1",
            details: { reason: "product_unclear" },
          },
        }),
  };
}

function evaluateCP2(ctx: HarnessContext): CheckpointResult {
  const artifact = ctx.artifacts.CreatorCandidates;
  const parsed = artifact
    ? CreatorCandidatesSchema.safeParse(artifact.data)
    : { success: false as const, error: null };
  const creators = parsed.success ? parsed.data.creators : [];
  const platforms = new Set(creators.map((c) => c.platform));
  const passed = creators.length >= 5 && platforms.size >= 2;
  return {
    id: "CP2",
    passed,
    details: { candidateCount: creators.length, platformCount: platforms.size },
    ...(passed
      ? {}
      : {
          alarm: {
            type: "INSUFFICIENT_CANDIDATES",
            severity: "medium",
            context: {
              candidateCount: creators.length,
              platformCount: platforms.size,
            },
            recommended_action: "Retry ResearchWorker with broader query",
            timestamp: new Date().toISOString(),
          },
          feedback: {
            kind: "checkpoint_fail" as const,
            checkpointId: "CP2",
            details: { candidateCount: creators.length },
          },
        }),
  };
}

function evaluateCP3(ctx: HarnessContext): CheckpointResult {
  const artifact = ctx.artifacts.RankedShortlist;
  const parsed = artifact
    ? RankedShortlistSchema.safeParse(artifact.data)
    : { success: false as const, error: null };
  const top = parsed.success
    ? [...parsed.data.creators]
        .sort((a, b) => b.fitScore - a.fitScore)
        .slice(0, 5)
    : [];
  const passed =
    top.length >= 1 && top.every((c) => c.fitScore >= 60) && top.length <= 5;
  return {
    id: "CP3",
    passed,
    details: {
      topScores: top.map((c) => ({ id: c.id, fitScore: c.fitScore })),
    },
    ...(passed
      ? {}
      : {
          alarm: {
            type: "LOW_FIT_SCORES",
            severity: "medium",
            context: { topScores: top.map((c) => c.fitScore) },
            recommended_action: "Re-score with revised rubric weights",
            timestamp: new Date().toISOString(),
          },
          feedback: {
            kind: "checkpoint_fail" as const,
            checkpointId: "CP3",
            details: { topScores: top.map((c) => c.fitScore) },
          },
        }),
  };
}

function evaluateCP4(_ctx: HarnessContext): CheckpointResult {
  // Stub pass until U9 wires LLM professionalism evaluator
  return {
    id: "CP4",
    passed: true,
    details: { evaluator: "stub", score: 85 },
  };
}

export function evaluateCheckpoint(
  stage: Stage,
  ctx: HarnessContext,
): CheckpointResult | null {
  switch (stage) {
    case "icp":
      return evaluateCP0(ctx);
    case "product":
      return evaluateCP1(ctx);
    case "research":
      return evaluateCP2(ctx);
    case "score":
      return evaluateCP3(ctx);
    case "outreach":
      return evaluateCP4(ctx);
    default:
      return null;
  }
}
