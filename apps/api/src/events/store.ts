import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { RunEventSchema, type RunEvent } from "@scout/shared";

export function eventsPath(runsDir: string, runId: string): string {
  return join(runsDir, runId, "events.jsonl");
}

export async function appendRunEvent(
  runsDir: string,
  runId: string,
  event: RunEvent,
): Promise<void> {
  await mkdir(join(runsDir, runId), { recursive: true });
  await appendFile(eventsPath(runsDir, runId), `${JSON.stringify(event)}\n`);
}

export async function loadRunEvents(
  runsDir: string,
  runId: string,
): Promise<RunEvent[]> {
  try {
    const raw = await readFile(eventsPath(runsDir, runId), "utf8");
    const events: RunEvent[] = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      const parsed = RunEventSchema.safeParse(JSON.parse(line));
      if (parsed.success) events.push(parsed.data);
    }
    return events;
  } catch {
    return [];
  }
}

export function isTerminalEvent(event: RunEvent): boolean {
  return (
    event.kind === "run_complete" ||
    event.kind === "human_required" ||
    (event.kind === "alarm" && event.alarm.type === "RUN_FAILED")
  );
}
