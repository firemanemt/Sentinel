import { useState } from "react";
import { trpc } from "@/lib/trpc";

const DEFAULT_SYMBOLS = ["SPY", "AAPL", "NVDA", "TSLA", "MSFT"];

interface StockTickerPanelProps {
  className?: string;
}

export function StockTickerPanel({ className = "" }: StockTickerPanelProps) {
  const [symbols] = useState(DEFAULT_SYMBOLS);

  const { data, isLoading } = trpc.sentinel.getStocks.useQuery(
    { symbols },
    { staleTime: 60 * 1000, refetchInterval: 2 * 60 * 1000 }
  );

  const panelStyle: React.CSSProperties = {
    border: "1px solid rgba(0,200,255,0.2)",
    background: "rgba(0,10,20,0.6)",
    borderRadius: "2px",
  };

  const headerStyle: React.CSSProperties = {
    borderBottom: "1px solid rgba(0,200,255,0.15)",
    padding: "4px 8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  };

  return (
    <div style={panelStyle} className={className}>
      <div style={headerStyle}>
        <span style={{ color: "rgba(0,200,255,0.6)", fontFamily: "monospace", fontSize: "9px", letterSpacing: "0.15em" }}>
          MARKET DATA
        </span>
        {data?.timestamp && (
          <span style={{ color: "rgba(0,200,255,0.3)", fontFamily: "monospace", fontSize: "8px" }}>
            {new Date(data.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      <div style={{ padding: "4px 6px" }}>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "8px" }}>
            <span style={{ color: "rgba(0,200,255,0.3)", fontFamily: "monospace", fontSize: "9px" }}>FETCHING...</span>
          </div>
        ) : !data?.quotes?.length ? (
          <div style={{ textAlign: "center", padding: "8px" }}>
            <span style={{ color: "rgba(0,200,255,0.25)", fontFamily: "monospace", fontSize: "9px" }}>NO DATA</span>
          </div>
        ) : (
          data.quotes.map((q, i) => {
            const isUp = q.change >= 0;
            const changeColor = isUp ? "rgba(0,220,100,0.9)" : "rgba(255,80,80,0.9)";
            return (
              <div
                key={q.symbol}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "3px 2px",
                  borderBottom: i < data.quotes.length - 1 ? "1px solid rgba(0,200,255,0.07)" : "none",
                }}
              >
                <div>
                  <div style={{ color: "rgba(0,220,255,0.9)", fontFamily: "monospace", fontSize: "10px", fontWeight: "bold" }}>
                    {q.symbol}
                  </div>
                  <div style={{ color: "rgba(0,200,255,0.35)", fontFamily: "monospace", fontSize: "8px", maxWidth: "70px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {q.name}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "rgba(0,220,255,0.9)", fontFamily: "monospace", fontSize: "10px" }}>
                    ${q.price.toFixed(2)}
                  </div>
                  <div style={{ color: changeColor, fontFamily: "monospace", fontSize: "8px" }}>
                    {isUp ? "▲" : "▼"} {Math.abs(q.changePercent).toFixed(2)}%
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
