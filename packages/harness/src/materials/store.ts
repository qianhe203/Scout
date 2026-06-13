import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { StoredArtifact } from "../types.js";
import { isArtifactType, validateArtifact } from "./validate.js";

export class MaterialsStore {
  constructor(private readonly runsDir: string) {}

  private artifactsDir(runId: string): string {
    return join(this.runsDir, runId, "artifacts");
  }

  async nextVersion(runId: string, type: string): Promise<number> {
    const dir = this.artifactsDir(runId);
    await mkdir(dir, { recursive: true });
    const files = await readdir(dir).catch(() => [] as string[]);
    const versions = files
      .filter((f: string) => f.startsWith(`${type}_v`) && f.endsWith(".json"))
      .map((f: string) => Number(f.match(/_v(\d+)\.json$/)?.[1] ?? 0))
      .filter((n: number) => Number.isFinite(n));
    return versions.length === 0 ? 1 : Math.max(...versions) + 1;
  }

  async store(
    runId: string,
    type: string,
    data: unknown,
  ): Promise<StoredArtifact> {
    if (!isArtifactType(type)) {
      throw new Error(`Unsupported artifact type: ${type}`);
    }

    const validated = validateArtifact(type, data);
    const version = await this.nextVersion(runId, type);
    const meta = {
      id: randomUUID(),
      type,
      version,
      runId,
      createdAt: new Date().toISOString(),
    };
    const path = join(this.artifactsDir(runId), `${type}_v${version}.json`);
    const stored: StoredArtifact = { meta, data: validated, path };
    await writeFile(path, JSON.stringify(stored, null, 2));
    return stored;
  }

  async loadLatest(
    runId: string,
    type: string,
  ): Promise<StoredArtifact | null> {
    const dir = this.artifactsDir(runId);
    const files = await readdir(dir).catch(() => [] as string[]);
    const matches = files
      .filter((f: string) => f.startsWith(`${type}_v`) && f.endsWith(".json"))
      .map((f: string) => ({
        file: f,
        version: Number(f.match(/_v(\d+)\.json$/)?.[1] ?? 0),
      }))
      .filter((m: { version: number }) => Number.isFinite(m.version))
      .sort((a: { version: number }, b: { version: number }) => b.version - a.version);

    if (matches.length === 0) return null;
    const path = join(dir, matches[0]!.file);
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as StoredArtifact;
  }

  async loadAllLatest(runId: string): Promise<Record<string, StoredArtifact>> {
    const dir = this.artifactsDir(runId);
    const files = await readdir(dir).catch(() => [] as string[]);
    const byType = new Map<string, { version: number; file: string }>();

    for (const file of files) {
      const match = file.match(/^(.+)_v(\d+)\.json$/);
      if (!match) continue;
      const type = match[1]!;
      const version = Number(match[2]);
      const existing = byType.get(type);
      if (!existing || version > existing.version) {
        byType.set(type, { version, file });
      }
    }

    const artifacts: Record<string, StoredArtifact> = {};
    for (const [type, { file }] of byType) {
      const path = join(dir, file);
      const raw = await readFile(path, "utf8");
      artifacts[type] = JSON.parse(raw) as StoredArtifact;
    }
    return artifacts;
  }

  async writeCheckpoint(
    runId: string,
    checkpoint: {
      id: string;
      passed: boolean;
      at: string;
      criteria: string;
      details: Record<string, unknown>;
    },
  ): Promise<string> {
    const dir = join(this.runsDir, runId, "checkpoints");
    await mkdir(dir, { recursive: true });
    const path = join(dir, `${checkpoint.id}.json`);
    await writeFile(path, JSON.stringify(checkpoint, null, 2));
    return path;
  }
}
