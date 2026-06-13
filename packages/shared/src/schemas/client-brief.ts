import { z } from "zod";

export const ClientBriefSchema = z.object({
  company: z.string().min(1),
  companyDescription: z.string().min(1),
  companyWebsiteUrl: z.string().url().optional(),
  product: z.string().min(1),
  productUrl: z.string().url().optional(),
  budget: z.number().positive(),
  risk: z.enum(["low", "high"]),
  targetAudience: z.string().optional(),
  platformAllowlist: z.array(z.string()).optional(),
  platformBlocklist: z.array(z.string()).optional(),
});

export type ClientBrief = z.infer<typeof ClientBriefSchema>;

export const AlarmSchema = z.object({
  type: z.string(),
  context: z.record(z.unknown()),
  severity: z.enum(["low", "medium", "high"]),
  recommended_action: z.string(),
  timestamp: z.string(),
});

export type Alarm = z.infer<typeof AlarmSchema>;

export const RunStatusSchema = z.enum([
  "pending",
  "running",
  "awaiting_approval",
  "complete",
  "failed",
]);

export type RunStatus = z.infer<typeof RunStatusSchema>;
