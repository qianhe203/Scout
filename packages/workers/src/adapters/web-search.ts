export interface WebSearchResult {
  url: string;
  title: string;
  snippet: string;
}

export interface WebSearchAdapter {
  name: string;
  search(queries: string[]): Promise<WebSearchResult[]>;
}

interface TavilyResponse {
  results?: Array<{ url?: string; title?: string; content?: string }>;
  error?: string;
}

interface SerperResponse {
  organic?: Array<{ link?: string; title?: string; snippet?: string }>;
  error?: string;
}

export class TavilyWebSearchAdapter implements WebSearchAdapter {
  name = "tavily";

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async search(queries: string[]): Promise<WebSearchResult[]> {
    const results: WebSearchResult[] = [];

    for (const query of queries) {
      const response = await this.fetchImpl("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: this.apiKey,
          query,
          max_results: 3,
          search_depth: "basic",
        }),
      });

      if (!response.ok) {
        throw new Error(`Tavily search failed: ${response.status}`);
      }

      const data = (await response.json()) as TavilyResponse;
      if (data.error) {
        throw new Error(`Tavily search error: ${data.error}`);
      }

      for (const item of data.results ?? []) {
        if (!item.content) continue;
        results.push({
          url: item.url ?? "",
          title: item.title ?? query,
          snippet: item.content,
        });
      }
    }

    return results;
  }
}

export class SerperWebSearchAdapter implements WebSearchAdapter {
  name = "serper";

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async search(queries: string[]): Promise<WebSearchResult[]> {
    const results: WebSearchResult[] = [];

    for (const query of queries) {
      const response = await this.fetchImpl("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": this.apiKey,
        },
        body: JSON.stringify({ q: query, num: 3 }),
      });

      if (!response.ok) {
        throw new Error(`Serper search failed: ${response.status}`);
      }

      const data = (await response.json()) as SerperResponse;
      for (const item of data.organic ?? []) {
        if (!item.snippet) continue;
        results.push({
          url: item.link ?? "",
          title: item.title ?? query,
          snippet: item.snippet,
        });
      }
    }

    return results;
  }
}

export class MockWebSearchAdapter implements WebSearchAdapter {
  name = "mock-web-search";
  readonly searchedQueries: string[] = [];

  constructor(private readonly results: WebSearchResult[] = []) {}

  async search(queries: string[]): Promise<WebSearchResult[]> {
    this.searchedQueries.push(...queries);
    return this.results;
  }
}

export function createWebSearchAdapterFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): WebSearchAdapter {
  if (env.TAVILY_API_KEY) {
    return new TavilyWebSearchAdapter(env.TAVILY_API_KEY, fetchImpl);
  }
  if (env.SERPER_API_KEY) {
    return new SerperWebSearchAdapter(env.SERPER_API_KEY, fetchImpl);
  }
  return new MockWebSearchAdapter();
}
