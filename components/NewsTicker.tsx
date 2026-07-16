import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

export function NewsTicker() {
  const { data } = trpc.sentinel.getNews.useQuery(
    { category: "general", maxResults: 8 },
    { staleTime: 5 * 60 * 1000, refetchInterval: 10 * 60 * 1000 }
  );

  const tickerRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [category, setCategory] = useState<"general" | "technology" | "business" | "sports">("general");

  const { data: catData } = trpc.sentinel.getNews.useQuery(
    { category, maxResults: 8 },
    { staleTime: 5 * 60 * 1000, refetchInterval: 10 * 60 * 1000 }
  );

  const articles = catData?.articles ?? data?.articles ?? [];
  const tickerText = articles.length > 0
    ? articles.map(a => `◆ ${a.title}  [${a.source}]`).join("          ")
    : "◆ LOADING NEWS FEED...";

  const categories: Array<{ key: typeof category; label: string }> = [
    { key: "general", label: "TOP" },
    { key: "technology", label: "TECH" },
    { key: "business", label: "BIZ" },
    { key: "sports", label: "SPORT" },
  ];

  return (
    <div
      style={{
        position: "relative",
        borderTop: "1px solid rgba(0,200,255,0.2)",
        background: "rgba(0,5,15,0.85)",
        display: "flex",
        alignItems: "center",
        height: "28px",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Category tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1px",
          padding: "0 6px",
          borderRight: "1px solid rgba(0,200,255,0.2)",
          height: "100%",
          flexShrink: 0,
        }}
      >
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            style={{
              padding: "1px 5px",
              fontFamily: "monospace",
              fontSize: "8px",
              letterSpacing: "0.08em",
              color: category === cat.key ? "rgba(0,220,255,1)" : "rgba(0,200,255,0.35)",
              background: category === cat.key ? "rgba(0,200,255,0.1)" : "transparent",
              border: category === cat.key ? "1px solid rgba(0,200,255,0.3)" : "1px solid transparent",
              borderRadius: "1px",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* NEWS label */}
      <div
        style={{
          padding: "0 8px",
          fontFamily: "monospace",
          fontSize: "9px",
          letterSpacing: "0.2em",
          color: "rgba(0,220,255,0.8)",
          borderRight: "1px solid rgba(0,200,255,0.2)",
          height: "100%",
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        NEWS
      </div>

      {/* Scrolling text */}
      <div
        style={{ flex: 1, overflow: "hidden", height: "100%", position: "relative" }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          ref={tickerRef}
          style={{
            display: "inline-block",
            whiteSpace: "nowrap",
            fontFamily: "monospace",
            fontSize: "10px",
            color: "rgba(0,200,255,0.7)",
            lineHeight: "28px",
            animation: paused ? "none" : `ticker-scroll ${Math.max(30, tickerText.length * 0.12)}s linear infinite`,
            paddingLeft: "100%",
          }}
        >
          {tickerText}
        </div>
      </div>

      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
