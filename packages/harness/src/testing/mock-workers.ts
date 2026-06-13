import type { HarnessContext, Worker, WorkerRegistry } from "../types.js";
import {
  overBudgetRankedShortlist,
  validCreatorCandidates,
  validICPProposal,
  validOutreachDrafts,
  validProductBrief,
  validRankedShortlist,
} from "../__fixtures__/artifacts.js";

function fixtureWorker(name: string, artifact: unknown): Worker {
  return {
    name,
    async run(ctx: HarnessContext) {
      if (
        name === "ScoreWorker" &&
        ctx.feedback?.kind === "budget_exceeded"
      ) {
        return validRankedShortlist;
      }
      if (name === "ScoreWorker" && ctx.clientBrief.budget < 1000) {
        return overBudgetRankedShortlist;
      }
      return artifact;
    },
  };
}

export function createMockWorkers(): WorkerRegistry {
  return {
    icp: fixtureWorker("ICPWorker", validICPProposal),
    product: fixtureWorker("ProductWorker", validProductBrief),
    research: fixtureWorker("ResearchWorker", validCreatorCandidates),
    score: fixtureWorker("ScoreWorker", validRankedShortlist),
    outreach: fixtureWorker("OutreachWorker", validOutreachDrafts),
  };
}
