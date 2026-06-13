import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { initInstrumentation } from "./instrumentation.js";
import { createRunsRouter } from "./routes/runs.js";

initInstrumentation();

const port = Number(process.env.PORT ?? 3001);
const runsDir = process.env.RUNS_DIR ?? "./runs";
const corsOrigin = process.env.CORS_ORIGIN;

const app = new Hono();

app.get("/", (c) =>
  c.json({
    name: "Scout API",
    docs: "docs/HARNESS_PLANNING.md",
    health: "/health",
  }),
);

app.route("/", createRunsRouter({ runsDir, corsOrigin }));

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Scout API listening on http://localhost:${info.port}`);
  console.log(`Runs directory: ${runsDir}`);
});
