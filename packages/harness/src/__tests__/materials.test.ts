import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MaterialsStore } from "../materials/store.js";
import { validICPProposal } from "../__fixtures__/artifacts.js";

describe("MaterialsStore", () => {
  it("writes versioned artifact files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "scout-mat-"));
    const runId = randomUUID();
    const store = new MaterialsStore(dir);

    const v1 = await store.store(runId, "ICPProposal", validICPProposal);
    const v2 = await store.store(runId, "ICPProposal", {
      ...validICPProposal,
      alignmentNotes: "Revised",
    });

    expect(v1.meta.version).toBe(1);
    expect(v2.meta.version).toBe(2);

    const files = await readdir(join(dir, runId, "artifacts"));
    expect(files).toContain("ICPProposal_v1.json");
    expect(files).toContain("ICPProposal_v2.json");

    const raw = await readFile(v2.path, "utf8");
    const parsed = JSON.parse(raw);
    expect(parsed.data.alignmentNotes).toBe("Revised");
  });

  it("loads latest artifact by type", async () => {
    const dir = await mkdtemp(join(tmpdir(), "scout-mat-"));
    const runId = randomUUID();
    const store = new MaterialsStore(dir);

    await store.store(runId, "ICPProposal", validICPProposal);
    await store.store(runId, "ICPProposal", {
      ...validICPProposal,
      icpRetryPasses: 1,
    });

    const latest = await store.loadLatest(runId, "ICPProposal");
    expect(latest?.meta.version).toBe(2);
    expect((latest?.data as typeof validICPProposal).icpRetryPasses).toBe(1);
  });
});
