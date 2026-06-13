import type { HarnessContext, Worker, WorkerRegistry } from "@scout/harness";
import { createCreatorGraphAdapterFromEnv } from "./adapters/creator-graph.js";
import { createWebSearchAdapterFromEnv } from "./adapters/web-search.js";
import { createWebsiteAdapterFromEnv } from "./adapters/website.js";
import {
  seedPipelineICP,
  seedPipelineOutreach,
  seedPipelineProductBrief,
} from "./fixtures/seed-pipeline.js";
import { ICPWorker } from "./icp.js";
import { OutreachWorker } from "./outreach.js";
import { ProductWorker } from "./product.js";
import { ResearchWorker } from "./research.js";
import { SeedResearchWorker } from "./research/seed-research.js";
import { ScoreWorker } from "./score.js";

export type WorkerMode = "llm" | "seed-only";

export interface CreateWorkersOptions {
  creatorsPath?: string;
}

function fixtureWorker(name: string, artifact: unknown): Worker {
  return {
    name,
    async run(_ctx: HarnessContext) {
      return artifact;
    },
  };
}

/** Placeholder workers — replaced by LLM implementations in U9. */
export function createStubWorkers(): WorkerRegistry {
  const stub = (name: string): Worker => ({
    name,
    async run() {
      throw new Error(`${name} not implemented yet`);
    },
  });

  return {
    icp: stub("ICPWorker"),
    product: stub("ProductWorker"),
    research: stub("ResearchWorker"),
    score: stub("ScoreWorker"),
    outreach: stub("OutreachWorker"),
  };
}

export function createWorkers(
  mode: WorkerMode = "llm",
  options: CreateWorkersOptions = {},
): WorkerRegistry {
  if (mode === "seed-only") {
    if (!options.creatorsPath) {
      throw new Error("creatorsPath is required for seed-only worker mode");
    }

    return {
      icp: fixtureWorker("ICPWorker", seedPipelineICP),
      product: fixtureWorker("ProductWorker", seedPipelineProductBrief),
      research: new SeedResearchWorker({
        creatorsPath: options.creatorsPath,
      }),
      score: new ScoreWorker(),
      outreach: fixtureWorker("OutreachWorker", seedPipelineOutreach),
    };
  }

  if (!options.creatorsPath) {
    throw new Error("creatorsPath is required for llm worker mode");
  }

  return {
    icp: new ICPWorker({
      webSearch: createWebSearchAdapterFromEnv(),
      website: createWebsiteAdapterFromEnv(),
      creatorGraph: createCreatorGraphAdapterFromEnv({
        creatorsPath: options.creatorsPath,
      }),
    }),
    product: new ProductWorker({
      website: createWebsiteAdapterFromEnv(),
    }),
    research: new ResearchWorker({
      creatorsPath: options.creatorsPath,
    }),
    score: new ScoreWorker(),
    outreach: new OutreachWorker(),
  };
}
