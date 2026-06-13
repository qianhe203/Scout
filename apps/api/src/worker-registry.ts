import { createStubWorkers } from "@scout/workers";

export type WorkerMode = "llm" | "seed-only";

export function createWorkers(mode: WorkerMode = "llm") {
  const workers = createStubWorkers();
  if (mode === "seed-only") {
    // U3: swap research worker to seed-only implementation
    console.log("[scout] seed-only mode requested (stub)");
  }
  return workers;
}
