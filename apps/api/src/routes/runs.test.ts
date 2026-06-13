import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { HarnessContext, Worker, WorkerRegistry } from "@scout/harness";
import { createMockWorkers } from "@scout/harness";
import { RunPubSub } from "../sse/pubsub.js";
import { createRunsRouter } from "./runs.js";

const sampleBrief = {
  company: "FitFuel Co",
  companyDescription: "Organic protein shakes for millennials",
  product: "Plant-based protein shake",
  budget: 5000,
  risk: "low" as const,
};

function createCountingWorkers(): WorkerRegistry & {
  counts: Record<string, number>;
} {
  const base = createMockWorkers();
  const counts: Record<string, number> = {};
  const wrap = (worker: Worker): Worker => ({
    name: worker.name,
    async run(ctx: HarnessContext) {
      counts[worker.name] = (counts[worker.name] ?? 0) + 1;
      return worker.run(ctx);
    },
  });

  return {
    counts,
    icp: wrap(base.icp),
    product: wrap(base.product),
    research: wrap(base.research),
    score: wrap(base.score),
    outreach: wrap(base.outreach),
  };
}

async function waitForRunDir(
  runsDir: string,
  runId: string,
  timeoutMs = 5_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await readFile(join(runsDir, runId, "meta.json"), "utf8");
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 20));
    }
  }
  throw new Error(`Run directory not created for ${runId}`);
}

async function waitForTerminalStatus(
  app: ReturnType<typeof createRunsRouter>,
  runId: string,
  timeoutMs = 15_000,
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await app.request(`/runs/${runId}`);
    if (res.status === 200) {
      const body = (await res.json()) as { status: string };
      if (
        body.status === "awaiting_approval" ||
        body.status === "complete" ||
        body.status === "failed"
      ) {
        return body.status;
      }
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Timed out waiting for run ${runId}`);
}

function parseSseEvents(body: string): Array<{ kind: string }> {
  return body
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5).trim()) as { kind: string });
}

describe("runs API", () => {
  it("POST /runs returns 201 with runId before pipeline completes", async () => {
    const runsDir = await mkdtemp(join(tmpdir(), "scout-api-"));
    const pubsub = new RunPubSub();
    const app = createRunsRouter({
      runsDir,
      pubsub,
      resolveWorkers: () => createMockWorkers(),
    });

    const res = await app.request("/runs?workerMode=seed-only", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sampleBrief),
    });

    expect(res.status).toBe(201);
    const { runId, status } = (await res.json()) as {
      runId: string;
      status: string;
    };
    expect(status).toBe("pending");
    expect(runId).toBeTruthy();

    await waitForRunDir(runsDir, runId);
    const meta = JSON.parse(
      await readFile(join(runsDir, runId, "meta.json"), "utf8"),
    );
    expect(meta.runId).toBe(runId);
  });

  it("SSE stream receives stage_started then artifact_written in order", async () => {
    const runsDir = await mkdtemp(join(tmpdir(), "scout-api-"));
    const pubsub = new RunPubSub();
    const app = createRunsRouter({
      runsDir,
      pubsub,
      resolveWorkers: () => createMockWorkers(),
    });

    const createRes = await app.request("/runs?workerMode=seed-only", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sampleBrief),
    });
    const { runId } = (await createRes.json()) as { runId: string };
    await waitForRunDir(runsDir, runId);

    const sseRes = await app.request(`/runs/${runId}/events`);
    expect(sseRes.status).toBe(200);

    const body = await sseRes.text();
    const events = parseSseEvents(body);
    expect(events.length).toBeGreaterThan(0);
    const firstStageStarted = events.findIndex((e) => e.kind === "stage_started");
    const firstArtifact = events.findIndex((e) => e.kind === "artifact_written");
    expect(firstStageStarted).toBeGreaterThanOrEqual(0);
    expect(firstArtifact).toBeGreaterThanOrEqual(0);
    expect(firstStageStarted).toBeLessThan(firstArtifact);
  });

  it("GET /runs/:id returns disk-backed status and telemetry summary", async () => {
    const runsDir = await mkdtemp(join(tmpdir(), "scout-api-"));
    const app = createRunsRouter({
      runsDir,
      resolveWorkers: () => createMockWorkers(),
    });

    const createRes = await app.request("/runs?workerMode=seed-only", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sampleBrief),
    });
    const { runId } = (await createRes.json()) as { runId: string };

    const terminal = await waitForTerminalStatus(app, runId);
    expect(terminal).toBe("awaiting_approval");

    const getRes = await app.request(`/runs/${runId}`);
    expect(getRes.status).toBe(200);
    const summary = (await getRes.json()) as {
      status: string;
      eventCount: number;
      telemetry: { stages: unknown[] } | null;
    };
    expect(summary.status).toBe("awaiting_approval");
    expect(summary.eventCount).toBeGreaterThan(0);
    expect(summary.telemetry?.stages.length).toBeGreaterThan(0);

    const icpRes = await app.request(`/runs/${runId}/artifacts/ICPProposal`);
    expect(icpRes.status).toBe(200);
  });

  it("POST /runs/:id/replay?from=CP2 skips stages 0–2", async () => {
    const runsDir = await mkdtemp(join(tmpdir(), "scout-api-"));
    const workers = createCountingWorkers();
    const app = createRunsRouter({
      runsDir,
      resolveWorkers: () => workers,
    });

    const createRes = await app.request("/runs?workerMode=seed-only", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sampleBrief),
    });
    const { runId } = (await createRes.json()) as { runId: string };
    await waitForTerminalStatus(app, runId);

    const beforeIcp = workers.counts.ICPWorker ?? 0;
    const beforeProduct = workers.counts.ProductWorker ?? 0;
    const beforeResearch = workers.counts.ResearchWorker ?? 0;

    const replayRes = await app.request(
      `/runs/${runId}/replay?from=CP2&workerMode=seed-only`,
      { method: "POST" },
    );
    expect(replayRes.status).toBe(202);

    await waitForTerminalStatus(app, runId);

    expect(workers.counts.ICPWorker ?? 0).toBe(beforeIcp);
    expect(workers.counts.ProductWorker ?? 0).toBe(beforeProduct);
    expect(workers.counts.ResearchWorker ?? 0).toBe(beforeResearch);
    expect(workers.counts.ScoreWorker ?? 0).toBeGreaterThan(0);
  });
});
