import { z } from "zod";

export const AlarmSchema = z.object({
  type: z.string(),
  context: z.record(z.unknown()),
  severity: z.enum(["low", "medium", "high"]),
  recommended_action: z.string(),
  timestamp: z.string(),
});

export type Alarm = z.infer<typeof AlarmSchema>;
