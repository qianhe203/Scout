import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ClientBrief, HarnessRunLog } from "@scout/shared";
import type { RunMeta, Stage } from "../types.js";
import { MaterialsStore } from "../materials/store.js";

export class RunStore {
  private readonly materials: MaterialsStore;

  constructor(private readonly runsDir: string) {
    this.materials = new MaterialsStore(runsDir);
  }

  runDir(runId: string): string {
    return join(this.runsDir, runId);
  }

  metaPath(runId: string): string {
    return join(this.runDir(runId), "meta.json");
  }

  async initRun(runId: string, brief: ClientBrief): Promise<RunMeta> {
    await mkdir(this.runDir(runId), { recursive: true });
    const now = new Date().toISOString();
    const meta: RunMeta = {
      runId,
      status: "pending",
      currentStage: null,
      clientBrief: brief,
      createdAt: now,
      updatedAt: now,
      retryCounts: {},
    };
    await this.writeMeta(meta);
    return meta;
  }

  async writeMeta(meta: RunMeta): Promise<void> {
    meta.updatedAt = new Date().toISOString();
    await writeFile(this.metaPath(meta.runId), JSON.stringify(meta, null, 2));
  }

  async loadMeta(runId: string): Promise<RunMeta> {
    const raw = await readFile(this.metaPath(runId), "utf8");
    return JSON.parse(raw) as RunMeta;
  }

  async loadRun(
    runId: string,
    fromCheckpoint?: string,
  ): Promise<{
    meta: RunMeta;
    artifacts: Record<string, import("../types.js").StoredArtifact>;
    resumeStage: Stage | null;
  }> {
    const meta = await this.loadMeta(runId);
    const artifacts = await this.materials.loadAllLatest(runId);

    if (!fromCheckpoint) {
      return { meta, artifacts, resumeStage: meta.currentStage };
    }

    const checkpointOrder = ["CP0", "CP1", "CP2", "CP3", "CP4"] as const;
    const idx = checkpointOrder.indexOf(
      fromCheckpoint as (typeof checkpointOrder)[number],
    );
    if (idx === -1) {
      throw new Error(`Unknown checkpoint: ${fromCheckpoint}`);
    }

    const stageByCheckpoint: Record<string, Stage> = {
      CP0: "product",
      CP1: "research",
      CP2: "score",
      CP3: "outreach",
      CP4: "export",
    };

    return {
      meta,
      artifacts,
      resumeStage: stageByCheckpoint[fromCheckpoint] ?? null,
    };
  }

  async writeRunLog(runId: string, log: HarnessRunLog): Promise<void> {
    const path = join(this.runDir(runId), "run-log.json");
    await writeFile(path, JSON.stringify(log, null, 2));
  }

  get materialsStore(): MaterialsStore {
    return this.materials;
  }
}
