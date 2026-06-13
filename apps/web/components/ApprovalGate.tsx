"use client";

import { useState } from "react";
import type { RunEvent } from "@scout/shared";
import { approveRun } from "../lib/api";

export function ApprovalGate({
  runId,
  status,
  events,
  onApproved,
}: {
  runId: string;
  status: string;
  events: RunEvent[];
  onApproved?: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const humanRequired = events.some((e) => e.kind === "human_required");
  const runComplete = events.some((e) => e.kind === "run_complete");
  const showGate =
    status === "awaiting_approval" || humanRequired || runComplete;

  if (!showGate) return null;

  if (runComplete || status === "complete") {
    const complete = events.find((e) => e.kind === "run_complete");
    return (
      <section className="panel approval-gate">
        <h2 className="panel-title">Export complete</h2>
        <p className="muted">
          Campaign pack exported
          {complete?.kind === "run_complete"
            ? ` · $${complete.totalCostUsd.toFixed(4)} total`
            : ""}
        </p>
      </section>
    );
  }

  const onApprove = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await approveRun(runId);
      onApproved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="panel approval-gate">
      <h2 className="panel-title">Human approval</h2>
      <p className="muted">
        Pipeline finished outreach. Approve to export the campaign pack.
      </p>
      {error ? <p className="error">{error}</p> : null}
      <button
        className="btn-primary"
        type="button"
        onClick={onApprove}
        disabled={submitting}
      >
        {submitting ? "Exporting…" : "Approve export"}
      </button>
    </section>
  );
}
