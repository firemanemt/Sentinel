import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ExternalLink, RefreshCw, Clock, Globe } from "lucide-react";

const CATEGORIES = [
  { key: "general", label: "TOP" },
  { key: "technology", label: "TECH" },
  { key: "business", label: "BIZ" },
  { key: "sports", label: "SPORT" },
  { key: "world", label: "WORLD" },
] as const;

type Category = (typeof CATEGORIES)[number]["key"];

interface Article {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  image?: string;
}

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}

export default function NewsWindow() {
  const [category, setCategory] = useState<Category>("general");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newsQuery = (trpc as any).sentinel.getNews.useQuery(
    { category, maxResults: 20 },
    { refetchInterval: 5 * 60_000, staleTime: 3 * 60_000 }
  );

  const articles: Article[] = (newsQuery.data as { articles: Article[] } | undefined)?.articles ?? [];

  return (
    <div className="flex flex-col h-full bg-black text-[#00e5ff] font-mono text-xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#00e5ff]/20">
        <span className="text-[#00e5ff] tracking-widest text-[10px] font-bold">◆ NEWS FEED</span>
        <div className="flex items-center gap-2">
          {newsQuery.dataUpdatedAt > 0 && (
            <span className="text-[#00e5ff]/40 text-[9px] flex items-center gap-1">
              <Clock size={8} />
              {timeAgo(new Date(newsQuery.dataUpdatedAt).toISOString())}
            </span>
          )}
          <button
            onClick={() => newsQuery.refetch()}
            className="text-[#00e5ff]/50 hover:text-[#00e5ff] transition-colors p-1"
            title="Refresh"
          >
            <RefreshCw size={12} className={newsQuery.isFetching ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex border-b border-[#00e5ff]/10">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            className={`flex-1 py-1.5 text-[9px] tracking-widest font-bold transition-colors ${
              category === cat.key
                ? "text-[#00e5ff] border-b border-[#00e5ff]"
                : "text-[#00e5ff]/40 hover:text-[#00e5ff]/70"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Article list */}
      <div className="flex-1 overflow-y-auto">
        {newsQuery.isLoading && (
          <div className="flex items-center justify-center h-20 text-[#00e5ff]/40 text-[10px] tracking-widest">
            FETCHING HEADLINES...
          </div>
        )}
        {newsQuery.isError && (
          <div className="flex items-center justify-center h-20 text-red-400/70 text-[10px] tracking-widest">
            NEWS FEED UNAVAILABLE
          </div>
        )}
        {articles.length === 0 && !newsQuery.isLoading && !newsQuery.isError && (
          <div className="flex items-center justify-center h-20 text-[#00e5ff]/30 text-[10px] tracking-widest">
            NO HEADLINES FOUND
          </div>
        )}
        {articles.map((article, i) => (
          <a
            key={i}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-3 py-2.5 border-b border-[#00e5ff]/5 hover:bg-[#00e5ff]/5 transition-colors group"
          >
            {/* Source + time */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1 text-[#00e5ff]/50 text-[9px]">
                <Globe size={8} />
                <span className="uppercase tracking-wider">{article.source}</span>
              </div>
              <div className="flex items-center gap-1 text-[#00e5ff]/30 text-[9px]">
                <Clock size={8} />
                <span>{timeAgo(article.publishedAt)}</span>
              </div>
            </div>

            {/* Title */}
            <div className="text-[#00e5ff] text-[10px] leading-tight mb-1 group-hover:text-white transition-colors line-clamp-2">
              {article.title}
            </div>

            {/* Description */}
            {article.description && (
              <div className="text-[#00e5ff]/40 text-[9px] leading-tight line-clamp-2">
                {article.description}
              </div>
            )}

            {/* External link indicator */}
            <div className="flex items-center gap-1 mt-1 text-[#00e5ff]/20 group-hover:text-[#00e5ff]/50 transition-colors">
              <ExternalLink size={8} />
              <span className="text-[8px]">READ MORE</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
