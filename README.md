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
pnpm dev:api   # http://localhost:3001
pnpm dev:web   # http://localhost:3000
```

Create `apps/web/.env.local`:

```
NEXT_PUBLIC_HARNESS_API_URL=http://localhost:3001
```

## Repo layout

```
apps/web          Next.js demo UI
apps/api          Hono harness API + SSE
packages/shared   Zod schemas, RunEvent types
packages/harness  Orchestrator, guardrails, checkpoints, telemetry
packages/workers  ICP, Product, Research, Score, Outreach workers
data/creators.json  Seed fallback dataset
```

## License

MIT
