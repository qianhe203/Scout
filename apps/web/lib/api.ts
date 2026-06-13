export const API_BASE =
  process.env.NEXT_PUBLIC_HARNESS_API_URL ?? "http://localhost:3001";

export type WorkerMode = "seed-only" | "llm";

export interface CreateRunResponse {
  runId: string;
  status: string;
}

export interface RunSummary {
  runId: string;
  status: string;
  currentStage: string | null;
  createdAt: string;
  updatedAt: string;
  eventCount: number;
  telemetry: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalEstimatedCostUsd: number;
    stages: Array<{ stage: string; durationMs: number }>;
  } | null;
  alarms: unknown[];
}

export interface StoredArtifactResponse {
  meta: {
    type: string;
    version: number;
    createdAt: string;
  };
  data: unknown;
}

export async function createRun(
  body: unknown,
  workerMode: WorkerMode = "seed-only",
): Promise<CreateRunResponse> {
  const res = await fetch(`${API_BASE}/runs?workerMode=${workerMode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`POST /runs failed: ${res.status} ${err}`);
  }
  return res.json() as Promise<CreateRunResponse>;
}

export async function getRun(runId: string): Promise<RunSummary> {
  const res = await fetch(`${API_BASE}/runs/${runId}`);
  if (!res.ok) throw new Error(`GET /runs/${runId} failed: ${res.status}`);
  return res.json() as Promise<RunSummary>;
}

export async function getArtifact(
  runId: string,
  type: string,
): Promise<StoredArtifactResponse> {
  const res = await fetch(`${API_BASE}/runs/${runId}/artifacts/${type}`);
  if (!res.ok) {
    throw new Error(`GET artifact ${type} failed: ${res.status}`);
  }
  return res.json() as Promise<StoredArtifactResponse>;
}

export async function approveRun(runId: string): Promise<{ runId: string; status: string }> {
  const res = await fetch(`${API_BASE}/runs/${runId}/approve`, { method: "POST" });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`POST /runs/${runId}/approve failed: ${res.status} ${err}`);
  }
  return res.json() as Promise<{ runId: string; status: string }>;
}

export function runEventsUrl(runId: string): string {
  return `${API_BASE}/runs/${runId}/events`;
}
