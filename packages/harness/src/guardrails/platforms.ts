import type { ICPProposal } from "@scout/shared";
import type { HarnessContext } from "../types.js";

/** Platforms ResearchWorker may query after G2/G3 filtering. */
export function resolveResearchPlatforms(ctx: HarnessContext): string[] {
  const icpArtifact = ctx.artifacts.ICPProposal;
  const icp = icpArtifact?.data as ICPProposal | undefined;
  const segmentIndex = icp?.recommendedPrimarySegment ?? 0;
  const channels = icp?.segments[segmentIndex]?.channels ?? [];

  let platforms = [...new Set(channels.map((c) => c.toLowerCase()))];
  const allowlist = ctx.clientBrief.platformAllowlist?.map((p) =>
    p.toLowerCase(),
  );
  const blocklist =
    ctx.clientBrief.platformBlocklist?.map((p) => p.toLowerCase()) ?? [];

  if (allowlist?.length) {
    platforms = platforms.filter((p) => allowlist.includes(p));
  }

  platforms = platforms.filter((p) => !blocklist.includes(p));
  return platforms;
}
