import { describe, expect, it } from "vitest";
import type { HarnessContext } from "../types.js";
import { evaluateCP0 } from "../checkpoints/cp0-icp.js";
import { validICPProposal } from "../__fixtures__/artifacts.js";

describe("evaluateCP0", () => {
  it("passes with ≥3 evidence source types and ≥2 non-client", () => {
    const ctx = {
      artifacts: {
        ICPProposal: { data: validICPProposal },
      },
    } as unknown as HarnessContext;

    const result = evaluateCP0(ctx);
    expect(result.passed).toBe(true);
    expect(result.id).toBe("CP0");
  });

  it("fails when only client_brief evidence types", () => {
    const ctx = {
      artifacts: {
        ICPProposal: {
          data: {
            ...validICPProposal,
            evidenceSourceTypes: ["client_brief"],
            icpRetryPasses: 0,
          },
        },
      },
    } as unknown as HarnessContext;

    const result = evaluateCP0(ctx);
    expect(result.passed).toBe(false);
    expect(result.alarm?.type).toBe("ICP_EVIDENCE_THIN");
  });

  it("continues with low confidence after max retry passes", () => {
    const ctx = {
      artifacts: {
        ICPProposal: {
          data: {
            ...validICPProposal,
            evidenceSourceTypes: ["client_brief"],
            icpRetryPasses: 3,
          },
        },
      },
    } as unknown as HarnessContext;

    const result = evaluateCP0(ctx);
    expect(result.passed).toBe(true);
    expect(result.alarm?.type).toBe("ICP_LOW_CONFIDENCE");
  });
});
