# Scout

An AI harness for creator discovery and evaluation

> **Workers do tasks. The harness enforces constraints.**

[Influencers.club](https://influencers.club/influencer-api/) finds creators. Scout decides which ones are _allowed_, _affordable_, _brand-safe_, and _approved_.

## Docs

- [`docs/HARNESS_PLANNING.md`](docs/HARNESS_PLANNING.md) — master build spec (architecture, schemas, implementation order)
- [`docs/HACKATHON.md`](docs/HACKATHON.md) — demo script, defense prep, deliverables
- [`HARNESS.md`](HARNESS.md) — judge-facing architecture doc (deliverable)

## Stack

| Layer        | Tech                             | Deploy  |
| ------------ | -------------------------------- | ------- |
| Demo UI      | Next.js 15                       | Railway (same service as API) |
| API          | Hono                             | Railway (internal + proxy)    |
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

### Railway (UI + API on one URL)

`railway.json` builds both apps and runs `scripts/start-railway.mjs`: Next.js on the public port, Hono API on `127.0.0.1:3001`, with `/runs` and `/health` proxied through Next.

1. Deploy from this repo (root `railway.json`).
2. Attach a **volume** at `/data/runs`.
3. Set env vars:

| Variable | Example |
|----------|---------|
| `RUNS_DIR` | `/data/runs` |
| `CORS_ORIGIN` | `https://web-production-fd9db8.up.railway.app` |
| `LLM_PROVIDER` | `openai` |
| `OPENAI_API_KEY` | your key |
| `LLM_MODEL` | `gpt-4o-mini` |
| `TAVILY_API_KEY` | for ICP research |

Leave **`NEXT_PUBLIC_HARNESS_API_URL` unset** on Railway (same-origin API via proxy).

4. Redeploy → `https://your-app.up.railway.app/` shows the Scout UI.

### Vercel (optional split deploy)

1. Import `apps/web` with `vercel.json`.
2. Set `NEXT_PUBLIC_HARNESS_API_URL` to a separate Railway API URL.
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
