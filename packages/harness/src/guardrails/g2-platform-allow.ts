import type { GuardrailResult, HarnessContext } from "../types.js";
import { resolveResearchPlatforms } from "./platforms.js";

export function enforceG2PlatformAllow(ctx: HarnessContext): GuardrailResult {
  const allowlist = ctx.clientBrief.platformAllowlist;
  if (!allowlist?.length) {
    return { id: "G2", blocked: false };
  }

  const platforms = resolveResearchPlatforms(ctx);
  if (platforms.length > 0) {
    return { id: "G2", blocked: false };
  }

  return {
    id: "G2",
    blocked: true,
    alarm: {
      type: "PLATFORM_BLOCKED",
      severity: "medium",
      context: { allowlist, resolvedPlatforms: platforms },
      recommended_action:
        "Expand allowlist or adjust ICP channels to include allowed platforms",
      timestamp: new Date().toISOString(),
    },
    feedback: {
      kind: "platform_blocked",
      blockedPlatforms: allowlist,
    },
  };
}
