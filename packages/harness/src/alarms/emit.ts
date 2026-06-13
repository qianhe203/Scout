import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Alarm } from "@scout/shared";

export class AlarmEmitter {
  constructor(private readonly runsDir: string) {}

  private path(runId: string): string {
    return join(this.runsDir, runId, "alarms.jsonl");
  }

  async emit(runId: string, alarm: Alarm): Promise<void> {
    const record: Alarm = {
      ...alarm,
      timestamp: alarm.timestamp ?? new Date().toISOString(),
    };
    await mkdir(join(this.runsDir, runId), { recursive: true });
    await appendFile(this.path(runId), `${JSON.stringify(record)}\n`);
  }
}
