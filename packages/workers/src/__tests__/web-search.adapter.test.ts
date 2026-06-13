import { describe, expect, it, vi } from "vitest";
import { TavilyWebSearchAdapter } from "../adapters/web-search.js";

describe("TavilyWebSearchAdapter", () => {
  it("maps Tavily results to web search snippets", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            url: "https://example.com/review",
            title: "Category buyers",
            content: "Millennial parents are the core buyers for meal kits.",
          },
        ],
      }),
    });

    const adapter = new TavilyWebSearchAdapter("test-key", fetchImpl);
    const results = await adapter.search(['"meal kits" buyer persona']);

    expect(results).toHaveLength(1);
    expect(results[0]?.snippet).toContain("Millennial parents");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.tavily.com/search",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
