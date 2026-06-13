# Scout — Fired Festival Hackathon Guide

**Event:** [Fired Festival](https://fired-festival.com/harness) 24-hour Build Challenge  
**Build doc:** [`HARNESS_PLANNING.md`](./HARNESS_PLANNING.md) — use that file to implement; use this file to win the review  
**Architecture diagram:** [`diagrams/creator-match-harness-architecture.svg`](./diagrams/creator-match-harness-architecture.svg)

---

## Table of contents

1. [What judges care about](#what-judges-care-about)
2. [Challenge alignment](#challenge-alignment)
3. [Deliverables & deadlines](#deliverables--deadlines)
4. [24-hour build schedule](#24-hour-build-schedule)
5. [Demo script (5 min)](#demo-script-5-min)
6. [Architecture defense (5 min)](#architecture-defense-5-min)
7. [What to show vs what to say](#what-to-show-vs-what-to-say)
8. [Pre-demo checklist](#pre-demo-checklist)
9. [Success criteria (judging)](#success-criteria-judging)
10. [Pitch & talking points](#pitch--talking-points)
11. [Time-crunch priorities](#time-crunch-priorities)

---

## What judges care about

You are evaluated on **harness design** — how guardrails, checkpoints, material handling, and alarms govern workers — **not** on whether creator-matching is a novel product.

**Defense line:**

> [Influencers.club](https://influencers.club/influencer-api/) finds creators. Scout decides which ones are *allowed*, *affordable*, *brand-safe*, and *approved*.

**Pitch:**

> Scout wraps creator databases in a constraint harness with full observability — every token, every guardrail, and every research source that shaped the ICP.

### Where to spend defense time

| Area | ~Weight | What to prove |
|------|---------|---------------|
| Harness constraints | ~60% | G1 loop, CP4 separate from worker, alarms, human gate, replay |
| Worker logic | ~40% | ICP multi-source evidence, query translator, client-specific scoring rubric |

### Demo moments that map to pillars

| Capability | Demo moment | Pillar |
|------------|-------------|--------|
| G1 Budget guardrail | Shortlist total > budget → ScoreWorker revises → `BUDGET_EXCEEDED` alarm | Guardrails |
| G2/G3 Platform rules | Allow/block applied before API call | Guardrails |
| G4 Risk tier | Same API data, different shortlist for `risk=low` vs `high` | Guardrails |
| CP0–CP4 checkpoints | CP4 fail → OutreachWorker revises with critique → pass | Guardrails |
| Human approval gate | Nothing exports without approve; G6 blocks all sends | Guardrails |
| Alarms + replay | Structured JSON on screen; `runs/{id}/` audit trail | Loop + Observability |
| Token/cost telemetry | Per-stage LLM cost visible; spin detection alarm | Observability |
| ICP multi-source | ≥3 evidence source types in ICPProposal; retry ladder in run log | Tools |
| Worker swap | Same harness, `seed-only` research worker | Tools |

**Live code moment:** open `packages/harness/guardrails/g1-budget.ts` and show it is separate from `ScoreWorker`.

---

## Challenge alignment

### Fired Festival four pillars

| Pillar | How Scout implements it |
|--------|---------------------------|
| **1. Chat / Loop** | Orchestrator — stage machine with retry loops and stop conditions |
| **2. Tools** | Multi-source ICP · Influencers.club adapter · LLM structured output · swappable workers |
| **3. Guardrails** | G1–G7 modules + CP0–CP4 checkpoints (distinct from workers) |
| **4. Observability** | OpenTelemetry spans + run artifacts + SSE + cost/token tracking |

### Challenge requirements (summary)

| Must | Scout implementation |
|------|------------------------|
| Four pillars as separate code from workers | `packages/harness/{guardrails,checkpoints,materials,alarms}/` |
| Meaningful feedback loop | G1 → ScoreWorker revises; CP4 → OutreachWorker revises |
| Explicit guardrails & checkpoint criteria | Declared in code + Zod schemas |
| Structured alarms | `{ type, context, severity, recommended_action }` |
| Real input in demo | Engineer's own company/product |
| `HARNESS.md` | Judge-facing doc derived from build plan |

| Should | Scout implementation |
|--------|------------------------|
| Swappable workers | `Worker.run(ctx) → Artifact` interface + registry |
| Checkpoint persistence | `runs/{id}/checkpoints/` + replay API |
| Human-in-the-loop | Export approval gate; escalation on scandal/token cap |

| Bonus | Scout implementation |
|-------|------------------------|
| Swap second worker live | `?workerMode=seed-only` on POST /runs |

---

## Deliverables & deadlines

| When | Deliverable |
|------|-------------|
| **Friday 11:30 PM** | 1-page harness planning doc → [`HARNESS_PLANNING.md`](./HARNESS_PLANNING.md) |
| **Saturday 4:30 PM** | Project repo URL — [github.com/qianhe203/Scout](https://github.com/qianhe203/Scout) |
| **Saturday 4:30 PM** | Deployed harness URL (Vercel UI + Railway API) |
| **Saturday 4:30 PM** | `HARNESS.md` — architecture + tradeoffs for judges |
| **Saturday 4:30 PM** | 5-minute demo video |

**Submitted URL:** Vercel URL as primary "deployed harness URL"; API URL in README and `HARNESS.md`.

---

## 24-hour build schedule

| Phase | Hours | Deliverable |
|-------|-------|-------------|
| **U1. Shared schemas** | 0–2 | All Zod artifacts + RunEvent + HarnessRunLog + model-pricing |
| **U2. Harness core + telemetry** | 2–6 | Orchestrator, persistence, alarms, OTel bootstrap, llm.ts, G1 + CP0 |
| **U3. Seed path** | 6–9 | SeedResearchWorker + rule-based ScoreWorker — pipeline without live LLM |
| **U4. API + SSE** | 9–12 | POST /runs, event stream, run-log + telemetry.jsonl |
| **U5. Next.js shell** | 12–16 | BriefForm, timeline, AlarmPanel, CostPanel |
| **U6. Full workers** | 6–20 | ICP adapters, Influencers.club, all LLM workers, CP4 evaluator |
| **U7. Demo loops** | 20–22 | G1 revision + CP4 retry + ICP evidence visible in UI |
| **U8. Deploy + HARNESS.md** | 22–24 | Vercel + Railway; OTel link in README |

**Critical path:** U1 → U2 → U3 → U4 → U7.

**Do not cut for demo:** G1 loop, alarms on SSE, run-log persistence, LLM token tracking, ICP multi-source research.

See [`HARNESS_PLANNING.md` — Implementation order](./HARNESS_PLANNING.md#implementation-order) for the step sequence without hour labels.

---

## Demo script (5 min)

| # | Beat | Pillar | What judges see |
|---|------|--------|-----------------|
| 1 | Brief → ICP with ≥3 evidence sources | Loop + Tools | Category + competitor snippets + creator-graph tags; `clientAlignment` |
| 2 | Translated Influencers.club query | Tools | Query translator, dumb adapter |
| 3 | Creators returned | Tools | Live API + CP2 pass |
| 4 | **Budget guardrail** | Guardrails | RankedShortlist_v2, `BUDGET_EXCEEDED` alarm |
| 5 | CP4 fail → revise → pass | Guardrails | Separate evaluator, not OutreachWorker |
| 6 | **Observability** | Observability | CostPanel, telemetry.jsonl, OTel trace ID |
| 7 | Human approve → CampaignPack | Guardrails | Rationales + ICP evidence in export |
| 8 | *(Bonus)* Seed worker swap | Tools | Same harness, different adapter |

### Demo beat → technical trigger map

| Demo beat | Under the hood |
|-----------|----------------|
| Submit brief ($2k, low risk) | POST /runs → orchestrator starts, SSE connects |
| ICP with evidence | Stage 0 → category + competitor search + creator graph → ICPProposal_v1 → CP0 (≥3 sources) |
| ICP thin evidence retry | Stage 0 pass 2 → product page + expanded search → `ICP_EVIDENCE_THIN` alarm on SSE |
| Research returns creators | ResearchWorker → influencers-club → CreatorCandidates_v1 → CP2 |
| Budget guardrail | ScoreWorker shortlist > $2k → G1 → feedback → RankedShortlist_v2 → alarm |
| CP4 fail → pass | CP4 scores <80 → OutreachWorker revises → CP4 pass |
| Cost panel updates | llm_call events stream per stage |
| Approve export | POST /approve → CampaignPack CSV + summary.md |

### ICP demo narrative

> "Client said 'fitness influencers' but didn't know their real buyer. Scout ran **category search**, **competitor inference**, and **creator-graph clustering** — three independent sources — and found the product fits **home-workout beginners**, not gym bros. When pass 1 was thin, it automatically retried with the product page and broader review-site queries. No human in the loop until export."

---

## Architecture defense (5 min)

**Format:** 4–5 people per group, alphabetical order, 5 min present + 5 min Q&A each.

### Presentation outline

1. **Thesis (30s)** — "Influencers.club finds creators; Scout enforces constraints with full observability." Show [`creator-match-harness-architecture.svg`](./diagrams/creator-match-harness-architecture.svg).

2. **Four pillars (2m):**
   - Loop: G1 retry → RankedShortlist_v2
   - Tools: ICP web research + influencers-club adapter + worker swap
   - Guardrails: `g1-budget.ts` ≠ ScoreWorker
   - Observability: CostPanel + alarm JSON + OTel trace + run-log.json

3. **Tradeoffs (1.5m)** — API as data pipe; client audience as hint only; Tavily not Clearbit; Vercel/Railway split; CP4 as separate checkpoint module; no human at CP0.

4. **Failure modes (1m)** — API down → seed + alarm; ICP thin evidence → automated retry → low-confidence continue; token budget → pause; scandal → G4 + escalate.

### Questions to expect

- Why are checkpoints separate from workers?
- What happens when ICP evidence is thin?
- How does the budget guardrail change worker behavior?
- Why Influencers.club + seed instead of scraping Instagram?
- How do you prove the harness is swappable?

---

## What to show vs what to say

| Show (live) | Say (don't need to show code) |
|-------------|-------------------------------|
| UI pipeline + alarm JSON | Orchestrator state machine design |
| `g1-budget.ts` file | All guardrails are pure functions |
| Artifact version v1 → v2 after G1 | Material handling immutability |
| OTel trace or run-log.json | Full observability stack |
| Worker registry swap | Swappable interface |

---

## Pre-demo checklist

### Demo input (required by challenge)

- [ ] **Demo company/product** — real input you own (not fictional)
- [ ] **Demo company website URL** — for ICP retry beat (optional on pass 1)
- [ ] **Product page URL** — optional; triggers retry if evidence thin
- [ ] Brief rehearsed: $2k budget, `risk=low`, optional wrong audience hint to show `clientAlignment`

### API keys & fallbacks

- [ ] Influencers.club API key + one successful discovery call
- [ ] Tavily or Serper API key + one search call
- [ ] `data/creators.json` seeded — 20–30 creators, ≥3 platforms (fallback if API down)

### Deploy & docs

- [ ] Repo pushed — [github.com/qianhe203/Scout](https://github.com/qianhe203/Scout)
- [ ] Vercel UI live
- [ ] Railway API live with `/data/runs` volume
- [ ] `HARNESS.md` committed for judges
- [ ] 5-min demo video recorded
- [ ] OTel trace link in README (optional — Jaeger/Honeycomb or console screenshot)

### Demo path dry-run

- [ ] Full run completes in <90s
- [ ] G1 budget alarm fires visibly
- [ ] CP4 retry loop works (or seeded to fail once)
- [ ] Export blocked until Approve clicked
- [ ] *(Bonus)* Worker swap with `?workerMode=seed-only`

---

## Success criteria (judging)

1. Guardrail blocking visible — budget → revised shortlist + alarm.
2. Checkpoint fail → retry → pass (CP4).
3. Structured alarm fires during demo (SSE + alarms.jsonl).
4. ICP shows independent research — `evidence[]` spans ≥3 source types; `clientAlignment` populated; retry ladder in run log if triggered.
5. Token/cost visible per stage — CostPanel or run-log totals.
6. Full run observable — timeline, artifact versions, run-log.json, OTel trace.
7. Worker swap without harness code changes.
8. Four Fired Festival pillars demonstrable in defense.
9. Repo URL + deployed URL + `HARNESS.md` submitted.

---

## Pitch & talking points

### Tradeoffs to mention (defense)

| Decision | Chosen | Why (one line) |
|----------|--------|----------------|
| ICP research | Category + competitor + creator graph | ≥3 independent sources; automated retry at CP0 |
| No human at CP0 | Automated retry ladder | Harness self-heals; human only at export |
| ICP paid APIs | Deferred (Clearbit, Selda) | Signup friction; not needed to prove harness |
| Creator data | Influencers.club + seed | Reliable demo; no OAuth scraping |
| CP4 professionalism | Separate checkpoint module | Challenge requires constraints ≠ workers |
| Vercel + Railway split | Persistent `runs/` on Railway | Vercel has no disk for replay |
| Seed fallback | Always available | Demo survives API outage |

---

## Time-crunch priorities

If running out of time, cut in this order (last = cut first):

1. ~~OTLP export to Jaeger~~ → keep console + telemetry.jsonl
2. ~~Polished UI styling~~ → keep functional timeline + alarms
3. ~~All G2–G7 guardrails~~ → keep G1 + G6 minimum
4. ~~Live Influencers.club~~ → seed-only path still demonstrates harness
5. ~~Never cut~~: G1 loop, alarms on SSE, run-log persistence, token metering, ICP multi-source, CP4 separate evaluator

**Never cut:** orchestrator retry loop, structured alarms, checkpoint persistence, swappable worker interface.
