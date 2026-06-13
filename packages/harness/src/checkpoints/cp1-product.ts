import {
  ProductBriefSchema,
  type ICPProposal,
  type ProductBrief,
} from "@scout/shared";
import type { CheckpointResult, HarnessContext } from "../types.js";
import { hasSegmentMessageOverlap } from "./segment-fit.js";

const LOW_RISK_BUZZ = ["edgy", "viral", "chaos", "guaranteed", "hype"];

function productUnclearFailure(
  details: Record<string, unknown>,
  vagueFields: string[],
  hint: string,
): CheckpointResult {
  return {
    id: "CP1",
    passed: false,
    details,
    alarm: {
      type: "PRODUCT_UNCLEAR",
      severity: "medium",
      context: details,
      recommended_action: "Retry ProductWorker with product_unclear feedback",
      timestamp: new Date().toISOString(),
    },
    feedback: {
      kind: "product_unclear",
      missingFields: [],
      vagueFields,
      hint,
    },
  };
}

export function evaluateCP1(ctx: HarnessContext): CheckpointResult {
  const artifact = ctx.artifacts.ProductBrief;
  if (!artifact) {
    return productUnclearFailure(
      { reason: "missing_product_brief" },
      ["ProductBrief"],
      "ProductBrief artifact is required",
    );
  }

  const parsed = ProductBriefSchema.safeParse(artifact.data);
  if (!parsed.success) {
    return productUnclearFailure(
      { zodError: parsed.error.flatten() },
      ["ProductBrief"],
      "ProductBrief failed schema validation",
    );
  }

  const brief = parsed.data as ProductBrief;
  const vagueFields: string[] = [];

  if (brief.differentiators.length < 2) {
    vagueFields.push("differentiators");
  }
  if (brief.keyMessages.length < 2) {
    vagueFields.push("keyMessages");
  }
  if (brief.valueProposition.length < 20) {
    vagueFields.push("valueProposition");
  }
  if (brief.toneGuidance.length < 20) {
    vagueFields.push("toneGuidance");
  }

  if (
    ctx.clientBrief.risk === "low" &&
    LOW_RISK_BUZZ.some((word) =>
      brief.toneGuidance.toLowerCase().includes(word),
    )
  ) {
    vagueFields.push("toneGuidance");
  }

  const icp = ctx.artifacts.ICPProposal?.data as ICPProposal | undefined;
  const segmentIndex = icp?.recommendedPrimarySegment ?? 0;
  const segment = icp?.segments[segmentIndex];
  if (
    segment &&
    !hasSegmentMessageOverlap(
      brief.keyMessages,
      segment.persona,
      segment.rationale,
    )
  ) {
    vagueFields.push("keyMessages");
  }

  if (vagueFields.length > 0) {
    return productUnclearFailure(
      { vagueFields, fields: Object.keys(brief) },
      [...new Set(vagueFields)],
      "Clarify product positioning for the researched ICP segment",
    );
  }

  return {
    id: "CP1",
    passed: true,
    details: {
      fields: [
        "valueProposition",
        "differentiators",
        "toneGuidance",
        "keyMessages",
      ],
    },
  };
}
