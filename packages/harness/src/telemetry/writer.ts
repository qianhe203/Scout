import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { HarnessRunLog } from "@scout/shared";
import type { TelemetrySink } from "../types.js";

const DEFAULT_RUN_LOG: HarnessRunLog = {
  runId: "",
  stages: [],
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalEstimatedCostUsd: 0,
  alarms: [],
};

export class TelemetryWriter implements TelemetrySink {
  constructor(
    private readonly runsDir: string,
    private readonly runTokenBudget: number,
    private readonly runCostCapUsd: number,
  ) {}

  private telemetryPath(runId: string): string {
    return join(this.runsDir, runId, "telemetry.jsonl");
  }

  private runLogPath(runId: string): string {
    return join(this.runsDir, runId, "run-log.json");
  }

  async append(runId: string, line: Record<string, unknown>): Promise<void> {
    await mkdir(join(this.runsDir, runId), { recursive: true });
    await appendFile(this.telemetryPath(runId), `${JSON.stringify(line)}\n`);
    await this.updateRunLogTotals(runId, line);
  }

  private async updateRunLogTotals(
    runId: string,
    line: Record<string, unknown>,
  ): Promise<void> {
    const log = await this.loadRunLog(runId);
    if (line.kind === "llm_call") {
      log.totalInputTokens += Number(line.inputTokens ?? 0);
      log.totalOutputTokens += Number(line.outputTokens ?? 0);
      log.totalEstimatedCostUsd += Number(line.estimatedCostUsd ?? 0);
    }
    await writeFile(this.runLogPath(runId), JSON.stringify(log, null, 2));
  }

  async recordStageTelemetry(
    runId: string,
    entry: HarnessRunLog["stages"][number],
  ): Promise<void> {
    const log = await this.loadRunLog(runId);
    log.stages.push(entry);
    await writeFile(this.runLogPath(runId), JSON.stringify(log, null, 2));
    await this.append(runId, { kind: "stage_telemetry", ...entry });
  }

  async exceedsTokenBudget(runId: string): Promise<boolean> {
    const log = await this.loadRunLog(runId);
    const total = log.totalInputTokens + log.totalOutputTokens;
    return total >= this.runTokenBudget;
  }

  async exceedsCostCap(runId: string): Promise<boolean> {
    const log = await this.loadRunLog(runId);
    return log.totalEstimatedCostUsd >= this.runCostCapUsd;
  }

  async loadRunLog(runId: string): Promise<HarnessRunLog> {
    try {
      const raw = await readFile(this.runLogPath(runId), "utf8");
      return JSON.parse(raw) as HarnessRunLog;
    } catch {
      return { ...DEFAULT_RUN_LOG, runId };
    }
  }

  async initRunLog(runId: string): Promise<void> {
    await mkdir(join(this.runsDir, runId), { recursive: true });
    await writeFile(
      this.runLogPath(runId),
      JSON.stringify({ ...DEFAULT_RUN_LOG, runId }, null, 2),
    );
  }
}
