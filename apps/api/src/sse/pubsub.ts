import type { RunEvent } from "@scout/shared";

export type RunEventSubscriber = (
  event: RunEvent,
) => void | Promise<void>;

export class RunPubSub {
  private readonly subscribers = new Map<string, Set<RunEventSubscriber>>();

  initRun(runId: string): void {
    if (!this.subscribers.has(runId)) {
      this.subscribers.set(runId, new Set());
    }
  }

  hasRun(runId: string): boolean {
    return this.subscribers.has(runId);
  }

  subscribe(runId: string, fn: RunEventSubscriber): () => void {
    const set = this.subscribers.get(runId) ?? new Set();
    set.add(fn);
    this.subscribers.set(runId, set);
    return () => set.delete(fn);
  }

  async publish(runId: string, event: RunEvent): Promise<void> {
    const set = this.subscribers.get(runId);
    if (!set) return;
    await Promise.all([...set].map((fn) => fn(event)));
  }

  clear(runId: string): void {
    this.subscribers.delete(runId);
  }
}

export const runPubSub = new RunPubSub();
