import type { OutreachDrafts } from "@scout/shared";
import type { CheckpointResult, HarnessContext } from "../types.js";

const GUARANTEE_PATTERNS = [
  /\bguaranteed\b/i,
  /\b100%\b/i,
  /\bviral\b/i,
  /\bgo viral\b/i,
  /\bfree money\b/i,
  /\bno risk\b/i,
];

const SPAM_PATTERNS = [
  /!{3,}/,
  /\bURGENT\b/,
  /\bACT NOW\b/i,
  /\bLIMITED TIME\b/i,
  /\$\$\$/,
];

function scoreDraft(
  draft: OutreachDrafts["drafts"][number],
): { score: number; failures: string[] } {
  const failures: string[] = [];
  const text = `${draft.subject ?? ""} ${draft.body}`;

  for (const pattern of GUARANTEE_PATTERNS) {
    if (pattern.test(text)) {
      failures.push(`False guarantee or hype language in ${draft.creatorId}`);
    }
  }
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      failures.push(`Spam tone detected in ${draft.creatorId}`);
    }
  }
  if (draft.body.trim().length < 40) {
    failures.push(`Draft too short for ${draft.creatorId}`);
  }
  if (!/[.!?]$/.test(draft.body.trim())) {
    failures.push(`Missing closing punctuation in ${draft.creatorId}`);
  }

  const penalty = failures.length * 15;
  return { score: Math.max(0, 100 - penalty), failures };
}

export function evaluateCP4Heuristic(ctx: HarnessContext): CheckpointResult {
  const artifact = ctx.artifacts.OutreachDrafts;
  if (!artifact) {
    return {
      id: "CP4",
      passed: false,
      details: { reason: "missing_outreach_drafts" },
      alarm: {
        type: "PROFESSIONALISM_FAIL",
        severity: "medium",
        context: { reason: "missing_outreach_drafts" },
        recommended_action: "Run OutreachWorker before CP4",
        timestamp: new Date().toISOString(),
      },
      feedback: {
        kind: "professionalism_fail",
        score: 0,
        failures: ["Missing outreach drafts"],
        draftsToRevise: [],
      },
    };
  }

  const drafts = (artifact.data as OutreachDrafts).drafts;
  const scored = drafts.map((draft) => ({
    draft,
    ...scoreDraft(draft),
  }));
  const score =
    scored.length === 0
      ? 0
      : Math.round(
          scored.reduce((sum, item) => sum + item.score, 0) / scored.length,
        );
  const failures = scored.flatMap((item) => item.failures);
  const draftsToRevise = scored
    .filter((item) => item.failures.length > 0)
    .map((item) => item.draft.creatorId);
  const passed = score >= 80;

  return {
    id: "CP4",
    passed,
    details: {
      evaluator: "heuristic",
      score,
      failures,
    },
    ...(passed
      ? {}
      : {
          alarm: {
            type: "PROFESSIONALISM_FAIL",
            severity: "medium",
            context: { score, failures },
            recommended_action:
              "Retry OutreachWorker with professionalism feedback",
            timestamp: new Date().toISOString(),
          },
          feedback: {
            kind: "professionalism_fail" as const,
            score,
            failures,
            draftsToRevise:
              draftsToRevise.length > 0
                ? draftsToRevise
                : drafts.map((draft) => draft.creatorId),
          },
        }),
  };
}

/** Default CP4 uses heuristic rubric; inject LLM evaluator via HarnessConfig. */
export function evaluateCP4(ctx: HarnessContext): CheckpointResult {
  return evaluateCP4Heuristic(ctx);
}
