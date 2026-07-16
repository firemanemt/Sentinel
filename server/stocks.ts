/**
 * Stock ticker tool — fetches real-time quotes using Yahoo Finance's unofficial API.
 * No API key required for basic quote fetching.
 */

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  marketState: string;
}

export interface StockResult {
  quotes: StockQuote[];
  timestamp: number;
}

/**
 * Fetch quotes for one or more stock symbols.
 * Uses Yahoo Finance v8 chart endpoint (no API key required).
 */
export async function getStockQuotes(symbols: string[]): Promise<StockResult> {
  const results: StockQuote[] = [];

  for (const symbol of symbols.slice(0, 10)) { // cap at 10 symbols
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol.toUpperCase())}?interval=1d&range=1d`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SENTINEL/1.0)" },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) continue;

      const data = await res.json() as {
        chart?: {
          result?: Array<{
            meta?: {
              symbol: string;
              shortName?: string;
              longName?: string;
              regularMarketPrice?: number;
              previousClose?: number;
              currency?: string;
              marketState?: string;
            };
          }>;
          error?: unknown;
        };
      };

      const result = data?.chart?.result?.[0];
      const meta = result?.meta;
      if (!meta) continue;

      const price = meta.regularMarketPrice ?? 0;
      const prevClose = meta.previousClose ?? price;
      const change = price - prevClose;
      const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

      results.push({
        symbol: meta.symbol ?? symbol.toUpperCase(),
        name: meta.shortName ?? meta.longName ?? symbol.toUpperCase(),
        price,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        currency: meta.currency ?? "USD",
        marketState: meta.marketState ?? "UNKNOWN",
      });
    } catch {
      // skip failed symbols
    }
  }

  return { quotes: results, timestamp: Date.now() };
}

/**
 * Search for a stock symbol by company name.
 */
export async function searchStockSymbol(query: string): Promise<{ symbol: string; name: string; exchange: string }[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=5&newsCount=0`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SENTINEL/1.0)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { quotes?: Array<{ symbol: string; shortname?: string; longname?: string; exchange?: string }> };
    return (data.quotes ?? []).slice(0, 5).map((q) => ({
      symbol: q.symbol,
      name: q.shortname ?? q.longname ?? q.symbol,
      exchange: q.exchange ?? "",
    }));
  } catch {
    return [];
  }
}
