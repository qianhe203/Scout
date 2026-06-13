import { describe, expect, it } from "vitest";
import type { HarnessContext } from "../types.js";
import { enforceG1Budget } from "../guardrails/g1-budget.js";
import { overBudgetRankedShortlist } from "../__fixtures__/artifacts.js";

describe("enforceG1Budget", () => {
  it("blocks when shortlist total exceeds budget", () => {
    const ctx = {
      clientBrief: { budget: 500 },
      artifacts: {
        RankedShortlist: { data: overBudgetRankedShortlist },
      },
    } as unknown as HarnessContext;

    const result = enforceG1Budget(ctx);
    expect(result.blocked).toBe(true);
    expect(result.alarm?.type).toBe("BUDGET_EXCEEDED");
    expect(result.feedback?.kind).toBe("budget_exceeded");
    if (result.feedback?.kind === "budget_exceeded") {
      expect(result.feedback.trimToBudget).toBe(500);
      expect(result.feedback.creatorsToRemove.length).toBeGreaterThan(0);
    }
  });
});
