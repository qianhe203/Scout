import type { CheckpointResult, HarnessContext, Stage } from "../types.js";
import { evaluateCP0 } from "./cp0-icp.js";
import { evaluateCP1 } from "./cp1-product.js";
import { evaluateCP2 } from "./cp2-research.js";
import { evaluateCP3 } from "./cp3-score.js";
import { evaluateCP4 } from "./cp4-professionalism.js";

export { evaluateCP0 } from "./cp0-icp.js";
export { evaluateCP1 } from "./cp1-product.js";
export { evaluateCP2 } from "./cp2-research.js";
export { evaluateCP3 } from "./cp3-score.js";
export { evaluateCP4 } from "./cp4-professionalism.js";

export function evaluateCheckpoint(
  stage: Stage,
  ctx: HarnessContext,
): CheckpointResult | null {
  switch (stage) {
    case "icp":
      return evaluateCP0(ctx);
    case "product":
      return evaluateCP1(ctx);
    case "research":
      return evaluateCP2(ctx);
    case "score":
      return evaluateCP3(ctx);
    case "outreach":
      return evaluateCP4(ctx);
    default:
      return null;
  }
}
