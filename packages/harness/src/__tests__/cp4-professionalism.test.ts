import { describe, expect, it } from "vitest";
import { evaluateCP4Heuristic } from "../checkpoints/cp4-professionalism.js";
import { validOutreachDrafts } from "../__fixtures__/artifacts.js";
import type { HarnessContext } from "../types.js";

function ctxWithDrafts(
  drafts: typeof validOutreachDrafts,
): HarnessContext {
  return {
    runId: "run_test",
    clientBrief: {
      company: "Acme",
      companyDescription: "Meal kits",
      product: "Protein shakes",
      budget: 5000,
      risk: "low",
    },
    artifacts: {
      OutreachDrafts: {
        meta: {
          id: "1",
          type: "OutreachDrafts",
          version: 1,
          runId: "run_test",
          createdAt: new Date().toISOString(),
        },
        data: drafts,
        path: "runs/run_test/OutreachDrafts_v1.json",
      },
    },
    config: {
      runsDir: "./runs",
      runTokenBudget: 50_000,
      runCostCapUsd: 2,
      maxRetriesPerStage: 2,
    },
    telemetry: {
      startStage: () => ({
        stage: "outreach",
        runId: "run_test",
        startedAt: Date.now(),
      }),
      endStage: () => 1,
      sink: {
        append: async () => {},
        exceedsTokenBudget: async () => false,
        exceedsCostCap: async () => false,
        recordStageTelemetry: async () => {},
      },
    },
    retryCounts: {},
  };
}

describe("evaluateCP4Heuristic", () => {
  it("passes professional drafts", () => {
    const result = evaluateCP4Heuristic(ctxWithDrafts(validOutreachDrafts));
    expect(result.passed).toBe(true);
    expect(result.details.score).toBeGreaterThanOrEqual(80);
  });

  it("fails drafts with guarantee language and returns feedback", () => {
    const result = evaluateCP4Heuristic(
      ctxWithDrafts({
        drafts: [
          {
            creatorId: "c1",
            subject: "Guaranteed viral results!!!",
            body: "We guarantee 100% viral success ACT NOW $$$",
            tone: "hype",
          },
        ],
      }),
    );

    expect(result.passed).toBe(false);
    expect(result.details.score).toBeLessThan(80);
    expect(result.feedback?.kind).toBe("professionalism_fail");
    if (result.feedback?.kind === "professionalism_fail") {
      expect(result.feedback.failures.length).toBeGreaterThan(0);
      expect(result.feedback.draftsToRevise).toContain("c1");
    }
  });
});
