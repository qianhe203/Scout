import type { GuardrailResult } from "../types.js";

/**
 * G6 — outbound actions are draft-only. Workers must not send email/DM/post.
 * Enforcement is primarily at the worker/adapter layer; harness documents the rule.
 */
export function enforceG6NoSend(): GuardrailResult {
  return { id: "G6", blocked: false };
}
