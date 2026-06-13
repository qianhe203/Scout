import { describe, expect, it } from "vitest";
import type { HarnessContext } from "../types.js";
import { evaluateCP1 } from "../checkpoints/cp1-product.js";
import { validICPProposal, validProductBrief } from "../__fixtures__/artifacts.js";

describe("evaluateCP1", () => {
  it("passes a complete ProductBrief aligned with ICP segment", () => {
    const ctx = {
      clientBrief: { risk: "low" },
      artifacts: {
        ProductBrief: { data: validProductBrief },
        ICPProposal: { data: validICPProposal },
      },
    } as unknown as HarnessContext;

    const result = evaluateCP1(ctx);
    expect(result.passed).toBe(true);
  });

  it("fails when valueProposition is too short", () => {
    const ctx = {
      clientBrief: { risk: "low" },
      artifacts: {
        ProductBrief: {
          data: { ...validProductBrief, valueProposition: "Short" },
        },
        ICPProposal: { data: validICPProposal },
      },
    } as unknown as HarnessContext;

    const result = evaluateCP1(ctx);
    expect(result.passed).toBe(false);
    expect(result.alarm?.type).toBe("PRODUCT_UNCLEAR");
    if (result.feedback?.kind === "product_unclear") {
      expect(result.feedback.vagueFields).toContain("valueProposition");
    }
  });

  it("fails when key messages do not overlap researched segment", () => {
    const ctx = {
      clientBrief: { risk: "low" },
      artifacts: {
        ProductBrief: {
          data: {
            ...validProductBrief,
            keyMessages: [
              "Enterprise blockchain synergy for CFOs",
              "Quantum ledger optimization for finance teams",
            ],
          },
        },
        ICPProposal: { data: validICPProposal },
      },
    } as unknown as HarnessContext;

    const result = evaluateCP1(ctx);
    expect(result.passed).toBe(false);
    if (result.feedback?.kind === "product_unclear") {
      expect(result.feedback.vagueFields).toContain("keyMessages");
    }
  });
});
