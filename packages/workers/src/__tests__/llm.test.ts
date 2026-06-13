import { trace, type Tracer } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { describe, expect, it, vi } from "vitest";
import { estimateCostUsd } from "@scout/shared";
import {
  assertTokenBudget,
  callLLM,
  exceedsTokenBudget,
  TokenBudgetExceededError,
} from "../llm.js";
import {
  AnthropicLLMProvider,
  createProviderFromEnv,
  MockLLMProvider,
  OpenAILLMProvider,
} from "../llm-provider.js";

function createTestTracer(): { tracer: Tracer; exporter: InMemorySpanExporter } {
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider();
  provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
  trace.setGlobalTracerProvider(provider);
  return { tracer: trace.getTracer("scout-workers-test"), exporter };
}

describe("callLLM", () => {
  it("computes estimatedCostUsd from model pricing", async () => {
    const append = vi.fn().mockResolvedValue(undefined);
    const provider = new MockLLMProvider('{"ok":true}', {
      input_tokens: 1000,
      output_tokens: 500,
    });

    const result = await callLLM({
      runId: "run-1",
      stage: "icp",
      worker: "ICPWorker",
      purpose: "icp_synthesis",
      model: "claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "test" }],
      provider,
      telemetry: { append },
    });

    const expected = estimateCostUsd(
      "claude-sonnet-4-20250514",
      1000,
      500,
    );
    expect(result.usage.input_tokens).toBe(1000);
    expect(append).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({
        kind: "llm_call",
        estimatedCostUsd: expected,
      }),
    );
  });

  it("sets gen_ai usage attributes on the OTel span", async () => {
    const { tracer, exporter } = createTestTracer();
    const provider = new MockLLMProvider('{"ok":true}', {
      input_tokens: 42,
      output_tokens: 7,
    });

    await callLLM({
      runId: "run-otel",
      stage: "product",
      worker: "ProductWorker",
      purpose: "product_synthesis",
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "test" }],
      provider,
      tracer,
    });

    const span = exporter.getFinishedSpans()[0];
    expect(span?.attributes["gen_ai.usage.input_tokens"]).toBe(42);
    expect(span?.attributes["gen_ai.usage.output_tokens"]).toBe(7);
    expect(span?.attributes["gen_ai.usage.total_tokens"]).toBe(49);
  });
});

describe("token budget helpers", () => {
  it("detects when the run token budget is exceeded", () => {
    expect(exceedsTokenBudget(50_000, 50_000)).toBe(true);
    expect(exceedsTokenBudget(49_999, 50_000)).toBe(false);
  });

  it("throws TokenBudgetExceededError for the harness watchdog", () => {
    expect(() => assertTokenBudget(50_000, 50_000)).toThrow(
      TokenBudgetExceededError,
    );
  });
});

describe("createProviderFromEnv", () => {
  it("defaults to mock provider", () => {
    expect(createProviderFromEnv({})).toBeInstanceOf(MockLLMProvider);
  });

  it("requires API keys for live providers", () => {
    expect(() =>
      createProviderFromEnv({ LLM_PROVIDER: "anthropic" }),
    ).toThrow(/ANTHROPIC_API_KEY/);
    expect(() => createProviderFromEnv({ LLM_PROVIDER: "openai" })).toThrow(
      /OPENAI_API_KEY/,
    );
  });
});

describe("AnthropicLLMProvider", () => {
  it("maps Anthropic usage fields into LLMResult", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "claude-sonnet-4-20250514",
        content: [{ type: "text", text: '{"segments":[]}' }],
        usage: { input_tokens: 120, output_tokens: 80 },
      }),
    });

    const provider = new AnthropicLLMProvider("test-key", fetchImpl);
    const result = await provider.complete({
      model: "claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "hello" }],
      purpose: "icp_synthesis",
    });

    expect(result.content).toBe('{"segments":[]}');
    expect(result.usage).toEqual({ input_tokens: 120, output_tokens: 80 });
  });
});

describe("OpenAILLMProvider", () => {
  it("maps OpenAI usage fields into LLMResult", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "gpt-4o-mini",
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: { prompt_tokens: 90, completion_tokens: 10 },
      }),
    });

    const provider = new OpenAILLMProvider("test-key", fetchImpl);
    const result = await provider.complete({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "hello" }],
      purpose: "score",
    });

    expect(result.content).toBe('{"ok":true}');
    expect(result.usage).toEqual({ input_tokens: 90, output_tokens: 10 });
  });

  it("uses OPENAI_API_BASE for OpenAI-compatible endpoints", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "qwen3-coder",
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    });

    const provider = new OpenAILLMProvider(
      "test-key",
      fetchImpl,
      "http://10.10.2.113:4000/v1",
    );
    await provider.complete({
      model: "qwen3-coder",
      messages: [{ role: "user", content: "hello" }],
      purpose: "icp_synthesis",
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://10.10.2.113:4000/v1/chat/completions",
      expect.any(Object),
    );
  });

  it("wires OPENAI_API_BASE from env in createProviderFromEnv", () => {
    const provider = createProviderFromEnv({
      LLM_PROVIDER: "openai",
      OPENAI_API_KEY: "test-key",
      OPENAI_API_BASE: "http://10.10.2.113:4000/v1",
    });
    expect(provider).toBeInstanceOf(OpenAILLMProvider);
  });
});
