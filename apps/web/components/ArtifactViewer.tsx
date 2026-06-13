"use client";

import { useEffect, useRef, useState } from "react";
import type { RunEvent } from "@scout/shared";
import { getArtifact, API_BASE } from "../lib/api";

interface ArtifactCard {
  type: string;
  version: number;
  data: unknown;
}

function shortlistDiff(
  previous: unknown,
  current: unknown,
): string | null {
  if (
    !previous ||
    !current ||
    typeof previous !== "object" ||
    typeof current !== "object"
  ) {
    return null;
  }

  const prevCreators = (previous as { creators?: Array<{ id: string; fitScore: number; estimatedCost: number }> })
    .creators;
  const nextCreators = (current as { creators?: Array<{ id: string; fitScore: number; estimatedCost: number }> })
    .creators;
  if (!prevCreators || !nextCreators) return null;

  const prevTotal = (previous as { totalEstimatedCost?: number }).totalEstimatedCost;
  const nextTotal = (current as { totalEstimatedCost?: number }).totalEstimatedCost;
  const removed = prevCreators.filter(
    (creator) => !nextCreators.some((next) => next.id === creator.id),
  );

  if (removed.length === 0 && prevTotal === nextTotal) return null;

  return [
    `Budget revision: $${prevTotal ?? "?"} → $${nextTotal ?? "?"}`,
    removed.length > 0
      ? `Removed: ${removed.map((creator) => creator.id).join(", ")}`
      : "Creators unchanged",
  ].join("\n");
}

export function ArtifactViewer({
  runId,
  events,
  status,
}: {
  runId: string;
  events: RunEvent[];
  status?: string;
}) {
  const [artifacts, setArtifacts] = useState<ArtifactCard[]>([]);
  const [versionsByType, setVersionsByType] = useState<
    Record<string, ArtifactCard[]>
  >({});
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(new Set<string>());

  useEffect(() => {
    const written = events.filter((e) => e.kind === "artifact_written");
    for (const event of written) {
      if (event.kind !== "artifact_written") continue;
      if (
        event.artifactType === "export_csv" ||
        event.artifactType === "export_summary"
      ) {
        continue;
      }

      const key = `${event.artifactType}:v${event.version}`;
      if (loadedRef.current.has(key)) continue;
      loadedRef.current.add(key);

      void getArtifact(runId, event.artifactType)
        .then((res) => {
          const card: ArtifactCard = {
            type: event.artifactType,
            version: res.meta.version,
            data: res.data,
          };
          setArtifacts((prev) => {
            const filtered = prev.filter((a) => a.type !== event.artifactType);
            return [...filtered, card].sort((a, b) =>
              a.type.localeCompare(b.type),
            );
          });
          setVersionsByType((prev) => {
            const existing = prev[event.artifactType] ?? [];
            const merged = [...existing.filter((a) => a.version !== card.version), card]
              .sort((a, b) => a.version - b.version);
            return { ...prev, [event.artifactType]: merged };
          });
        })
        .catch((err: unknown) => {
          loadedRef.current.delete(key);
          setError(err instanceof Error ? err.message : "Failed to load artifact");
        });
    }
  }, [events, runId]);

  const rankedVersions = versionsByType.RankedShortlist ?? [];
  const rankedDiff =
    rankedVersions.length >= 2
      ? shortlistDiff(
          rankedVersions[rankedVersions.length - 2]?.data,
          rankedVersions[rankedVersions.length - 1]?.data,
        )
      : null;

  return (
    <section className="panel">
      <h2 className="panel-title">Artifacts</h2>
      {status === "complete" ? (
        <p className="export-links">
          Export:{" "}
          <a href={`${API_BASE}/runs/${runId}/export/campaign-pack.csv`}>
            campaign-pack.csv
          </a>
          {" · "}
          <a href={`${API_BASE}/runs/${runId}/export/summary.md`}>summary.md</a>
        </p>
      ) : null}
      {rankedDiff ? (
        <details open className="artifact-diff">
          <summary>RankedShortlist revision</summary>
          <pre>{rankedDiff}</pre>
        </details>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {artifacts.length === 0 ? (
        <p className="muted">Waiting for stage outputs…</p>
      ) : (
        <div className="artifact-list">
          {artifacts.map((artifact) => (
            <details key={`${artifact.type}_v${artifact.version}`} open>
              <summary>
                {artifact.type}{" "}
                <span className="muted">v{artifact.version}</span>
              </summary>
              <pre>{JSON.stringify(artifact.data, null, 2)}</pre>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
