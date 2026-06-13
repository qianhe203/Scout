import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { initInstrumentation } from "./instrumentation.js";
import { loadRootEnv } from "./load-env.js";
import { createRunsRouter } from "./routes/runs.js";

loadRootEnv();
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
  const llmBase =
    process.env.OPENAI_API_BASE?.trim() ?? "https://api.openai.com/v1 (default)";
  console.log(
    `LLM provider: ${process.env.LLM_PROVIDER ?? "mock"} | base: ${llmBase} | model: ${process.env.LLM_MODEL ?? "(worker default)"}`,
  );
});
