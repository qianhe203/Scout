"use client";

import { useEffect, useState } from "react";
import type { RunEvent } from "@scout/shared";
import { runEventsUrl } from "../lib/api";

export interface UseRunEventsResult {
  events: RunEvent[];
  connected: boolean;
  error: string | null;
}

export function useRunEvents(runId: string): UseRunEventsResult {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;

    const source = new EventSource(runEventsUrl(runId));

    source.onopen = () => {
      setConnected(true);
      setError(null);
    };

    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as RunEvent;
        setEvents((prev) => [...prev, event]);
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
      source.close();
      setConnected(false);
    };
  }, [runId]);

  return { events, connected, error };
}
