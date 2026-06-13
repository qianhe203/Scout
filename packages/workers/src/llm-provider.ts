import { AnthropicLLMProvider } from "./providers/anthropic.js";
import { OpenAILLMProvider } from "./providers/openai.js";
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

export function createProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): LLMProvider {
  const provider = env.LLM_PROVIDER ?? "mock";

  if (provider === "mock") {
    return new MockLLMProvider();
  }

  if (provider === "anthropic") {
    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic");
    }
    return new AnthropicLLMProvider(apiKey);
  }

  if (provider === "openai") {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER=openai");
    }
    const baseUrl = env.OPENAI_API_BASE?.trim() || undefined;
    return new OpenAILLMProvider(apiKey, fetchImpl, baseUrl);
  }

  throw new Error(
    `Unknown LLM provider "${provider}" — use mock, anthropic, or openai`,
  );
}

export { AnthropicLLMProvider } from "./providers/anthropic.js";
export { OpenAILLMProvider } from "./providers/openai.js";
