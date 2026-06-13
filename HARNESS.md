# Scout — Harness Architecture

> Judge-facing defense doc. Full specification: [`docs/HARNESS_PLANNING.md`](docs/HARNESS_PLANNING.md).

## Thesis

**Workers do tasks. The harness enforces constraints.**

Scout is a constraint framework that governs swappable worker agents finding creators for a client's product. The harness (`packages/harness`) enforces guardrails, checkpoints, material handling, and alarms — separate from workers (`packages/workers`).

## Four pillars

| Pillar | Implementation |
|--------|----------------|
| **Loop** | Orchestrator stage machine with retry loops (e.g. G1 budget → ScoreWorker revises shortlist) |
| **Tools** | Website + web search (ICP), Influencers.club adapter, swappable workers |
| **Guardrails** | G1–G7 modules + CP0–CP4 checkpoints (CP4 evaluator separate from OutreachWorker) |
| **Observability** | OpenTelemetry spans, `run-log.json`, SSE, per-stage token/cost tracking |

## Architecture diagram

See [`docs/diagrams/creator-match-harness-architecture.svg`](docs/diagrams/creator-match-harness-architecture.svg).

## Key tradeoffs

- **Influencers.club as data pipe** — differentiation is harness constraints + client-specific scoring, not raw discovery
- **Vercel + Railway split** — UI stateless on Vercel; persistent `runs/{id}/` on Railway
- **ICP always researched** — client-stated audience is a hint; website + web search produce evidence-backed segments
- **JSON file persistence** — enables checkpoint replay without a database (hackathon scope)

## Failure modes

| Failure | Response |
|---------|----------|
| Influencers.club down | Seed adapter + `RESEARCH_SOURCE_DOWN` alarm |
| Thin ICP evidence | Automated retry with expanded search; continue with `ICP_LOW_CONFIDENCE` if still thin |
| Budget exceeded | G1 blocks → ScoreWorker revises → `RankedShortlist_v2` |
| Token budget exceeded | Pause + `HUMAN_REQUIRED` |
| CP4 professionalism fail | OutreachWorker revises with `professionalism_fail` feedback (max 2 retries) |

## Live demo path

1. Submit brief on Vercel UI → `POST /runs` on Railway API
2. Watch SSE timeline: ICP → Product → Research → Score → Outreach
3. G1 may trigger shortlist revision (`RankedShortlist_v2`) when over budget
4. Approve export → `runs/{id}/export/campaign-pack.csv` + `summary.md`
5. Download links appear in UI when status is `complete`

## Observability

- Per-run: `runs/{id}/events.jsonl`, `telemetry.jsonl`, `run-log.json`
- Optional OTLP export via `OTEL_EXPORTER_OTLP_ENDPOINT`
- CostPanel in UI aggregates `llm_call` SSE events

---

*Deploy URLs: set after Railway + Vercel provisioning (see README).*
