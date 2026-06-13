import type { CheckpointResult, HarnessContext, Stage } from "../types.js";
import { evaluateCP0 } from "./cp0-icp.js";
import { evaluateCP1 } from "./cp1-product.js";
import { evaluateCP2 } from "./cp2-research.js";
import { evaluateCP3 } from "./cp3-score.js";
import {
  evaluateCP4,
  evaluateCP4Heuristic,
} from "./cp4-professionalism.js";

export { evaluateCP0 } from "./cp0-icp.js";
export { evaluateCP1 } from "./cp1-product.js";
export { evaluateCP2 } from "./cp2-research.js";
export { evaluateCP3 } from "./cp3-score.js";
export { evaluateCP4, evaluateCP4Heuristic } from "./cp4-professionalism.js";

export async function evaluateCheckpoint(
  stage: Stage,
  ctx: HarnessContext,
): Promise<CheckpointResult | null> {
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
      return ctx.config.cp4Evaluator
        ? ctx.config.cp4Evaluator(ctx)
        : evaluateCP4(ctx);
    default:
      return null;
  }
}
