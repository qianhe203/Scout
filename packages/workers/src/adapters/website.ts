export interface WebsitePage {
  url: string;
  title: string;
  aboutText: string;
  productText: string;
  pricingCues: string[];
}

export interface WebsiteAdapter {
  name: string;
  fetch(url: string): Promise<WebsitePage | null>;
}

export function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() ?? "Untitled page";
}

function extractPricingCues(text: string): string[] {
  const cues: string[] = [];
  const patterns = [
    /\$\d+(?:\.\d{2})?/g,
    /(?:from|starting at)\s+\$\d+/gi,
    /(?:per month|\/mo|monthly)/gi,
  ];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) cues.push(...matches.slice(0, 3));
  }
  return [...new Set(cues)].slice(0, 5);
}

export class FetchWebsiteAdapter implements WebsiteAdapter {
  name = "website-fetch";
  private readonly fetched = new Set<string>();

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async fetch(url: string): Promise<WebsitePage | null> {
    if (this.fetched.has(url)) return null;
    this.fetched.add(url);

    try {
      const response = await this.fetchImpl(url, {
        headers: { "User-Agent": "ScoutHarness/1.0" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return null;

      const html = await response.text();
      const text = extractTextFromHtml(html).slice(0, 8000);
      if (!text) return null;

      const title = extractTitle(html);
      return {
        url,
        title,
        aboutText: text.slice(0, 2000),
        productText: text.slice(0, 4000),
        pricingCues: extractPricingCues(text),
      };
    } catch {
      return null;
    }
  }
}

export class MockWebsiteAdapter implements WebsiteAdapter {
  name = "mock-website";
  public readonly fetchedUrls: string[] = [];

  constructor(private readonly pages: Record<string, WebsitePage> = {}) {}

  async fetch(url: string): Promise<WebsitePage | null> {
    this.fetchedUrls.push(url);
    return this.pages[url] ?? null;
  }
}

export function createWebsiteAdapterFromEnv(
  fetchImpl: typeof fetch = fetch,
): WebsiteAdapter {
  return new FetchWebsiteAdapter(fetchImpl);
}
