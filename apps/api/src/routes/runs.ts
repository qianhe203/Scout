import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { randomUUID } from "node:crypto";
import { ClientBriefSchema, type RunEvent } from "@scout/shared";
import { Orchestrator } from "@scout/harness";

const runs = new Map<string, { status: string; events: RunEvent[] }>();

export function createRunsRouter(config: {
  runsDir: string;
  corsOrigin?: string;
}) {
  const app = new Hono();

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

    const runId = randomUUID();
    runs.set(runId, { status: "pending", events: [] });

    const orchestrator = new Orchestrator({
      runsDir: config.runsDir,
      runTokenBudget: Number(process.env.RUN_TOKEN_BUDGET ?? 50_000),
      runCostCapUsd: Number(process.env.RUN_COST_CAP ?? 2),
      maxRetriesPerStage: 2,
    });

    // U4: run async, stream events via pub/sub
    void orchestrator.startRun(runId, parsed.data).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      const entry = runs.get(runId);
      if (entry) {
        entry.status = "failed";
        entry.events.push({
          kind: "alarm",
          alarm: {
            type: "RUN_FAILED",
            context: { message },
            severity: "high",
            recommended_action: "Check API logs and HARNESS_PLANNING.md U2/U4",
            timestamp: new Date().toISOString(),
          },
        });
      }
    });

    return c.json({ runId, status: "pending" }, 201);
  });

  app.get("/runs/:id", (c) => {
    const run = runs.get(c.req.param("id"));
    if (!run) return c.json({ error: "Run not found" }, 404);
    return c.json(run);
  });

  app.get("/runs/:id/events", (c) => {
    const runId = c.req.param("id");
    const run = runs.get(runId);
    if (!run) return c.json({ error: "Run not found" }, 404);

    return streamSSE(c, async (stream) => {
      for (const event of run.events) {
        await stream.writeSSE({ data: JSON.stringify(event) });
      }
      await stream.writeSSE({
        data: JSON.stringify({
          kind: "human_required",
          reason: "Orchestrator stub — pipeline not wired yet (U2/U4)",
        }),
      });
    });
  });

  app.get("/health", (c) => c.json({ ok: true, service: "scout-api" }));

  return app;
}
