import { RankedShortlistSchema } from "@scout/shared";
import type { CheckpointResult, HarnessContext } from "../types.js";

export function evaluateCP3(ctx: HarnessContext): CheckpointResult {
  const artifact = ctx.artifacts.RankedShortlist;
  const parsed = artifact
    ? RankedShortlistSchema.safeParse(artifact.data)
    : { success: false as const, error: null };
  const top = parsed.success
    ? [...parsed.data.creators].sort((a, b) => b.fitScore - a.fitScore).slice(0, 5)
    : [];
  const passed =
    top.length >= 1 && top.length <= 5 && top.every((c) => c.fitScore >= 60);

  return {
    id: "CP3",
    passed,
    details: {
      topScores: top.map((c) => ({ id: c.id, fitScore: c.fitScore })),
    },
    ...(passed
      ? {}
      : {
          alarm: {
            type: "LOW_FIT_SCORES",
            severity: "medium",
            context: { topScores: top.map((c) => c.fitScore) },
            recommended_action: "Re-score with revised rubric weights",
            timestamp: new Date().toISOString(),
          },
          feedback: {
            kind: "checkpoint_fail" as const,
            checkpointId: "CP3",
            details: { topScores: top.map((c) => c.fitScore) },
          },
        }),
  };
}
