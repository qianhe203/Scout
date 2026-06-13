import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ClientBriefSchema,
  type HarnessRunLog,
  type RunEvent,
  type RunStatus,
} from "@scout/shared";
import { Orchestrator, RunStore, type WorkerRegistry } from "@scout/harness";
import { appendRunEvent, isTerminalEvent, loadRunEvents } from "../events/store.js";
import { createCP4EvaluatorFromEnv } from "@scout/workers";
import { createWorkers, type WorkerMode } from "../worker-registry.js";
import { RunPubSub, runPubSub } from "../sse/pubsub.js";

const TERMINAL_STATUSES = new Set<RunStatus>([
  "complete",
  "awaiting_approval",
  "failed",
]);

export interface RunsRouterConfig {
  runsDir: string;
  corsOrigin?: string;
  pubsub?: RunPubSub;
  skipApprovalGate?: boolean;
  resolveWorkers?: (mode: WorkerMode) => WorkerRegistry;
}

function parseWorkerMode(value: string | undefined): WorkerMode {
  const resolved = value ?? process.env.WORKER_MODE;
  return resolved === "seed-only" ? "seed-only" : "llm";
}

function harnessConfig(config: RunsRouterConfig) {
  return {
    runsDir: config.runsDir,
    runTokenBudget: Number(process.env.RUN_TOKEN_BUDGET ?? 50_000),
    runCostCapUsd: Number(process.env.RUN_COST_CAP ?? 2),
    maxRetriesPerStage: 2,
    skipApprovalGate: config.skipApprovalGate ?? false,
    cp4Evaluator: createCP4EvaluatorFromEnv(),
  };
}

async function runExists(runsDir: string, runId: string): Promise<boolean> {
  try {
    await readFile(join(runsDir, runId, "meta.json"), "utf8");
    return true;
  } catch {
    return false;
  }
}

async function loadRunLog(
  runsDir: string,
  runId: string,
): Promise<HarnessRunLog | null> {
  try {
    const raw = await readFile(join(runsDir, runId, "run-log.json"), "utf8");
    return JSON.parse(raw) as HarnessRunLog;
  } catch {
    return null;
  }
}

function createOrchestrator(
  config: RunsRouterConfig,
  workers: WorkerRegistry,
  onEvent: (event: RunEvent) => Promise<void>,
): Orchestrator {
  return new Orchestrator(harnessConfig(config), workers, onEvent);
}

async function finalizeRunStatus(
  runsDir: string,
  runId: string,
  skipApprovalGate: boolean,
): Promise<RunStatus> {
  const store = new RunStore(runsDir);
  const meta = await store.loadMeta(runId);
  if (meta.status === "running") {
    meta.status = skipApprovalGate ? "complete" : "awaiting_approval";
    await store.writeMeta(meta);
  }
  return meta.status;
}

export function createRunsRouter(config: RunsRouterConfig) {
  const app = new Hono();
  const pubsub = config.pubsub ?? runPubSub;
  const resolveWorkers = config.resolveWorkers ?? createWorkers;
  const runStore = new RunStore(config.runsDir);

  app.use(
    "*",
    cors({
      origin: config.corsOrigin ?? "*",
    }),
  );

  app.post("/runs", async (c) => {
    const body = await c.req.json();
    const parsed = ClientBriefSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const workerMode = parseWorkerMode(c.req.query("workerMode"));
    const runId = randomUUID();
    pubsub.initRun(runId);

    const onEvent = async (event: RunEvent) => {
      await appendRunEvent(config.runsDir, runId, event);
      await pubsub.publish(runId, event);
    };

    const orchestrator = createOrchestrator(
      config,
      resolveWorkers(workerMode),
      onEvent,
    );

    void orchestrator
      .startRun(runId, parsed.data)
      .then(async () => {
        await finalizeRunStatus(
          config.runsDir,
          runId,
          config.skipApprovalGate ?? false,
        );
      })
      .catch(async (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        const alarmEvent: RunEvent = {
          kind: "alarm",
          alarm: {
            type: "RUN_FAILED",
            context: { message },
            severity: "high",
            recommended_action: "Check API logs",
            timestamp: new Date().toISOString(),
          },
        };
        await onEvent(alarmEvent);
        try {
          const meta = await runStore.loadMeta(runId);
          meta.status = "failed";
          await runStore.writeMeta(meta);
        } catch {
          // run may not have initialized
        }
      });

    return c.json({ runId, status: "pending" as const }, 201);
  });

  app.get("/runs/:id", async (c) => {
    const runId = c.req.param("id");
    if (!(await runExists(config.runsDir, runId))) {
      return c.json({ error: "Run not found" }, 404);
    }

    const meta = await runStore.loadMeta(runId);
    const runLog = await loadRunLog(config.runsDir, runId);
    const events = await loadRunEvents(config.runsDir, runId);

    return c.json({
      runId: meta.runId,
      status: meta.status,
      currentStage: meta.currentStage,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      retryCounts: meta.retryCounts,
      telemetry: runLog
        ? {
            totalInputTokens: runLog.totalInputTokens,
            totalOutputTokens: runLog.totalOutputTokens,
            totalEstimatedCostUsd: runLog.totalEstimatedCostUsd,
            stages: runLog.stages,
          }
        : null,
      alarms: runLog?.alarms ?? [],
      eventCount: events.length,
    });
  });

  app.get("/runs/:id/telemetry", async (c) => {
    const runId = c.req.param("id");
    if (!(await runExists(config.runsDir, runId))) {
      return c.json({ error: "Run not found" }, 404);
    }

    const runLog = await loadRunLog(config.runsDir, runId);
    if (!runLog) {
      return c.json({ error: "Telemetry not available yet" }, 404);
    }

    return c.json({
      runId,
      stages: runLog.stages,
      totalInputTokens: runLog.totalInputTokens,
      totalOutputTokens: runLog.totalOutputTokens,
      totalEstimatedCostUsd: runLog.totalEstimatedCostUsd,
      alarms: runLog.alarms,
    });
  });

  app.get("/runs/:id/artifacts/:type", async (c) => {
    const runId = c.req.param("id");
    const type = c.req.param("type");
    if (!(await runExists(config.runsDir, runId))) {
      return c.json({ error: "Run not found" }, 404);
    }

    const artifact = await runStore.materialsStore.loadLatest(runId, type);
    if (!artifact) {
      return c.json({ error: `Artifact ${type} not found` }, 404);
    }

    return c.json(artifact);
  });

  app.get("/runs/:id/events", async (c) => {
    const runId = c.req.param("id");
    if (!(await runExists(config.runsDir, runId))) {
      return c.json({ error: "Run not found" }, 404);
    }

    return streamSSE(c, async (stream) => {
      const history = await loadRunEvents(config.runsDir, runId);
      for (const event of history) {
        await stream.writeSSE({ data: JSON.stringify(event) });
      }

      let closed = false;
      const close = () => {
        closed = true;
      };

      stream.onAbort(close);

      const meta = await runStore.loadMeta(runId);
      if (TERMINAL_STATUSES.has(meta.status)) {
        return;
      }

      await new Promise<void>((resolve) => {
        const unsub = pubsub.subscribe(runId, async (event) => {
          if (closed) return;
          await stream.writeSSE({ data: JSON.stringify(event) });
          if (isTerminalEvent(event)) {
            unsub();
            resolve();
          }
        });

        stream.onAbort(() => {
          unsub();
          resolve();
        });

        const poll = setInterval(async () => {
          if (closed) {
            clearInterval(poll);
            unsub();
            resolve();
            return;
          }
          try {
            const current = await runStore.loadMeta(runId);
            if (TERMINAL_STATUSES.has(current.status)) {
              clearInterval(poll);
              unsub();
              resolve();
            }
          } catch {
            clearInterval(poll);
            unsub();
            resolve();
          }
        }, 50);
      });
    });
  });

  app.post("/runs/:id/replay", async (c) => {
    const runId = c.req.param("id");
    const from = c.req.query("from");
    if (!from) {
      return c.json({ error: "Query param 'from' is required (e.g. CP2)" }, 400);
    }

    if (!(await runExists(config.runsDir, runId))) {
      return c.json({ error: "Run not found" }, 404);
    }

    const workerMode = parseWorkerMode(c.req.query("workerMode"));
    pubsub.initRun(runId);

    const onEvent = async (event: RunEvent) => {
      await appendRunEvent(config.runsDir, runId, event);
      await pubsub.publish(runId, event);
    };

    const orchestrator = createOrchestrator(
      config,
      resolveWorkers(workerMode),
      onEvent,
    );

    void orchestrator
      .resumeRun(runId, from)
      .then(async () => {
        await finalizeRunStatus(
          config.runsDir,
          runId,
          config.skipApprovalGate ?? false,
        );
      })
      .catch(async (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        await onEvent({
          kind: "alarm",
          alarm: {
            type: "RUN_FAILED",
            context: { message, replayFrom: from },
            severity: "high",
            recommended_action: "Check replay checkpoint and artifacts",
            timestamp: new Date().toISOString(),
          },
        });
        const meta = await runStore.loadMeta(runId);
        meta.status = "failed";
        await runStore.writeMeta(meta);
      });

    return c.json({ runId, status: "running" as const, replayFrom: from }, 202);
  });

  app.post("/runs/:id/approve", async (c) => {
    const runId = c.req.param("id");
    if (!(await runExists(config.runsDir, runId))) {
      return c.json({ error: "Run not found" }, 404);
    }

    const meta = await runStore.loadMeta(runId);
    if (meta.status !== "awaiting_approval") {
      return c.json(
        { error: `Run is not awaiting approval (status: ${meta.status})` },
        400,
      );
    }

    const workerMode = parseWorkerMode(c.req.query("workerMode"));
    pubsub.initRun(runId);

    const onEvent = async (event: RunEvent) => {
      await appendRunEvent(config.runsDir, runId, event);
      await pubsub.publish(runId, event);
    };

    const orchestrator = createOrchestrator(
      { ...config, skipApprovalGate: true },
      resolveWorkers(workerMode),
      onEvent,
    );

    void orchestrator
      .resumeRun(runId, "CP4")
      .then(async () => {
        const updated = await runStore.loadMeta(runId);
        updated.status = "complete";
        await runStore.writeMeta(updated);
      })
      .catch(async (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        await onEvent({
          kind: "alarm",
          alarm: {
            type: "RUN_FAILED",
            context: { message, phase: "approve" },
            severity: "high",
            recommended_action: "Check export stage logs",
            timestamp: new Date().toISOString(),
          },
        });
        meta.status = "failed";
        await runStore.writeMeta(meta);
      });

    return c.json({ runId, status: "running" as const }, 202);
  });

  app.get("/runs/:id/export/:file", async (c) => {
    const runId = c.req.param("id");
    const file = c.req.param("file");
    if (!(await runExists(config.runsDir, runId))) {
      return c.json({ error: "Run not found" }, 404);
    }

    const allowed = new Set(["campaign-pack.csv", "summary.md"]);
    if (!allowed.has(file)) {
      return c.json({ error: "Unknown export file" }, 404);
    }

    const path = join(config.runsDir, runId, "export", file);
    try {
      const content = await readFile(path, "utf8");
      if (file.endsWith(".csv")) {
        return c.text(content, 200, {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${file}"`,
        });
      }
      return c.text(content, 200, {
        "Content-Type": "text/markdown; charset=utf-8",
      });
    } catch {
      return c.json({ error: "Export not available yet" }, 404);
    }
  });

  app.get("/health", (c) => c.json({ ok: true, service: "scout-api" }));

  return app;
}
