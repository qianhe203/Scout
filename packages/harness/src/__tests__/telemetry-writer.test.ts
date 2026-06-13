import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { TelemetryWriter } from "../telemetry/writer.js";

describe("TelemetryWriter", () => {
  it("initializes run-log and records stage telemetry", async () => {
    const dir = await mkdtemp(join(tmpdir(), "scout-tel-"));
    const writer = new TelemetryWriter(dir, 50_000, 2);
    const runId = "run-telemetry";

    await writer.initRunLog(runId);
    await writer.recordStageTelemetry(runId, {
      stage: "icp",
      durationMs: 120,
      llmCalls: 1,
      inputTokens: 100,
      outputTokens: 50,
      estimatedCostUsd: 0.01,
      toolCalls: [],
    });

    const log = JSON.parse(
      await readFile(join(dir, runId, "run-log.json"), "utf8"),
    );
    expect(log.stages).toHaveLength(1);
    expect(log.stages[0].stage).toBe("icp");

    const telemetry = await readFile(
      join(dir, runId, "telemetry.jsonl"),
      "utf8",
    );
    expect(telemetry).toContain("stage_telemetry");
  });

  it("detects token budget exceeded", async () => {
    const dir = await mkdtemp(join(tmpdir(), "scout-tel-"));
    const writer = new TelemetryWriter(dir, 100, 2);
    const runId = "run-budget";

    await writer.initRunLog(runId);
    await writer.append(runId, {
      kind: "llm_call",
      inputTokens: 60,
      outputTokens: 50,
      estimatedCostUsd: 0.01,
    });

    expect(await writer.exceedsTokenBudget(runId)).toBe(true);
  });
});
