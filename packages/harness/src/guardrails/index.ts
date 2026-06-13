import type { GuardrailResult, HarnessContext, Stage } from "../types.js";
import { enforceG1Budget } from "./g1-budget.js";

export function enforcePre(
  _stage: Stage,
  _ctx: HarnessContext,
): GuardrailResult {
  // G2/G3 platform filters wired in U5/U9
  return { id: "pre", blocked: false };
}

export function enforcePost(
  stage: Stage,
  ctx: HarnessContext,
): GuardrailResult {
  if (stage === "score") {
    return enforceG1Budget(ctx);
  }
  return { id: "post", blocked: false };
}
