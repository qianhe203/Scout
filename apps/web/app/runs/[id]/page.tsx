"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AlarmPanel } from "../../../components/AlarmPanel";
import { ApprovalGate } from "../../../components/ApprovalGate";
import { ArtifactViewer } from "../../../components/ArtifactViewer";
import { CostPanel } from "../../../components/CostPanel";
import { FeedbackBanner } from "../../../components/FeedbackBanner";
import { PipelineTimeline } from "../../../components/PipelineTimeline";
import { SiteHeader } from "../../../components/SiteHeader";
import { useRunEvents } from "../../../hooks/useRunEvents";
import { getRun } from "../../../lib/api";

export default function RunPage() {
  const params = useParams<{ id: string }>();
  const runId = params.id;
  const { events, connected, error, telemetry } = useRunEvents(runId);
  const [status, setStatus] = useState("running");

  const refreshStatus = useCallback(async () => {
    try {
      const summary = await getRun(runId);
      setStatus(summary.status);
    } catch {
      /* run may still be starting */
    }
  }, [runId]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus, events.length]);

  return (
    <>
      <SiteHeader suffix={`Run ${runId.slice(0, 8)}`} />
      <main className="page run-page">
        <header className="run-header">
          <h1>Pipeline run</h1>
          <p className="muted run-meta">
            <code>{runId}</code>
            {connected ? " · live" : " · connecting…"}
            {status ? ` · ${status}` : ""}
          </p>
        </header>

        {error ? <p className="error">{error}</p> : null}

        <FeedbackBanner events={events} />
        <PipelineTimeline events={events} />

        <div className="run-grid">
          <CostPanel events={events} telemetry={telemetry} />
          <AlarmPanel events={events} />
        </div>

        <ArtifactViewer runId={runId} events={events} />

        <ApprovalGate
          runId={runId}
          status={status}
          events={events}
          onApproved={refreshStatus}
        />
      </main>
    </>
  );
}
