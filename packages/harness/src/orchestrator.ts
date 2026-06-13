import type {
  CampaignPack,
  ClientBrief,
  ICPProposal,
  OutreachDrafts,
  RankedShortlist,
  RunEvent,
} from "@scout/shared";
import { AlarmEmitter } from "./alarms/emit.js";
import { evaluateCheckpoint } from "./checkpoints/index.js";
import { writeCampaignPackExport } from "./export/campaign-pack.js";
import { enforcePost, enforcePre } from "./guardrails/index.js";
import { RunStore } from "./persistence/run-store.js";
import { createTelemetryContext } from "./telemetry/stage.js";
import { checkStageWatchdog } from "./telemetry/watchdog.js";
import { TelemetryWriter } from "./telemetry/writer.js";
import {
  STAGE_ARTIFACT_TYPES,
  STAGES,
  type HarnessConfig,
  type HarnessContext,
  type RunEventHandler,
  type Stage,
  type WorkerRegistry,
} from "./types.js";

const DEFAULT_STAGE_TIMEOUT_MS = 120_000;

export class Orchestrator {
  private readonly runStore: RunStore;
  private readonly alarms: AlarmEmitter;
  private readonly telemetryWriter: TelemetryWriter;

  constructor(
    private readonly config: HarnessConfig,
    private readonly workers: WorkerRegistry,
    private readonly onEvent?: RunEventHandler,
  ) {
    this.runStore = new RunStore(config.runsDir);
    this.alarms = new AlarmEmitter(config.runsDir);
    this.telemetryWriter = new TelemetryWriter(
      config.runsDir,
      config.runTokenBudget,
      config.runCostCapUsd,
    );
  }

  getConfig(): HarnessConfig {
    return this.config;
  }

  private async emit(event: RunEvent): Promise<void> {
    await this.onEvent?.(event);
  }

  private workerForStage(stage: Stage) {
    switch (stage) {
      case "icp":
        return this.workers.icp;
      case "product":
        return this.workers.product;
      case "research":
        return this.workers.research;
      case "score":
        return this.workers.score;
      case "outreach":
        return this.workers.outreach;
      default:
        return null;
    }
  }

  async startRun(runId: string, brief: ClientBrief): Promise<void> {
    await this.runStore.initRun(runId, brief);
    await this.telemetryWriter.initRunLog(runId);

    const meta = await this.runStore.loadMeta(runId);
    meta.status = "running";
    await this.runStore.writeMeta(meta);

    const ctx = this.buildContext(runId, brief, {}, meta.retryCounts);
    const startIndex = 0;
    await this.runStages(ctx, startIndex);

    const finalMeta = await this.runStore.loadMeta(runId);
    if (finalMeta.status === "running") {
      finalMeta.status = this.config.skipApprovalGate
        ? "complete"
        : "awaiting_approval";
      await this.runStore.writeMeta(finalMeta);
    }
  }

  async resumeRun(
    runId: string,
    fromCheckpoint?: string,
  ): Promise<void> {
    const loaded = await this.runStore.loadRun(runId, fromCheckpoint);
    loaded.meta.status = "running";
    await this.runStore.writeMeta(loaded.meta);

    const ctx = this.buildContext(
      runId,
      loaded.meta.clientBrief,
      loaded.artifacts,
      loaded.meta.retryCounts,
    );

    const resumeStage = loaded.resumeStage;
    const startIndex =
      resumeStage != null ? STAGES.indexOf(resumeStage) : 0;
    if (startIndex < 0) {
      throw new Error(`Cannot resume from stage ${resumeStage}`);
    }
    await this.runStages(ctx, startIndex);
  }

  private buildContext(
    runId: string,
    brief: ClientBrief,
    artifacts: HarnessContext["artifacts"],
    retryCounts: HarnessContext["retryCounts"],
  ): HarnessContext {
    return {
      runId,
      clientBrief: brief,
      artifacts,
      config: this.config,
      telemetry: createTelemetryContext(this.telemetryWriter),
      retryCounts,
      emitAlarm: async (alarm) => {
        await this.alarms.emit(runId, alarm);
        await this.emit({ kind: "alarm", alarm });
      },
    };
  }

  private async runStages(
    ctx: HarnessContext,
    startIndex: number,
  ): Promise<void> {
    const endIndex = this.config.skipApprovalGate
      ? STAGES.length
      : STAGES.indexOf("export");

    for (let i = startIndex; i < endIndex; i++) {
      const stage = STAGES[i]!;
      const meta = await this.runStore.loadMeta(ctx.runId);
      meta.currentStage = stage;
      await this.runStore.writeMeta(meta);

      const completed = await this.runStage(stage, ctx);
      if (!completed) {
        meta.status = "failed";
        await this.runStore.writeMeta(meta);
        return;
      }
    }

    const log = await this.telemetryWriter.loadRunLog(ctx.runId);
    await this.runStore.writeRunLog(ctx.runId, log);

    if (!this.config.skipApprovalGate) {
      await this.emit({
        kind: "human_required",
        reason: "Export approval needed",
      });
      return;
    }

    await this.emit({
      kind: "run_complete",
      exportPath: `${this.config.runsDir}/${ctx.runId}/export`,
      totalCostUsd: log.totalEstimatedCostUsd,
      totalTokens: log.totalInputTokens + log.totalOutputTokens,
    });
  }

  private async runStage(
    stage: Stage,
    ctx: HarnessContext,
  ): Promise<boolean> {
    const stageSpan = ctx.telemetry.startStage(stage, ctx.runId);
    await this.emit({ kind: "stage_started", stage });

    const timeoutMs = this.config.stageTimeoutMs ?? DEFAULT_STAGE_TIMEOUT_MS;
    const spinAlarm = checkStageWatchdog(stageSpan, timeoutMs);
    if (spinAlarm) {
      await this.alarms.emit(ctx.runId, spinAlarm);
      await this.emit({ kind: "alarm", alarm: spinAlarm });
      await this.emit({
        kind: "human_required",
        reason: "Stage exceeded timeout threshold",
      });
      return false;
    }

    if (stage === "export") {
      return this.runExportStage(ctx, stageSpan);
    }

    const pre = enforcePre(stage, ctx);
    if (pre.blocked) {
      if (pre.alarm) {
        await this.alarms.emit(ctx.runId, pre.alarm);
        await this.emit({ kind: "alarm", alarm: pre.alarm });
      }
      await this.emit({
        kind: "guardrail",
        id: pre.id,
        blocked: true,
        feedback: pre.feedback,
      });
      ctx.feedback = pre.feedback;
      return this.retryOrEscalate(stage, ctx);
    }

    if (await ctx.telemetry.sink.exceedsTokenBudget(ctx.runId)) {
      const alarm = {
        type: "TOKEN_BUDGET_WARNING",
        severity: "medium" as const,
        context: { runId: ctx.runId },
        recommended_action: "Pause run and review token usage",
        timestamp: new Date().toISOString(),
      };
      await this.alarms.emit(ctx.runId, alarm);
      await this.emit({ kind: "alarm", alarm });
      await this.emit({
        kind: "human_required",
        reason: "Run token budget exceeded",
      });
      return false;
    }

    const worker = this.workerForStage(stage);
    if (!worker) {
      throw new Error(`No worker registered for stage ${stage}`);
    }

    const artifact = await worker.run(ctx);
    const artifactType = STAGE_ARTIFACT_TYPES[stage];
    if (!artifactType) {
      throw new Error(`No artifact type for stage ${stage}`);
    }

    const stored = await this.runStore.materialsStore.store(
      ctx.runId,
      artifactType,
      artifact,
    );
    ctx.artifacts[artifactType] = stored;
    await this.emit({
      kind: "artifact_written",
      artifactType,
      version: stored.meta.version,
      path: stored.path,
    });

    const cp = await evaluateCheckpoint(stage, ctx);
    if (cp) {
      await this.runStore.materialsStore.writeCheckpoint(ctx.runId, {
        id: cp.id,
        passed: cp.passed,
        at: new Date().toISOString(),
        criteria: cp.id,
        details: cp.details,
      });
      await this.emit({
        kind: "checkpoint",
        id: cp.id,
        passed: cp.passed,
        details: cp.details,
      });

      if (cp.alarm) {
        await this.alarms.emit(ctx.runId, cp.alarm);
        await this.emit({ kind: "alarm", alarm: cp.alarm });
      }

      if (!cp.passed) {
        ctx.feedback = cp.feedback;
        if (stage === "icp") {
          return this.retryCP0(stage, ctx);
        }
        return this.retryOrEscalate(stage, ctx);
      }
    }

    const post = enforcePost(stage, ctx);
    if (post.blocked) {
      if (post.alarm) {
        await this.alarms.emit(ctx.runId, post.alarm);
        await this.emit({ kind: "alarm", alarm: post.alarm });
      }
      await this.emit({
        kind: "guardrail",
        id: post.id,
        blocked: true,
        feedback: post.feedback,
      });
      ctx.feedback = post.feedback;
      return this.retryOrEscalate(stage, ctx);
    }

    const durationMs = ctx.telemetry.endStage(stageSpan);
    await ctx.telemetry.sink.recordStageTelemetry(ctx.runId, {
      stage,
      durationMs,
      llmCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      toolCalls: [],
      checkpoint: cp ? { id: cp.id, passed: cp.passed } : undefined,
      guardrailHits: post.blocked ? [post.id] : undefined,
    });
    await this.emit({ kind: "stage_completed", stage, durationMs });
    return true;
  }

  private buildCampaignPack(ctx: HarnessContext): CampaignPack {
    return {
      shortlist: ctx.artifacts.RankedShortlist!.data as RankedShortlist,
      outreach: ctx.artifacts.OutreachDrafts!.data as OutreachDrafts,
      icp: ctx.artifacts.ICPProposal!.data as ICPProposal,
      runLogSummary: "Pipeline complete",
      exportedAt: new Date().toISOString(),
    };
  }

  private async runExportStage(
    ctx: HarnessContext,
    stageSpan: import("./types.js").StageSpan,
  ): Promise<boolean> {
    const pack = this.buildCampaignPack(ctx);
    const stored = await this.runStore.materialsStore.store(
      ctx.runId,
      "CampaignPack",
      pack,
    );
    ctx.artifacts.CampaignPack = stored;
    await this.emit({
      kind: "artifact_written",
      artifactType: "CampaignPack",
      version: stored.meta.version,
      path: stored.path,
    });

    const log = await this.telemetryWriter.loadRunLog(ctx.runId);
    const { csvPath, summaryPath } = await writeCampaignPackExport(
      this.runStore.runDir(ctx.runId),
      pack,
      log,
    );
    await this.emit({
      kind: "artifact_written",
      artifactType: "export_csv",
      version: 1,
      path: csvPath,
    });
    await this.emit({
      kind: "artifact_written",
      artifactType: "export_summary",
      version: 1,
      path: summaryPath,
    });

    const durationMs = ctx.telemetry.endStage(stageSpan);
    await this.emit({ kind: "stage_completed", stage: "export", durationMs });
    return true;
  }

  private async retryCP0(stage: Stage, ctx: HarnessContext): Promise<boolean> {
    const icpRetries = (ctx.retryCounts.icp ?? 0) + 1;
    ctx.retryCounts.icp = icpRetries;

    const meta = await this.runStore.loadMeta(ctx.runId);
    meta.retryCounts = ctx.retryCounts;
    await this.runStore.writeMeta(meta);

    if (icpRetries > 3) {
      const alarm = {
        type: "ICP_LOW_CONFIDENCE",
        severity: "medium" as const,
        context: { icpRetries },
        recommended_action: "Continue with low-confidence ICP",
        timestamp: new Date().toISOString(),
      };
      await this.alarms.emit(ctx.runId, alarm);
      await this.emit({ kind: "alarm", alarm });
      return true;
    }

    return this.runStage(stage, ctx);
  }

  private async retryOrEscalate(
    stage: Stage,
    ctx: HarnessContext,
  ): Promise<boolean> {
    const retries = (ctx.retryCounts[stage] ?? 0) + 1;
    ctx.retryCounts[stage] = retries;

    const meta = await this.runStore.loadMeta(ctx.runId);
    meta.retryCounts = ctx.retryCounts;
    await this.runStore.writeMeta(meta);

    if (retries > this.config.maxRetriesPerStage) {
      const alarm = {
        type: "HUMAN_REQUIRED",
        severity: "high" as const,
        context: { stage, retries },
        recommended_action: "Review alarm feed and intervene manually",
        timestamp: new Date().toISOString(),
      };
      await this.alarms.emit(ctx.runId, alarm);
      await this.emit({ kind: "alarm", alarm });
      await this.emit({
        kind: "human_required",
        reason: `Max retries exceeded at stage ${stage}`,
      });
      return false;
    }

    return this.runStage(stage, ctx);
  }
}

export { Orchestrator as default };
