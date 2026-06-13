import type { ICPProposal } from "@scout/shared";
import type { GuardrailResult, HarnessContext } from "../types.js";
import { resolveResearchPlatforms } from "./platforms.js";

export function enforceG3PlatformBlock(ctx: HarnessContext): GuardrailResult {
  const blocklist = ctx.clientBrief.platformBlocklist;
  if (!blocklist?.length) {
    return { id: "G3", blocked: false };
  }

  const icp = ctx.artifacts.ICPProposal?.data as ICPProposal | undefined;
  const segmentIndex = icp?.recommendedPrimarySegment ?? 0;
  const channels = icp?.segments[segmentIndex]?.channels ?? [];
  const platforms = resolveResearchPlatforms(ctx);

  if (channels.length > 0 && platforms.length === 0) {
    return {
      id: "G3",
      blocked: true,
      alarm: {
        type: "PLATFORM_BLOCKED",
        severity: "medium",
        context: { blocklist, icpChannels: channels },
        recommended_action:
          "ICP channels are fully blocked by platform blocklist — revise ICP or blocklist",
        timestamp: new Date().toISOString(),
      },
      feedback: {
        kind: "platform_blocked",
        blockedPlatforms: blocklist,
      },
    };
  }

  return { id: "G3", blocked: false };
}
