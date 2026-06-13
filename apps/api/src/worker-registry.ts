import {
  createWorkers as createWorkersFromPackage,
  type WorkerMode,
} from "@scout/workers";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type { WorkerMode };

const defaultCreatorsPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../data/creators.json",
);

export function createWorkers(mode: WorkerMode = "llm") {
  const creatorsPath =
    process.env.CREATORS_SEED_PATH ?? defaultCreatorsPath;

  if (mode === "seed-only") {
    console.log("[scout] seed-only mode: SeedResearchWorker + RuleBasedScoreWorker");
  }

  return createWorkersFromPackage(mode, { creatorsPath });
}
