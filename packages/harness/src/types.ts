import type {
  Alarm,
  ClientBrief,
  HarnessFeedback,
  HarnessRunLog,
  RunEvent,
  RunStatus,
} from "@scout/shared";

export type Stage =
  | "icp"
  | "product"
  | "research"
  | "score"
  | "outreach"
  | "export";

export const STAGES: Stage[] = [
  "icp",
  "product",
  "research",
  "score",
  "outreach",
  "export",
];

export const STAGE_CHECKPOINTS: Partial<Record<Stage, string>> = {
  icp: "CP0",
  product: "CP1",
  research: "CP2",
  score: "CP3",
  outreach: "CP4",
};

export const STAGE_ARTIFACT_TYPES: Record<Stage, string | null> = {
  icp: "ICPProposal",
  product: "ProductBrief",
  research: "CreatorCandidates",
  score: "RankedShortlist",
  outreach: "OutreachDrafts",
  export: "CampaignPack",
};

export type CP4Evaluator = (
  ctx: HarnessContext,
) => CheckpointResult | Promise<CheckpointResult>;

export interface HarnessConfig {
  runsDir: string;
  runTokenBudget: number;
  runCostCapUsd: number;
  maxRetriesPerStage: number;
  stageTimeoutMs?: number;
  /** When true, skips human approval and runs export (tests). */
  skipApprovalGate?: boolean;
  /** Optional LLM-backed CP4 evaluator; defaults to heuristic rubric. */
  cp4Evaluator?: CP4Evaluator;
}

export interface StoredArtifact<T = unknown> {
  meta: {
    id: string;
    type: string;
    version: number;
    runId: string;
    createdAt: string;
  };
  data: T;
  path: string;
}

export interface TelemetrySink {
  append(runId: string, line: Record<string, unknown>): Promise<void>;
  exceedsTokenBudget(runId: string): Promise<boolean>;
  exceedsCostCap(runId: string): Promise<boolean>;
  recordStageTelemetry(
    runId: string,
    entry: HarnessRunLog["stages"][number],
  ): Promise<void>;
}

export interface StageSpan {
  stage: Stage;
  runId: string;
  startedAt: number;
  durationMs?: number;
}

export interface TelemetryContext {
  startStage(stage: Stage, runId: string): StageSpan;
  endStage(span: StageSpan): number;
  sink: TelemetrySink;
}

export interface Worker {
  name: string;
  run(ctx: HarnessContext): Promise<unknown>;
}

export interface WorkerRegistry {
  icp: Worker;
  product: Worker;
  research: Worker;
  score: Worker;
  outreach: Worker;
}

export interface HarnessContext {
  runId: string;
  clientBrief: ClientBrief;
  artifacts: Record<string, StoredArtifact>;
  feedback?: HarnessFeedback;
  config: HarnessConfig;
  telemetry: TelemetryContext;
  retryCounts: Partial<Record<Stage, number>>;
  emitAlarm?: (alarm: Alarm) => Promise<void>;
}

export interface GuardrailResult {
  id: string;
  blocked: boolean;
  alarm?: Alarm;
  feedback?: HarnessFeedback;
}

export interface CheckpointResult {
  id: string;
  passed: boolean;
  details: Record<string, unknown>;
  alarm?: Alarm;
  feedback?: HarnessFeedback;
}

export interface RunMeta {
  runId: string;
  status: RunStatus;
  currentStage: Stage | null;
  clientBrief: ClientBrief;
  createdAt: string;
  updatedAt: string;
  retryCounts: Partial<Record<Stage, number>>;
}

export type RunEventHandler = (event: RunEvent) => void | Promise<void>;
