import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Plus, Trash2, TrendingUp, TrendingDown, RefreshCw, Search } from "lucide-react";

const DEFAULT_SYMBOLS = ["SPY", "AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "GOOGL"];
const STORAGE_KEY = "sentinel_watchlist";

function loadWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch { /* ignore */ }
  return [...DEFAULT_SYMBOLS];
}

function saveWatchlist(symbols: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
}

interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  marketCap?: number;
}

// Tiny sparkline using SVG path from an array of prices
function Sparkline({ prices, positive }: { prices: number[]; positive: boolean }) {
  if (!prices || prices.length < 2) return <div className="w-16 h-6" />;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 64;
  const h = 24;
  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w;
    const y = h - ((p - min) / range) * h;
    return `${x},${y}`;
  });
  const d = "M " + pts.join(" L ");
  const color = positive ? "#00ff88" : "#ff4444";
  return (
    <svg width={w} height={h} className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatVolume(v: number): string {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + "B";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(0) + "K";
  return String(v);
}

function formatMktCap(v?: number): string {
  if (!v) return "—";
  if (v >= 1_000_000_000_000) return "$" + (v / 1_000_000_000_000).toFixed(2) + "T";
  if (v >= 1_000_000_000) return "$" + (v / 1_000_000_000).toFixed(1) + "B";
  if (v >= 1_000_000) return "$" + (v / 1_000_000).toFixed(1) + "M";
  return "$" + v.toLocaleString();
}

export default function StocksWindow() {
  const [watchlist, setWatchlist] = useState<string[]>(loadWatchlist);
  const [addInput, setAddInput] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ symbol: string; name: string }>>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quotesQuery = (trpc as any).sentinel.getStocks.useQuery(
    { symbols: watchlist },
    { refetchInterval: 30_000, enabled: watchlist.length > 0 }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const searchQuery = (trpc as any).sentinel.searchStock.useQuery(
    { query: searchInput },
    { enabled: searchInput.length >= 2, staleTime: 30_000 }
  );

  useEffect(() => {
    if (quotesQuery.data) setLastUpdated(new Date());
  }, [quotesQuery.data]);

  useEffect(() => {
    if (searchQuery.data) {
      setSearchResults((searchQuery.data as { results: Array<{ symbol: string; name: string }> }).results ?? []);
    }
  }, [searchQuery.data]);

  const handleAddSymbol = (sym: string) => {
    const upper = sym.toUpperCase().trim();
    if (!upper || watchlist.includes(upper)) return;
    const next = [...watchlist, upper];
    setWatchlist(next);
    saveWatchlist(next);
    setAddInput("");
    setSearchInput("");
    setSearchResults([]);
  };

  const handleRemove = (sym: string) => {
    const next = watchlist.filter((s) => s !== sym);
    setWatchlist(next);
    saveWatchlist(next);
    if (selectedSymbol === sym) setSelectedSymbol(null);
  };

  const quotes: Quote[] = (quotesQuery.data as { quotes: Quote[] } | undefined)?.quotes ?? [];
  const selectedQuote = quotes.find((q) => q.symbol === selectedSymbol);

  return (
    <div className="flex flex-col h-full bg-black text-[#00e5ff] font-mono text-xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#00e5ff]/20">
        <div className="flex items-center gap-2">
          <span className="text-[#00e5ff] tracking-widest text-[10px] font-bold">◆ MARKET FEED</span>
          {lastUpdated && (
            <span className="text-[#00e5ff]/40 text-[9px]">
              UPDATED {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        <button
          onClick={() => quotesQuery.refetch()}
          className="text-[#00e5ff]/50 hover:text-[#00e5ff] transition-colors p-1"
          title="Refresh"
        >
          <RefreshCw size={12} className={quotesQuery.isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Add symbol bar */}
      <div className="px-3 py-2 border-b border-[#00e5ff]/10 relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#00e5ff]/40" />
            <input
              value={searchInput || addInput}
              onChange={(e) => {
                const v = e.target.value.toUpperCase();
                setAddInput(v);
                setSearchInput(v);
                if (searchTimeout.current) clearTimeout(searchTimeout.current);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddSymbol(addInput);
                if (e.key === "Escape") { setSearchInput(""); setSearchResults([]); }
              }}
              placeholder="ADD SYMBOL (e.g. AAPL)"
              className="w-full bg-[#00e5ff]/5 border border-[#00e5ff]/20 rounded px-6 py-1 text-[10px] text-[#00e5ff] placeholder-[#00e5ff]/30 focus:outline-none focus:border-[#00e5ff]/60"
            />
          </div>
          <button
            onClick={() => handleAddSymbol(addInput)}
            className="bg-[#00e5ff]/10 hover:bg-[#00e5ff]/20 border border-[#00e5ff]/30 rounded px-2 py-1 text-[10px] text-[#00e5ff] transition-colors"
          >
            <Plus size={10} />
          </button>
        </div>
        {/* Search suggestions */}
        {searchResults.length > 0 && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-[#0a0a0a] border border-[#00e5ff]/30 rounded z-50 shadow-lg">
            {searchResults.slice(0, 5).map((r) => (
              <button
                key={r.symbol}
                onClick={() => handleAddSymbol(r.symbol)}
                className="w-full text-left px-3 py-1.5 hover:bg-[#00e5ff]/10 flex justify-between items-center"
              >
                <span className="text-[#00e5ff] font-bold text-[10px]">{r.symbol}</span>
                <span className="text-[#00e5ff]/50 text-[9px] truncate ml-2">{r.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quote list */}
      <div className="flex-1 overflow-y-auto">
        {quotesQuery.isLoading && (
          <div className="flex items-center justify-center h-20 text-[#00e5ff]/40 text-[10px] tracking-widest">
            FETCHING MARKET DATA...
          </div>
        )}
        {quotesQuery.isError && (
          <div className="flex items-center justify-center h-20 text-red-400/70 text-[10px] tracking-widest">
            MARKET FEED UNAVAILABLE
          </div>
        )}
        {quotes.map((q) => {
          const pos = q.changePercent >= 0;
          const isSelected = selectedSymbol === q.symbol;
          return (
            <div
              key={q.symbol}
              onClick={() => setSelectedSymbol(isSelected ? null : q.symbol)}
              className={`flex items-center gap-2 px-3 py-2 border-b border-[#00e5ff]/5 cursor-pointer transition-colors ${
                isSelected ? "bg-[#00e5ff]/8" : "hover:bg-[#00e5ff]/5"
              }`}
            >
              {/* Symbol + name */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-[#00e5ff] font-bold text-[11px]">{q.symbol}</span>
                  {pos ? (
                    <TrendingUp size={9} className="text-[#00ff88]" />
                  ) : (
                    <TrendingDown size={9} className="text-red-400" />
                  )}
                </div>
                <div className="text-[#00e5ff]/40 text-[9px] truncate">{q.name}</div>
              </div>

              {/* Sparkline placeholder — future: store historical prices */}
              <div className="hidden sm:block">
                <Sparkline prices={[q.low, (q.low + q.high) / 2, q.price, q.high, q.price]} positive={pos} />
              </div>

              {/* Price + change */}
              <div className="text-right">
                <div className="text-[#00e5ff] font-bold text-[11px]">${q.price.toFixed(2)}</div>
                <div className={`text-[9px] font-bold ${pos ? "text-[#00ff88]" : "text-red-400"}`}>
                  {pos ? "+" : ""}{q.changePercent.toFixed(2)}%
                </div>
              </div>

              {/* Remove */}
              <button
                onClick={(e) => { e.stopPropagation(); handleRemove(q.symbol); }}
                className="text-[#00e5ff]/20 hover:text-red-400 transition-colors ml-1"
              >
                <Trash2 size={9} />
              </button>
            </div>
          );
        })}

        {/* Symbols in watchlist with no quote yet */}
        {watchlist
          .filter((s) => !quotes.find((q) => q.symbol === s))
          .map((s) => (
            <div key={s} className="flex items-center justify-between px-3 py-2 border-b border-[#00e5ff]/5 opacity-40">
              <span className="text-[#00e5ff] font-bold text-[11px]">{s}</span>
              <span className="text-[9px] text-[#00e5ff]/40">LOADING...</span>
              <button onClick={() => handleRemove(s)} className="text-[#00e5ff]/20 hover:text-red-400 transition-colors ml-1">
                <Trash2 size={9} />
              </button>
            </div>
          ))}
      </div>

      {/* Detail panel for selected symbol */}
      {selectedQuote && (
        <div className="border-t border-[#00e5ff]/20 px-3 py-2 bg-[#00e5ff]/3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[#00e5ff] font-bold text-[11px] tracking-widest">{selectedQuote.symbol} — {selectedQuote.name}</span>
            <span className={`text-[10px] font-bold ${selectedQuote.changePercent >= 0 ? "text-[#00ff88]" : "text-red-400"}`}>
              {selectedQuote.changePercent >= 0 ? "▲" : "▼"} {Math.abs(selectedQuote.changePercent).toFixed(2)}%
            </span>
          </div>
          <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 text-[9px]">
            <div className="flex justify-between"><span className="text-[#00e5ff]/50">PRICE</span><span className="text-[#00e5ff]">${selectedQuote.price.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-[#00e5ff]/50">CHANGE</span><span className={selectedQuote.change >= 0 ? "text-[#00ff88]" : "text-red-400"}>{selectedQuote.change >= 0 ? "+" : ""}{selectedQuote.change.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-[#00e5ff]/50">MKT CAP</span><span className="text-[#00e5ff]">{formatMktCap(selectedQuote.marketCap)}</span></div>
            <div className="flex justify-between"><span className="text-[#00e5ff]/50">HIGH</span><span className="text-[#00e5ff]">${selectedQuote.high.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-[#00e5ff]/50">LOW</span><span className="text-[#00e5ff]">${selectedQuote.low.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-[#00e5ff]/50">VOLUME</span><span className="text-[#00e5ff]">{formatVolume(selectedQuote.volume)}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
