"use client";

import { useEffect, useRef, useState } from "react";
import type { RunEvent } from "@scout/shared";
import { getArtifact } from "../lib/api";

interface ArtifactCard {
  type: string;
  version: number;
  data: unknown;
}

export function ArtifactViewer({
  runId,
  events,
}: {
  runId: string;
  events: RunEvent[];
}) {
  const [artifacts, setArtifacts] = useState<ArtifactCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(new Set<string>());

  useEffect(() => {
    const written = events.filter((e) => e.kind === "artifact_written");
    for (const event of written) {
      if (event.kind !== "artifact_written") continue;
      const key = `${event.artifactType}:v${event.version}`;
      if (loadedRef.current.has(key)) continue;
      loadedRef.current.add(key);

      void getArtifact(runId, event.artifactType)
        .then((res) => {
          setArtifacts((prev) => {
            const filtered = prev.filter((a) => a.type !== event.artifactType);
            return [
              ...filtered,
              {
                type: event.artifactType,
                version: res.meta.version,
                data: res.data,
              },
            ].sort((a, b) => a.type.localeCompare(b.type));
          });
        })
        .catch((err: unknown) => {
          loadedRef.current.delete(key);
          setError(err instanceof Error ? err.message : "Failed to load artifact");
        });
    }
  }, [events, runId]);

  return (
    <section className="panel">
      <h2 className="panel-title">Artifacts</h2>
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
