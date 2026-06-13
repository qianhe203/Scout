import type { OutreachDrafts } from "@scout/shared";
import type {
  CheckpointResult,
  CP4Evaluator,
  HarnessContext,
} from "@scout/harness";
import { evaluateCP4Heuristic } from "@scout/harness";
import { callLLM, type LLMProvider } from "./llm.js";
import { createProviderFromEnv, defaultLlmModelFromEnv } from "./llm-provider.js";
import { extractJson } from "./utils/json.js";

export interface CP4EvaluatorOptions {
  provider?: LLMProvider;
  model?: string;
  useHeuristicOnly?: boolean;
}

interface RubricResult {
  score: number;
  failures: string[];
  draftsToRevise: string[];
}

function draftsFromContext(ctx: HarnessContext): OutreachDrafts["drafts"] {
  const artifact = ctx.artifacts.OutreachDrafts;
  if (!artifact) return [];
  return (artifact.data as OutreachDrafts).drafts;
}

function toCheckpointResult(result: RubricResult): CheckpointResult {
  const passed = result.score >= 80;
  return {
    id: "CP4",
    passed,
    details: {
      evaluator: "llm",
      score: result.score,
      failures: result.failures,
    },
    ...(passed
      ? {}
      : {
          alarm: {
            type: "PROFESSIONALISM_FAIL",
            severity: "medium",
            context: {
              score: result.score,
              failures: result.failures,
            },
            recommended_action: "Retry OutreachWorker with professionalism feedback",
            timestamp: new Date().toISOString(),
          },
          feedback: {
            kind: "professionalism_fail" as const,
            score: result.score,
            failures: result.failures,
            draftsToRevise: result.draftsToRevise,
          },
        }),
  };
}

async function evaluateWithLLM(
  ctx: HarnessContext,
  provider: LLMProvider,
  model: string,
): Promise<CheckpointResult> {
  const drafts = draftsFromContext(ctx);
  const product = ctx.artifacts.ProductBrief?.data;

  const prompt = [
    "You are CP4 professionalism evaluator for creator outreach drafts.",
    "Score 0-100. Pass threshold is 80.",
    "Check: no false guarantees, no spam tone, brand alignment, appropriate CTA, grammar.",
    "",
    "Product brief:",
    JSON.stringify(product, null, 2),
    "",
    "Drafts:",
    JSON.stringify(drafts, null, 2),
    "",
    "Return ONLY JSON:",
    JSON.stringify(
      {
        score: 85,
        failures: ["string"],
        draftsToRevise: ["creatorId"],
      },
      null,
      2,
    ),
  ].join("\n");

  const result = await callLLM({
    runId: ctx.runId,
    stage: "outreach",
    worker: "CP4Evaluator",
    purpose: "professionalism_rubric",
    model,
    messages: [{ role: "user", content: prompt }],
    provider,
  });

  const parsed = JSON.parse(extractJson(result.content)) as RubricResult;
  return toCheckpointResult({
    score: Math.max(0, Math.min(100, Number(parsed.score))),
    failures: Array.isArray(parsed.failures) ? parsed.failures : [],
    draftsToRevise: Array.isArray(parsed.draftsToRevise)
      ? parsed.draftsToRevise
      : drafts.map((draft) => draft.creatorId),
  });
}

export function createCP4Evaluator(
  options: CP4EvaluatorOptions = {},
): CP4Evaluator {
  const provider = options.provider ?? createProviderFromEnv();
  const model =
    options.model ??
    process.env.CP4_MODEL ??
    defaultLlmModelFromEnv();
  const useHeuristicOnly =
    options.useHeuristicOnly ??
    (process.env.LLM_PROVIDER === "mock" ||
      (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY));

  return async (ctx: HarnessContext) => {
    if (useHeuristicOnly) {
      return evaluateCP4Heuristic(ctx);
    }

    try {
      return await evaluateWithLLM(ctx, provider, model);
    } catch {
      return evaluateCP4Heuristic(ctx);
    }
  };
}

export function createCP4EvaluatorFromEnv(): CP4Evaluator {
  return createCP4Evaluator();
}
