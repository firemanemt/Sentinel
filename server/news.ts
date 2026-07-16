/**
 * News tool — fetches top headlines by parsing BBC RSS feeds directly.
 * No API key required. Falls back to Hacker News API for technology category.
 */

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
}

export interface NewsResult {
  articles: NewsArticle[];
  category: string;
  totalResults: number;
}

const GNEWS_BASE = "https://gnews.io/api/v4";
const GNEWS_API_KEY = process.env.GNEWS_API_KEY ?? "";

const BBC_FEEDS: Record<string, string> = {
  general: "https://feeds.bbci.co.uk/news/rss.xml",
  technology: "https://feeds.bbci.co.uk/news/technology/rss.xml",
  business: "https://feeds.bbci.co.uk/news/business/rss.xml",
  sports: "https://feeds.bbci.co.uk/news/sport/rss.xml",
  science: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
  health: "https://feeds.bbci.co.uk/news/health/rss.xml",
  entertainment: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml",
};

/** Parse a simple RSS 2.0 XML string into NewsArticle objects */
function parseRSS(xml: string, source: string, maxResults: number): NewsArticle[] {
  const items: NewsArticle[] = [];
  // Match <item>...</item> blocks
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null && items.length < maxResults) {
    const block = match[1]!;

    const titleMatch = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ?? block.match(/<title>(.*?)<\/title>/);
    const descMatch = block.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ?? block.match(/<description>(.*?)<\/description>/);
    const linkMatch = block.match(/<link>(.*?)<\/link>/);
    const dateMatch = block.match(/<pubDate>(.*?)<\/pubDate>/);

    if (!titleMatch?.[1]) continue;

    items.push({
      title: titleMatch[1].trim(),
      description: (descMatch?.[1] ?? "").replace(/<[^>]+>/g, "").trim().slice(0, 200),
      url: linkMatch?.[1]?.trim() ?? "",
      source,
      publishedAt: dateMatch?.[1]?.trim() ?? new Date().toUTCString(),
    });
  }

  return items;
}

/**
 * Fetch top headlines. Uses GNews if API key is available, otherwise parses
 * BBC RSS feeds directly (no proxy, no API key required).
 */
export async function getTopHeadlines(
  category: string = "general",
  maxResults: number = 5
): Promise<NewsResult> {
  // Try GNews first if key is set
  if (GNEWS_API_KEY) {
    try {
      const url = `${GNEWS_BASE}/top-headlines?category=${encodeURIComponent(category)}&lang=en&country=us&max=${maxResults}&apikey=${GNEWS_API_KEY}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json() as {
          articles?: Array<{
            title: string;
            description: string;
            url: string;
            source: { name: string };
            publishedAt: string;
          }>;
        };
        const articles: NewsArticle[] = (data.articles ?? []).map((a) => ({
          title: a.title,
          description: a.description ?? "",
          url: a.url,
          source: a.source?.name ?? "Unknown",
          publishedAt: a.publishedAt,
        }));
        if (articles.length > 0) return { articles, category, totalResults: articles.length };
      }
    } catch {
      // fall through
    }
  }

  // Direct BBC RSS parsing (no proxy)
  try {
    const feedUrl = BBC_FEEDS[category] ?? BBC_FEEDS.general!;
    const res = await fetch(feedUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "SENTINEL/1.0 (news reader)" },
    });
    if (res.ok) {
      const xml = await res.text();
      const articles = parseRSS(xml, "BBC News", maxResults);
      if (articles.length > 0) {
        return { articles, category, totalResults: articles.length };
      }
    }
  } catch {
    // fall through
  }

  // Hacker News API fallback for technology
  if (category === "technology" || category === "general") {
    try {
      const hnRes = await fetch("https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=10", {
        signal: AbortSignal.timeout(5000),
      });
      if (hnRes.ok) {
        const hnData = await hnRes.json() as {
          hits: Array<{ title: string; url: string; created_at: string; points: number }>;
        };
        const articles: NewsArticle[] = hnData.hits.slice(0, maxResults).map((h) => ({
          title: h.title,
          description: `${h.points} points on Hacker News`,
          url: h.url ?? `https://news.ycombinator.com`,
          source: "Hacker News",
          publishedAt: h.created_at,
        }));
        if (articles.length > 0) return { articles, category, totalResults: articles.length };
      }
    } catch {
      // all providers failed
    }
  }

  return { articles: [], category, totalResults: 0 };
}
