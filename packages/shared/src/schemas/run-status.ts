import { z } from "zod";

export const RunStatusSchema = z.enum([
  "pending",
  "running",
  "awaiting_approval",
  "complete",
  "failed",
]);

export type RunStatus = z.infer<typeof RunStatusSchema>;
