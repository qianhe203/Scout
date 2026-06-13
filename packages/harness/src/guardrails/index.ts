import type { GuardrailResult, HarnessContext, Stage } from "../types.js";
import { enforceG1Budget } from "./g1-budget.js";
import { enforceG2PlatformAllow } from "./g2-platform-allow.js";
import { enforceG3PlatformBlock } from "./g3-platform-block.js";
import { enforceG4RiskLow } from "./g4-risk-low.js";
import { enforceG7IgReadonly } from "./g7-ig-readonly.js";

export { enforceG1Budget } from "./g1-budget.js";
export { enforceG2PlatformAllow } from "./g2-platform-allow.js";
export { enforceG3PlatformBlock } from "./g3-platform-block.js";
export { enforceG4RiskLow } from "./g4-risk-low.js";
export { enforceG6NoSend } from "./g6-no-send.js";
export { enforceG7IgReadonly } from "./g7-ig-readonly.js";
export { resolveResearchPlatforms } from "./platforms.js";

export function enforcePre(
  stage: Stage,
  ctx: HarnessContext,
): GuardrailResult {
  if (stage === "research") {
    const g2 = enforceG2PlatformAllow(ctx);
    if (g2.blocked) {
      return g2;
    }
    const g3 = enforceG3PlatformBlock(ctx);
    if (g3.blocked) {
      return g3;
    }
  }

  if (stage === "outreach" && ctx.clientBrief.igCredentials) {
    return enforceG7IgReadonly(ctx);
  }

  return { id: "pre", blocked: false };
}

export function enforcePost(
  stage: Stage,
  ctx: HarnessContext,
): GuardrailResult {
  if (stage === "score") {
    const g1 = enforceG1Budget(ctx);
    if (g1.blocked) {
      return g1;
    }
    const g4 = enforceG4RiskLow(ctx);
    if (g4.blocked) {
      return g4;
    }
  }

  return { id: "post", blocked: false };
}
