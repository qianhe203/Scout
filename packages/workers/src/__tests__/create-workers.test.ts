import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createWorkers,
  RuleBasedScoreWorker,
  SeedResearchWorker,
} from "../index.js";

const creatorsPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../data/creators.json",
);

describe("createWorkers", () => {
  it("returns SeedResearchWorker in seed-only mode", () => {
    const workers = createWorkers("seed-only", { creatorsPath });

    expect(workers.research).toBeInstanceOf(SeedResearchWorker);
    expect(workers.research.name).toBe("SeedResearchWorker");
    expect(workers.score).toBeInstanceOf(RuleBasedScoreWorker);
  });

  it("wires ICPWorker in default llm mode", () => {
    const workers = createWorkers("llm", { creatorsPath });

    expect(workers.icp.name).toBe("ICPWorker");
    expect(workers.research.name).toBe("ResearchWorker");
    expect(workers.product.name).toBe("ProductWorker");
    expect(workers.outreach.name).toBe("OutreachWorker");
  });
});
