import type { LLMProvider, LLMResult } from "../llm.js";

interface AnthropicMessageResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  model?: string;
  error?: { message?: string };
}

export class AnthropicLLMProvider implements LLMProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async complete(opts: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    purpose: string;
  }): Promise<LLMResult> {
    const response = await this.fetchImpl(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: opts.model,
          max_tokens: 4096,
          messages: opts.messages.map((message) => ({
            role: message.role === "assistant" ? "assistant" : "user",
            content: message.content,
          })),
        }),
      },
    );

    const body = (await response.json()) as AnthropicMessageResponse;
    if (!response.ok) {
      throw new Error(
        body.error?.message ??
          `Anthropic request failed (${response.status})`,
      );
    }

    const content =
      body.content?.find((block) => block.type === "text")?.text ?? "";

    return {
      content,
      model: body.model ?? opts.model,
      usage: {
        input_tokens: body.usage?.input_tokens ?? 0,
        output_tokens: body.usage?.output_tokens ?? 0,
      },
    };
  }
}
