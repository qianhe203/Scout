import type { LLMProvider, LLMResult } from "../llm.js";

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  model?: string;
  error?: { message?: string };
}

function chatCompletionsUrl(baseUrl?: string): string {
  const base = (baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  return `${base}/chat/completions`;
}

export class OpenAILLMProvider implements LLMProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly baseUrl?: string,
  ) {}

  async complete(opts: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    purpose: string;
  }): Promise<LLMResult> {
    const response = await this.fetchImpl(
      chatCompletionsUrl(this.baseUrl),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: opts.model,
          messages: opts.messages,
          ...(process.env.OPENAI_JSON_MODE === "true"
            ? { response_format: { type: "json_object" } }
            : {}),
        }),
      },
    );

    const body = (await response.json()) as OpenAIChatResponse;
    if (!response.ok) {
      throw new Error(
        body.error?.message ?? `OpenAI request failed (${response.status})`,
      );
    }

    return {
      content: body.choices?.[0]?.message?.content ?? "",
      model: body.model ?? opts.model,
      usage: {
        input_tokens: body.usage?.prompt_tokens ?? 0,
        output_tokens: body.usage?.completion_tokens ?? 0,
      },
    };
  }
}
