import type { RankedShortlist } from "@scout/shared";
import type { GuardrailResult, HarnessContext } from "../types.js";

export function enforceG1Budget(ctx: HarnessContext): GuardrailResult {
  const shortlistArtifact = ctx.artifacts.RankedShortlist;
  if (!shortlistArtifact) {
    return { id: "G1", blocked: false };
  }

  const shortlist = shortlistArtifact.data as RankedShortlist;
  const total = shortlist.creators.reduce((sum, c) => sum + c.estimatedCost, 0);
  const budget = ctx.clientBrief.budget;

  if (total <= budget) {
    return { id: "G1", blocked: false };
  }

  const sorted = [...shortlist.creators].sort((a, b) => a.fitScore - b.fitScore);
  const creatorsToRemove = sorted
    .slice(0, Math.max(0, shortlist.creators.length - 1))
    .map((c) => c.id);

  return {
    id: "G1",
    blocked: true,
    alarm: {
      type: "BUDGET_EXCEEDED",
      severity: "high",
      context: { budget, currentTotal: total },
      recommended_action:
        "Reduce shortlist or raise budget with human approval",
      timestamp: new Date().toISOString(),
    },
    feedback: {
      kind: "budget_exceeded",
      trimToBudget: budget,
      currentTotal: total,
      creatorsToRemove,
    },
  };
}
