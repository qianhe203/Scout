import type { CreatorCandidates, RankedShortlist } from "@scout/shared";
import type { GuardrailResult, HarnessContext } from "../types.js";

export function enforceG4RiskLow(ctx: HarnessContext): GuardrailResult {
  if (ctx.clientBrief.risk !== "low") {
    return { id: "G4", blocked: false };
  }

  const shortlistArtifact = ctx.artifacts.RankedShortlist;
  const candidatesArtifact = ctx.artifacts.CreatorCandidates;
  if (!shortlistArtifact || !candidatesArtifact) {
    return { id: "G4", blocked: false };
  }

  const shortlist = shortlistArtifact.data as RankedShortlist;
  const candidates = candidatesArtifact.data as CreatorCandidates;
  const candidateById = new Map(candidates.creators.map((c) => [c.id, c]));

  const scandalCreators = shortlist.creators.filter((c) => {
    const candidate = candidateById.get(c.id);
    return candidate?.scandalFlag === true;
  });

  if (scandalCreators.length === 0) {
    return { id: "G4", blocked: false };
  }

  return {
    id: "G4",
    blocked: true,
    alarm: {
      type: "SCANDAL_DETECTED",
      severity: "high",
      context: {
        creatorIds: scandalCreators.map((c) => c.id),
        risk: ctx.clientBrief.risk,
      },
      recommended_action:
        "Remove scandal-flagged creators from shortlist or raise risk tier",
      timestamp: new Date().toISOString(),
    },
    feedback: {
      kind: "checkpoint_fail",
      checkpointId: "G4",
      details: { scandalCreatorIds: scandalCreators.map((c) => c.id) },
    },
  };
}
