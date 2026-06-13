export const API_BASE =
  process.env.NEXT_PUBLIC_HARNESS_API_URL ?? "http://localhost:3001";

export async function createRun(body: unknown) {
  const res = await fetch(`${API_BASE}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST /runs failed: ${res.status}`);
  return res.json() as Promise<{ runId: string }>;
}
