import { describe, expect, it, vi } from "vitest";
import { estimateCostUsd } from "@scout/shared";
import { callLLM } from "../llm.js";
import { MockLLMProvider } from "../llm-provider.js";

describe("callLLM", () => {
  it("computes estimatedCostUsd from model pricing", async () => {
    const append = vi.fn().mockResolvedValue(undefined);
    const provider = new MockLLMProvider('{"ok":true}', {
      input_tokens: 1000,
      output_tokens: 500,
    });

    const result = await callLLM({
      runId: "run-1",
      stage: "icp",
      worker: "ICPWorker",
      purpose: "icp_synthesis",
      model: "claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "test" }],
      provider,
      telemetry: { append },
    });

    const expected = estimateCostUsd(
      "claude-sonnet-4-20250514",
      1000,
      500,
    );
    expect(result.usage.input_tokens).toBe(1000);
    expect(append).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({
        kind: "llm_call",
        estimatedCostUsd: expected,
      }),
    );
  });
});
