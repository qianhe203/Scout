import type {
  OutreachDrafts,
  ProfessionalismFeedback,
  ProductBrief,
  RankedShortlist,
} from "@scout/shared";
import { OutreachDraftsSchema } from "@scout/shared";
import type { HarnessContext, Worker } from "@scout/harness";
import { callLLM, type LLMProvider } from "./llm.js";
import { createProviderFromEnv, defaultLlmModelFromEnv } from "./llm-provider.js";
import { extractJson } from "./utils/json.js";

export interface OutreachWorkerOptions {
  provider?: LLMProvider;
  model?: string;
}

function requireArtifact<T>(ctx: HarnessContext, type: string): T {
  const artifact = ctx.artifacts[type];
  if (!artifact) {
    throw new Error(`OutreachWorker requires ${type} artifact`);
  }
  return artifact.data as T;
}

function buildOutreachPrompt(
  ctx: HarnessContext,
  shortlist: RankedShortlist,
  product: ProductBrief,
): string {
  const feedback =
    ctx.feedback?.kind === "professionalism_fail"
      ? (ctx.feedback as ProfessionalismFeedback)
      : null;

  return [
    "You are OutreachWorker. Write warm, professional creator outreach drafts.",
    "Do NOT promise guaranteed results, viral success, or payment terms.",
    "Keep each body under 120 words with a clear, low-pressure CTA.",
    "",
    "Product brief:",
    JSON.stringify(product, null, 2),
    "",
    "Ranked shortlist:",
    JSON.stringify(shortlist.creators, null, 2),
    feedback
      ? `\nRevise these drafts (${feedback.draftsToRevise.join(", ")}). Failures: ${feedback.failures.join("; ")}`
      : "",
    "",
    "Return ONLY JSON:",
    JSON.stringify(
      {
        drafts: [
          {
            creatorId: "string",
            subject: "string",
            body: "string",
            tone: "warm | professional | energetic",
          },
        ],
      },
      null,
      2,
    ),
  ].join("\n");
}

export class OutreachWorker implements Worker {
  readonly name = "OutreachWorker";
  private readonly provider: LLMProvider;
  private readonly model: string;

  constructor(options: OutreachWorkerOptions = {}) {
    this.provider = options.provider ?? createProviderFromEnv();
    this.model =
      options.model ??
      process.env.OUTREACH_MODEL ??
      defaultLlmModelFromEnv();
  }

  async run(ctx: HarnessContext): Promise<OutreachDrafts> {
    const shortlist = requireArtifact<RankedShortlist>(ctx, "RankedShortlist");
    const product = requireArtifact<ProductBrief>(ctx, "ProductBrief");
    const prompt = buildOutreachPrompt(ctx, shortlist, product);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await callLLM({
        runId: ctx.runId,
        stage: "outreach",
        worker: this.name,
        purpose:
          attempt === 0 ? "outreach_drafts" : "outreach_drafts_retry",
        model: this.model,
        messages: [
          {
            role: "user",
            content:
              attempt === 0
                ? prompt
                : `${prompt}\n\nPrevious output was invalid JSON. Return ONLY valid JSON.`,
          },
        ],
        provider: this.provider,
      });

      try {
        const parsed = JSON.parse(extractJson(result.content)) as OutreachDrafts;
        const validated = OutreachDraftsSchema.parse(parsed);
        const allowedIds = new Set(shortlist.creators.map((creator) => creator.id));
        const filtered = validated.drafts.filter((draft) =>
          allowedIds.has(draft.creatorId),
        );
        if (filtered.length === 0) {
          throw new Error("OutreachWorker produced no drafts for shortlisted creators");
        }
        return OutreachDraftsSchema.parse({ drafts: filtered });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw lastError ?? new Error("OutreachWorker failed to produce OutreachDrafts");
  }
}
