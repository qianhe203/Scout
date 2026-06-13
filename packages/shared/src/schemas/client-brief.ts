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
  exampleCustomers: z.array(z.string()).optional(),
  admiredCompetitor: z.string().optional(),
  tractionChannels: z.array(z.string()).optional(),
  whyTheyBuy: z.string().optional(),
  platformAllowlist: z.array(z.string()).optional(),
  platformBlocklist: z.array(z.string()).optional(),
  igCredentials: z.object({ token: z.string() }).optional(),
});

export type ClientBrief = z.infer<typeof ClientBriefSchema>;
