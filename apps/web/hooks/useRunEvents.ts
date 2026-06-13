"use client";

import { useEffect, useState } from "react";
import type { RunEvent } from "@scout/shared";
import { getRun, runEventsUrl, type RunSummary } from "../lib/api";

export interface UseRunEventsResult {
  events: RunEvent[];
  connected: boolean;
  error: string | null;
  telemetry: RunSummary["telemetry"];
}

export function useRunEvents(runId: string): UseRunEventsResult {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<RunSummary["telemetry"]>(null);

  useEffect(() => {
    if (!runId) return;

    let cancelled = false;

    const refreshTelemetry = async () => {
      try {
        const summary = await getRun(runId);
        if (!cancelled) setTelemetry(summary.telemetry);
      } catch {
        /* run may not exist yet */
      }
    };

    void refreshTelemetry();
    const telemetryPoll = setInterval(() => {
      void refreshTelemetry();
    }, 3000);

    const source = new EventSource(runEventsUrl(runId));

    source.onopen = () => {
      setConnected(true);
      setError(null);
    };

    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as RunEvent;
        setEvents((prev) => [...prev, event]);
        if (event.kind === "llm_call" || event.kind === "run_complete") {
          void refreshTelemetry();
        }
      } catch {
        setError("Failed to parse SSE event");
      }
    };

    source.onerror = () => {
      setConnected(false);
      setError("SSE connection lost");
      source.close();
    };

    return () => {
      cancelled = true;
      clearInterval(telemetryPoll);
      source.close();
      setConnected(false);
    };
  }, [runId]);

  return { events, connected, error, telemetry };
}
