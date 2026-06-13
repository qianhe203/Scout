import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { AlarmEmitter } from "../alarms/emit.js";

describe("AlarmEmitter", () => {
  it("appends one JSON line to alarms.jsonl", async () => {
    const dir = await mkdtemp(join(tmpdir(), "scout-alarm-"));
    const emitter = new AlarmEmitter(dir);
    const runId = "run-1";

    await emitter.emit(runId, {
      type: "BUDGET_EXCEEDED",
      severity: "high",
      context: { budget: 500 },
      recommended_action: "Revise shortlist",
      timestamp: "2026-06-13T00:00:00.000Z",
    });

    const raw = await readFile(join(dir, runId, "alarms.jsonl"), "utf8");
    const lines = raw.trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!).type).toBe("BUDGET_EXCEEDED");
  });
});
