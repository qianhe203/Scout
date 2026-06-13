import type {
  ICPProposal,
  ProductBrief,
  ProductUnclearFeedback,
} from "@scout/shared";
import { ProductBriefSchema } from "@scout/shared";
import type { HarnessContext, Worker } from "@scout/harness";
import type { WebsiteAdapter } from "./adapters/website.js";
import { callLLM, type LLMProvider } from "./llm.js";
import { createProviderFromEnv, defaultLlmModelFromEnv } from "./llm-provider.js";
import { extractJson } from "./utils/json.js";

const REUSABLE_EVIDENCE = new Set([
  "website",
  "product_page",
  "web_search_competitor",
  "web_search_category",
]);

export interface ProductWorkerOptions {
  provider?: LLMProvider;
  website?: WebsiteAdapter;
  model?: string;
}

function requireIcp(ctx: HarnessContext): ICPProposal {
  const artifact = ctx.artifacts.ICPProposal;
  if (!artifact) {
    throw new Error("ProductWorker requires ICPProposal artifact");
  }
  return artifact.data as ICPProposal;
}

function extractIcpSnippets(icp: ICPProposal): string[] {
  const segment =
    icp.segments[icp.recommendedPrimarySegment] ?? icp.segments[0];
  if (!segment) return [];

  return segment.evidence
    .filter((item) => REUSABLE_EVIDENCE.has(item.source))
    .slice(0, 5)
    .map((item) => item.snippet.slice(0, 280));
}

function buildProductPrompt(
  ctx: HarnessContext,
  icp: ICPProposal,
  snippets: string[],
  websiteText?: string,
): string {
  const segment =
    icp.segments[icp.recommendedPrimarySegment] ?? icp.segments[0];
  const alignmentNote =
    icp.clientAlignment === "contradicted" || icp.clientAlignment === "partial"
      ? "Target the researched ICP segment, not the client's stated audience."
      : "Align messaging with the researched primary segment.";

  const feedback =
    ctx.feedback?.kind === "product_unclear"
      ? (ctx.feedback as ProductUnclearFeedback)
      : null;

  return [
    "You are ProductWorker. Translate the client brief into a ProductBrief JSON object.",
    alignmentNote,
    "",
    "Client brief:",
    JSON.stringify(ctx.clientBrief, null, 2),
    "",
    "Primary ICP segment:",
    JSON.stringify(segment, null, 2),
    "",
    "ICP evidence snippets:",
    snippets.length > 0 ? snippets.join("\n---\n") : "(none)",
    websiteText ? `\nWebsite fallback text:\n${websiteText}` : "",
    feedback
      ? `\nRevision required — vague fields: ${feedback.vagueFields.join(", ")}. Hint: ${feedback.hint}`
      : "",
    "",
    "Return ONLY JSON matching:",
    JSON.stringify(
      {
        valueProposition: "string (>=20 chars)",
        differentiators: ["string", "string"],
        toneGuidance: "string (>=20 chars, brand-safe)",
        keyMessages: ["segment-specific string", "segment-specific string"],
        avoidPhrases: ["optional"],
      },
      null,
      2,
    ),
  ].join("\n");
}

export class ProductWorker implements Worker {
  readonly name = "ProductWorker";
  private readonly provider: LLMProvider;
  private readonly website: WebsiteAdapter;
  private readonly model: string;

  constructor(options: ProductWorkerOptions = {}) {
    this.provider = options.provider ?? createProviderFromEnv();
    this.website =
      options.website ??
      ({
        name: "noop",
        fetch: async () => null,
      } satisfies WebsiteAdapter);
    this.model =
      options.model ??
      process.env.PRODUCT_MODEL ??
      defaultLlmModelFromEnv();
  }

  async run(ctx: HarnessContext): Promise<ProductBrief> {
    const icp = requireIcp(ctx);
    let snippets = extractIcpSnippets(icp);
    let websiteText: string | undefined;

    const hasPageEvidence = icp.segments.some((segment) =>
      segment.evidence.some((item) =>
        ["website", "product_page"].includes(item.source),
      ),
    );
    const url =
      ctx.clientBrief.productUrl ?? ctx.clientBrief.companyWebsiteUrl;
    if (!hasPageEvidence && url) {
      const page = await this.website.fetch(url);
      if (page) {
        websiteText = [page.title, page.aboutText, page.productText]
          .filter(Boolean)
          .join("\n")
          .slice(0, 1200);
        snippets = [
          ...snippets,
          websiteText.slice(0, 280),
        ];
      }
    }

    const prompt = buildProductPrompt(ctx, icp, snippets, websiteText);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await callLLM({
        runId: ctx.runId,
        stage: "product",
        worker: this.name,
        purpose: attempt === 0 ? "product_synthesis" : "product_synthesis_retry",
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
        const parsed = JSON.parse(extractJson(result.content)) as ProductBrief;
        return ProductBriefSchema.parse(parsed);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw lastError ?? new Error("ProductWorker failed to produce ProductBrief");
  }
}
