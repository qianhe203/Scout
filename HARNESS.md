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

---

*To be expanded during U8 with live demo URLs and trace screenshots.*
