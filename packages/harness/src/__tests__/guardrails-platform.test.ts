import { describe, expect, it } from "vitest";
import type { HarnessContext } from "../types.js";
import { enforceG2PlatformAllow } from "../guardrails/g2-platform-allow.js";
import { enforceG3PlatformBlock } from "../guardrails/g3-platform-block.js";
import { enforceG4RiskLow } from "../guardrails/g4-risk-low.js";
import { validICPProposal, validRankedShortlist } from "../__fixtures__/artifacts.js";

describe("platform guardrails", () => {
  it("G2 blocks when allowlist excludes all ICP channels", () => {
    const ctx = {
      clientBrief: { platformAllowlist: ["youtube"] },
      artifacts: { ICPProposal: { data: validICPProposal } },
    } as unknown as HarnessContext;

    const result = enforceG2PlatformAllow(ctx);
    expect(result.blocked).toBe(true);
    expect(result.alarm?.type).toBe("PLATFORM_BLOCKED");
  });

  it("G3 blocks when blocklist removes all ICP channels", () => {
    const ctx = {
      clientBrief: {
        platformBlocklist: ["tiktok", "instagram"],
      },
      artifacts: { ICPProposal: { data: validICPProposal } },
    } as unknown as HarnessContext;

    const result = enforceG3PlatformBlock(ctx);
    expect(result.blocked).toBe(true);
    expect(result.feedback?.kind).toBe("platform_blocked");
  });
});

describe("enforceG4RiskLow", () => {
  it("blocks scandal-flagged creators when risk is low", () => {
    const ctx = {
      clientBrief: { risk: "low" },
      artifacts: {
        RankedShortlist: { data: validRankedShortlist },
        CreatorCandidates: {
          data: {
            creators: [
              {
                id: "c1",
                handle: "mealmom",
                platform: "tiktok",
                followerCount: 1,
                engagementRate: 0.1,
                estimatedRate: 1,
                audienceTags: [],
                scandalFlag: true,
                trendingScore: 0.1,
                source: "seed",
              },
            ],
          },
        },
      },
    } as unknown as HarnessContext;

    const result = enforceG4RiskLow(ctx);
    expect(result.blocked).toBe(true);
    expect(result.alarm?.type).toBe("SCANDAL_DETECTED");
  });
});
