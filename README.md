# Scout

An AI harness for creator discovery and evaluation — built for the [Fired Festival](https://fired-festival.com/harness) 24-hour Build Challenge.

> **Workers do tasks. The harness enforces constraints.**

[Influencers.club](https://influencers.club/influencer-api/) finds creators. Scout decides which ones are _allowed_, _affordable_, _brand-safe_, and _approved_.

## Docs

- [`docs/HARNESS_PLANNING.md`](docs/HARNESS_PLANNING.md) — master build spec (architecture, schemas, implementation order)
- [`docs/HACKATHON.md`](docs/HACKATHON.md) — demo script, defense prep, deliverables
- [`HARNESS.md`](HARNESS.md) — judge-facing architecture doc (deliverable)

## Stack

| Layer        | Tech                             | Deploy  |
| ------------ | -------------------------------- | ------- |
| Demo UI      | Next.js 15                       | Vercel  |
| API          | Hono                             | Railway |
| Harness      | TypeScript monorepo              | —       |
| Creator data | Influencers.club + seed fallback | —       |

## Local development

```bash
pnpm install
cp .env.example .env
pnpm dev:api   # http://localhost:3001
pnpm dev:web   # http://localhost:3000
```

Create `apps/web/.env.local`:

```
NEXT_PUBLIC_HARNESS_API_URL=http://localhost:3001
```

### Worker modes

| Mode | When to use | Keys required |
|------|-------------|---------------|
| `llm` (default) | Live demo with ICP research + creator discovery | LLM + web search + optional Influencers.club |
| `seed-only` | Offline dev / no API spend | None |

Pass `?workerMode=seed-only` on `POST /runs` or set `WORKER_MODE=seed-only`.

## Required API keys (live demo)

Set these on **Railway** (API) — never in the Next.js client bundle.

| Variable | Service | Purpose |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` | Anthropic / OpenAI | ICP, Product, Outreach workers + CP4 evaluator |
| `LLM_PROVIDER` | — | `anthropic`, `openai`, or `mock` |
| `TAVILY_API_KEY` or `SERPER_API_KEY` | Tavily / Serper | ICP web research |
| `INFLUENCERS_CLUB_API_KEY` | [Influencers.club](https://docs.influencers.club/) | Live creator discovery (falls back to seed) |

Optional: `OTEL_EXPORTER_OTLP_ENDPOINT`, `RUN_TOKEN_BUDGET`, `RUN_COST_CAP`, `CREATORS_SEED_PATH`.

## Deploy

### Railway (API + persistent runs)

1. Create a Railway project from this repo (uses root `railway.json`).
2. Attach a **volume** mounted at `/data/runs`.
3. Set service env vars (Railway dashboard — not committed `.env`):

| Variable | Example | Required |
|----------|---------|----------|
| `RUNS_DIR` | `/data/runs` | Yes (with volume) |
| `CORS_ORIGIN` | `https://your-app.vercel.app` | Yes (prod) |
| `LLM_PROVIDER` | `openai` or `anthropic` | For live LLM |
| `OPENAI_API_KEY` | `sk-...` | If `openai` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | If `anthropic` |
| `LLM_MODEL` | `gpt-4o-mini` | Recommended (defaults per provider if unset) |
| `TAVILY_API_KEY` | `tvly-...` | ICP web search |
| `WORKER_MODE` | `llm` or `seed-only` | No (default `llm`) |

Without `OPENAI_API_BASE`, OpenAI calls go to **`https://api.openai.com/v1`** (public API).

4. Generate a public domain → e.g. `https://scout-api.up.railway.app`.
5. Verify: `GET /health` → `{ ok: true }`.

### Vercel (web UI)

1. Import `apps/web` as the root directory (or monorepo with `vercel.json`).
2. Set `NEXT_PUBLIC_HARNESS_API_URL` to your Railway API URL.
3. Deploy.

## Repo layout

```
apps/web          Next.js demo UI
apps/api          Hono harness API + SSE
packages/shared   Zod schemas, RunEvent types
packages/harness  Orchestrator, guardrails, checkpoints, telemetry
packages/workers  ICP, Product, Research, Score, Outreach workers
data/creators.json  Seed fallback dataset (24 creators)
```

## License

MIT
