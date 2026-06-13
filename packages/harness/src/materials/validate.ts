import {
  CampaignPackSchema,
  CreatorCandidatesSchema,
  ICPProposalSchema,
  OutreachDraftsSchema,
  ProductBriefSchema,
  RankedShortlistSchema,
  type CampaignPack,
  type CreatorCandidates,
  type ICPProposal,
  type OutreachDrafts,
  type ProductBrief,
  type RankedShortlist,
} from "@scout/shared";
import type { ZodSchema } from "zod";

const ARTIFACT_SCHEMAS: Record<string, ZodSchema> = {
  ICPProposal: ICPProposalSchema,
  ProductBrief: ProductBriefSchema,
  CreatorCandidates: CreatorCandidatesSchema,
  RankedShortlist: RankedShortlistSchema,
  OutreachDrafts: OutreachDraftsSchema,
  CampaignPack: CampaignPackSchema,
};

export type ArtifactType = keyof typeof ARTIFACT_SCHEMAS;

export type ArtifactDataMap = {
  ICPProposal: ICPProposal;
  ProductBrief: ProductBrief;
  CreatorCandidates: CreatorCandidates;
  RankedShortlist: RankedShortlist;
  OutreachDrafts: OutreachDrafts;
  CampaignPack: CampaignPack;
};

export function isArtifactType(type: string): type is ArtifactType {
  return type in ARTIFACT_SCHEMAS;
}

export function validateArtifact(type: ArtifactType, data: unknown): unknown {
  const schema = ARTIFACT_SCHEMAS[type];
  if (!schema) {
    throw new Error(`Unknown artifact type: ${type}`);
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      `Artifact validation failed for ${type}: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}
