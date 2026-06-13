"use client";

import type { Alarm, RunEvent } from "@scout/shared";

export function AlarmPanel({ events }: { events: RunEvent[] }) {
  const alarms: Alarm[] = events
    .filter((e): e is Extract<RunEvent, { kind: "alarm" }> => e.kind === "alarm")
    .map((e) => e.alarm);

  return (
    <section className="panel">
      <h2 className="panel-title">Alarms</h2>
      {alarms.length === 0 ? (
        <p className="muted">No alarms yet.</p>
      ) : (
        <div className="alarm-list">
          {alarms.map((alarm, i) => (
            <pre key={`${alarm.type}-${alarm.timestamp}-${i}`}>
              {JSON.stringify(alarm, null, 2)}
            </pre>
          ))}
        </div>
      )}
    </section>
  );
}
