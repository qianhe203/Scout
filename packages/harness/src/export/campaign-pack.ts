import type { CampaignPack, HarnessRunLog } from "@scout/shared";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCampaignPackCsv(pack: CampaignPack): string {
  const headers = [
    "creator_id",
    "handle",
    "platform",
    "fit_score",
    "estimated_cost",
    "audience_overlap",
    "rationale",
    "outreach_subject",
    "outreach_body",
    "outreach_tone",
  ];

  const draftByCreator = new Map(
    pack.outreach.drafts.map((draft) => [draft.creatorId, draft]),
  );

  const rows = pack.shortlist.creators.map((creator) => {
    const draft = draftByCreator.get(creator.id);
    return [
      creator.id,
      creator.handle,
      creator.platform,
      String(creator.fitScore),
      String(creator.estimatedCost),
      String(creator.audienceOverlap),
      creator.rationale,
      draft?.subject ?? "",
      draft?.body ?? "",
      draft?.tone ?? "",
    ].map((value) => escapeCsv(String(value)));
  });

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

export function buildCampaignSummary(
  pack: CampaignPack,
  log?: HarnessRunLog | null,
): string {
  const segment =
    pack.icp.segments[pack.icp.recommendedPrimarySegment] ??
    pack.icp.segments[0];
  const lines = [
    "# Campaign Pack Summary",
    "",
    `Exported: ${pack.exportedAt}`,
    "",
    "## ICP",
    `- Persona: ${segment?.persona ?? "n/a"}`,
    `- Alignment: ${pack.icp.clientAlignment}`,
    `- Channels: ${segment?.channels.join(", ") ?? "n/a"}`,
    "",
    "## Shortlist",
    `- Creators: ${pack.shortlist.creators.length}`,
    `- Total estimated cost: $${pack.shortlist.totalEstimatedCost}`,
    "",
    ...pack.shortlist.creators.map(
      (creator) =>
        `- ${creator.handle} (${creator.platform}) — score ${creator.fitScore}, $${creator.estimatedCost}`,
    ),
    "",
    "## Outreach",
    `- Drafts: ${pack.outreach.drafts.length}`,
    "",
    "## Run telemetry",
    log
      ? `- Total tokens: ${log.totalInputTokens + log.totalOutputTokens}`
      : "- Telemetry unavailable",
    log ? `- Estimated cost: $${log.totalEstimatedCostUsd.toFixed(4)}` : "",
    "",
    pack.runLogSummary,
  ];

  return lines.filter(Boolean).join("\n");
}

export async function writeCampaignPackExport(
  runDir: string,
  pack: CampaignPack,
  log?: HarnessRunLog | null,
): Promise<{ csvPath: string; summaryPath: string }> {
  const exportDir = join(runDir, "export");
  await mkdir(exportDir, { recursive: true });

  const csvPath = join(exportDir, "campaign-pack.csv");
  const summaryPath = join(exportDir, "summary.md");
  await writeFile(csvPath, buildCampaignPackCsv(pack), "utf8");
  await writeFile(summaryPath, buildCampaignSummary(pack, log), "utf8");

  return { csvPath, summaryPath };
}
