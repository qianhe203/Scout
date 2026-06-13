import type { LLMProvider, LLMResult } from "./llm.js";

export class MockLLMProvider implements LLMProvider {
  constructor(
    private readonly response: string = '{"ok":true}',
    private readonly usage = { input_tokens: 100, output_tokens: 200 },
  ) {}

  async complete(opts: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    purpose: string;
  }): Promise<LLMResult> {
    return {
      content: this.response,
      usage: this.usage,
      model: opts.model,
    };
  }
}

export function createProviderFromEnv(): LLMProvider {
  const provider = process.env.LLM_PROVIDER ?? "mock";
  if (provider === "mock") {
    return new MockLLMProvider();
  }
  throw new Error(
    `LLM provider "${provider}" not wired yet — use LLM_PROVIDER=mock`,
  );
}
