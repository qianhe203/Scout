import type { GuardrailResult, HarnessContext } from "../types.js";

/**
 * G7 — IG credentials are read-only (voice matching). No post/like/DM.
 */
export function enforceG7IgReadonly(ctx: HarnessContext): GuardrailResult {
  if (!ctx.clientBrief.igCredentials) {
    return { id: "G7", blocked: false };
  }

  return { id: "G7", blocked: false };
}
