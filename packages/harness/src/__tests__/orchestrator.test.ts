import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Orchestrator } from "../orchestrator.js";
import { createMockWorkers } from "../testing/mock-workers.js";

describe("Orchestrator", () => {
  it("advances through all stages with mock workers", async () => {
    const dir = await mkdtemp(join(tmpdir(), "scout-orch-"));
    const runId = randomUUID();
    const events: string[] = [];

    const orchestrator = new Orchestrator(
      {
        runsDir: dir,
        runTokenBudget: 50_000,
        runCostCapUsd: 2,
        maxRetriesPerStage: 2,
        skipApprovalGate: true,
      },
      createMockWorkers(),
      (event) => {
        events.push(event.kind);
      },
    );

    await orchestrator.startRun(runId, {
      company: "Acme",
      companyDescription: "Meal kits",
      product: "Weekly box",
      budget: 2000,
      risk: "low",
    });

    const artifactFiles = await readdir(join(dir, runId, "artifacts"));
    expect(artifactFiles.some((f) => f.startsWith("ICPProposal_v"))).toBe(
      true,
    );
    expect(artifactFiles.some((f) => f.startsWith("RankedShortlist_v"))).toBe(
      true,
    );
    expect(artifactFiles.some((f) => f.startsWith("CampaignPack_v"))).toBe(
      true,
    );

    const meta = JSON.parse(
      await readFile(join(dir, runId, "meta.json"), "utf8"),
    );
    expect(meta.status).toBe("complete");
    expect(events).toContain("stage_started");
    expect(events).toContain("checkpoint");
    expect(events).toContain("run_complete");
  });

  it("creates RankedShortlist_v2 after G1 budget revision", async () => {
    const dir = await mkdtemp(join(tmpdir(), "scout-orch-"));
    const runId = randomUUID();

    const orchestrator = new Orchestrator(
      {
        runsDir: dir,
        runTokenBudget: 50_000,
        runCostCapUsd: 2,
        maxRetriesPerStage: 2,
        skipApprovalGate: true,
      },
      createMockWorkers(),
    );

    await orchestrator.startRun(runId, {
      company: "Acme",
      companyDescription: "Meal kits",
      product: "Weekly box",
      budget: 500,
      risk: "low",
    });

    const artifactFiles = await readdir(join(dir, runId, "artifacts"));
    expect(artifactFiles).toContain("RankedShortlist_v1.json");
    expect(artifactFiles).toContain("RankedShortlist_v2.json");

    const alarms = (
      await readFile(join(dir, runId, "alarms.jsonl"), "utf8")
    )
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(alarms.some((a) => a.type === "BUDGET_EXCEEDED")).toBe(true);
  });

  it("loadRun reconstructs context through checkpoint", async () => {
    const dir = await mkdtemp(join(tmpdir(), "scout-orch-"));
    const runId = randomUUID();

    const orchestrator = new Orchestrator(
      {
        runsDir: dir,
        runTokenBudget: 50_000,
        runCostCapUsd: 2,
        maxRetriesPerStage: 2,
        skipApprovalGate: false,
      },
      createMockWorkers(),
    );

    await orchestrator.startRun(runId, {
      company: "Acme",
      companyDescription: "Meal kits",
      product: "Weekly box",
      budget: 2000,
      risk: "low",
    });

    const { RunStore } = await import("../persistence/run-store.js");
    const store = new RunStore(dir);
    const loaded = await store.loadRun(runId, "CP0");

    expect(loaded.artifacts.ICPProposal).toBeDefined();
    expect(loaded.resumeStage).toBe("product");
  });
});
