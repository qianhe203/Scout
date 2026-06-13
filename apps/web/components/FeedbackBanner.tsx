"use client";

import type { RunEvent } from "@scout/shared";

export function FeedbackBanner({ events }: { events: RunEvent[] }) {
  const latestGuardrail = [...events]
    .reverse()
    .find(
      (e): e is Extract<RunEvent, { kind: "guardrail" }> =>
        e.kind === "guardrail" && e.blocked,
    );
  const latestCheckpoint = [...events]
    .reverse()
    .find(
      (e): e is Extract<RunEvent, { kind: "checkpoint" }> =>
        e.kind === "checkpoint" && !e.passed,
    );

  if (!latestGuardrail && !latestCheckpoint) return null;

  const message = latestGuardrail
    ? `Guardrail ${latestGuardrail.id} blocked — worker revision in progress`
    : `Checkpoint ${latestCheckpoint!.id} failed — retrying stage`;

  return (
    <div className="feedback-banner" role="status">
      {message}
    </div>
  );
}
