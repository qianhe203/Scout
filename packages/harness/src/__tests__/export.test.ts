import { describe, expect, it } from "vitest";
import { buildCampaignPack } from "../__fixtures__/artifacts.js";
import {
  buildCampaignPackCsv,
  buildCampaignSummary,
} from "../export/campaign-pack.js";

describe("campaign pack export", () => {
  it("builds CSV with shortlist and outreach columns", () => {
    const pack = buildCampaignPack();
    const csv = buildCampaignPackCsv(pack);

    expect(csv).toContain("creator_id,handle,platform");
    expect(csv).toContain("c1");
    expect(csv).toContain("Partnership idea");
  });

  it("builds markdown summary with ICP and cost totals", () => {
    const pack = buildCampaignPack();
    const summary = buildCampaignSummary(pack, {
      runId: "00000000-0000-4000-8000-000000000001",
      stages: [],
      totalInputTokens: 100,
      totalOutputTokens: 50,
      totalEstimatedCostUsd: 0.12,
      alarms: [],
    });

    expect(summary).toContain("# Campaign Pack Summary");
    expect(summary).toContain("Total estimated cost");
    expect(summary).toContain("Total tokens: 150");
  });
});
