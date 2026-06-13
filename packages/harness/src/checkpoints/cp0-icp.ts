import { ICPProposalSchema, type ICPProposal } from "@scout/shared";
import type { CheckpointResult, HarnessContext } from "../types.js";

export function evaluateCP0(ctx: HarnessContext): CheckpointResult {
  const artifact = ctx.artifacts.ICPProposal;
  if (!artifact) {
    return {
      id: "CP0",
      passed: false,
      details: { reason: "missing_icp_proposal" },
      alarm: {
        type: "ICP_EVIDENCE_THIN",
        severity: "high",
        context: { reason: "No ICPProposal artifact" },
        recommended_action:
          "Run automated ICP retry ladder (product page + expanded search)",
        timestamp: new Date().toISOString(),
      },
      feedback: {
        kind: "checkpoint_fail",
        checkpointId: "CP0",
        details: { reason: "missing_icp_proposal" },
      },
    };
  }

  const raw = artifact.data as ICPProposal;
  const retryPasses = raw.icpRetryPasses ?? 0;

  if (retryPasses >= 3) {
    return {
      id: "CP0",
      passed: true,
      details: {
        evidenceSourceTypes: raw.evidenceSourceTypes ?? [],
        icpRetryPasses: retryPasses,
        lowConfidence: true,
      },
      alarm: {
        type: "ICP_LOW_CONFIDENCE",
        severity: "medium",
        context: { icpRetryPasses: retryPasses },
        recommended_action: "Continue pipeline with low-confidence ICP segments",
        timestamp: new Date().toISOString(),
      },
    };
  }

  const parsed = ICPProposalSchema.safeParse(artifact.data);
  if (!parsed.success) {
    return {
      id: "CP0",
      passed: false,
      details: { zodError: parsed.error.flatten() },
      alarm: {
        type: "ICP_EVIDENCE_THIN",
        severity: "high",
        context: { validation: parsed.error.flatten() },
        recommended_action:
          "Run automated ICP retry ladder (product page + expanded search)",
        timestamp: new Date().toISOString(),
      },
      feedback: {
        kind: "checkpoint_fail",
        checkpointId: "CP0",
        details: { zodError: parsed.error.flatten() },
      },
    };
  }

  const proposal = parsed.data as ICPProposal;
  const nonClientTypes = proposal.evidenceSourceTypes.filter(
    (t) => t !== "client_brief",
  );

  const segmentOk = proposal.segments.every(
    (s) =>
      s.persona.length > 0 &&
      s.channels.length > 0 &&
      s.rationale.length > 0 &&
      s.evidence.length > 0,
  );

  const evidenceOk =
    proposal.evidenceSourceTypes.length >= 3 && nonClientTypes.length >= 2;

  if (segmentOk && evidenceOk) {
    return {
      id: "CP0",
      passed: true,
      details: {
        evidenceSourceTypes: proposal.evidenceSourceTypes,
        segmentCount: proposal.segments.length,
      },
    };
  }

  return {
    id: "CP0",
    passed: false,
    details: {
      evidenceSourceTypes: proposal.evidenceSourceTypes,
      nonClientCount: nonClientTypes.length,
      segmentOk,
      icpRetryPasses: retryPasses,
    },
    alarm: {
      type: "ICP_EVIDENCE_THIN",
      severity: "high",
      context: {
        evidenceSourceTypes: proposal.evidenceSourceTypes,
        nonClientCount: nonClientTypes.length,
        icpRetryPasses: retryPasses,
      },
      recommended_action:
        "Run automated ICP retry ladder (product page + expanded search)",
      timestamp: new Date().toISOString(),
    },
    feedback: {
      kind: "checkpoint_fail",
      checkpointId: "CP0",
      details: {
        evidenceSourceTypes: proposal.evidenceSourceTypes,
        nonClientCount: nonClientTypes.length,
        icpRetryPasses: retryPasses,
      },
    },
  };
}
