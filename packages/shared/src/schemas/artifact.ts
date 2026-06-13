import { z } from "zod";

export const ArtifactMetaSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  version: z.number().int().positive(),
  runId: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export type ArtifactMeta = z.infer<typeof ArtifactMetaSchema>;
