import { CreatorCandidatesSchema } from "@scout/shared";
import type { CheckpointResult, HarnessContext } from "../types.js";

export function evaluateCP2(ctx: HarnessContext): CheckpointResult {
  const artifact = ctx.artifacts.CreatorCandidates;
  const parsed = artifact
    ? CreatorCandidatesSchema.safeParse(artifact.data)
    : { success: false as const, error: null };
  const creators = parsed.success ? parsed.data.creators : [];
  const platforms = new Set(creators.map((c) => c.platform));

  const allowlist = ctx.clientBrief.platformAllowlist;
  const minPlatforms =
    allowlist?.length === 1 ? 1 : allowlist?.length ? 2 : 2;
  const minCandidates = 5;

  const passed =
    creators.length >= minCandidates && platforms.size >= minPlatforms;

  return {
    id: "CP2",
    passed,
    details: {
      candidateCount: creators.length,
      platformCount: platforms.size,
      minCandidates,
      minPlatforms,
    },
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
