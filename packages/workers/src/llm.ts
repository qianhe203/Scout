import { estimateCostUsd } from "@scout/shared";
import { trace, SpanStatusCode, type Tracer } from "@opentelemetry/api";

export interface LLMUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface LLMResult {
  content: string;
  usage: LLMUsage;
  model: string;
}

export interface LLMProvider {
  complete(opts: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    purpose: string;
  }): Promise<LLMResult>;
}

export interface LLMTelemetrySink {
  append(
    runId: string,
    event: {
      kind: "llm_call";
      worker: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      estimatedCostUsd: number;
      latencyMs: number;
    },
  ): Promise<void>;
}

export interface LLMCallOptions {
  runId: string;
  stage: string;
  worker: string;
  purpose: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  provider: LLMProvider;
  telemetry?: LLMTelemetrySink;
  tracer?: Tracer;
}

export async function callLLM(opts: LLMCallOptions): Promise<LLMResult> {
  const tracer = opts.tracer ?? trace.getTracer("scout-workers");
  const span = tracer.startSpan(`worker.${opts.worker}.${opts.purpose}`, {
    attributes: {
      "harness.run_id": opts.runId,
      "harness.stage": opts.stage,
      "gen_ai.request.model": opts.model,
      "gen_ai.operation.name": opts.purpose,
    },
  });

  const start = Date.now();
  try {
    const result = await opts.provider.complete({
      model: opts.model,
      messages: opts.messages,
      purpose: opts.purpose,
    });

    const inputTokens = result.usage.input_tokens;
    const outputTokens = result.usage.output_tokens;
    const estimatedCostUsd = estimateCostUsd(
      opts.model,
      inputTokens,
      outputTokens,
    );
    const latencyMs = Date.now() - start;

    span.setAttributes({
      "gen_ai.usage.input_tokens": inputTokens,
      "gen_ai.usage.output_tokens": outputTokens,
      "gen_ai.usage.total_tokens": inputTokens + outputTokens,
      "scout.cost.estimated_usd": estimatedCostUsd,
    });
    span.setStatus({ code: SpanStatusCode.OK });

    if (opts.telemetry) {
      await opts.telemetry.append(opts.runId, {
        kind: "llm_call",
        worker: opts.worker,
        model: opts.model,
        inputTokens,
        outputTokens,
        estimatedCostUsd,
        latencyMs,
      });
    }

    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    span.end();
  }
}

export function exceedsTokenBudget(
  currentTokens: number,
  budget: number,
): boolean {
  return currentTokens >= budget;
}

export class TokenBudgetExceededError extends Error {
  constructor(
    readonly currentTokens: number,
    readonly budget: number,
  ) {
    super(
      `Token budget exceeded: ${currentTokens} tokens used (budget ${budget})`,
    );
    this.name = "TokenBudgetExceededError";
  }
}

export function assertTokenBudget(
  currentTokens: number,
  budget: number,
): void {
  if (exceedsTokenBudget(currentTokens, budget)) {
    throw new TokenBudgetExceededError(currentTokens, budget);
  }
}
