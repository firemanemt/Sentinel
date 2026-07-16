import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  action: () => void;
  badge?: number;
}

interface SidebarProps {
  items: SidebarItem[];
}

function LiveClock() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
  );
  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return <span>{time}</span>;
}

function ArcReactorLogo({ size = 44 }: { size?: number }) {
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      {/* Outer glow */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        boxShadow: "0 0 18px #00d4ffaa, 0 0 36px #00d4ff44",
        animation: "arc-glow-pulse 2.5s ease-in-out infinite",
      }} />
      {/* Outer ring */}
      <div style={{
        position: "absolute", inset: 2, borderRadius: "50%",
        border: "1.5px solid #00d4ff66",
        animation: "arc-spin 12s linear infinite",
      }}>
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <div key={deg} style={{
            position: "absolute", top: "50%", left: "50%",
            width: 4, height: 1.5,
            backgroundColor: "#00d4ffcc",
            transformOrigin: "0 50%",
            transform: `rotate(${deg}deg) translateX(${size / 2 - 6}px) translateY(-50%)`,
          }} />
        ))}
      </div>
      {/* Mid ring */}
      <div style={{
        position: "absolute", inset: size * 0.18, borderRadius: "50%",
        border: "1px solid #00d4ff44",
        animation: "arc-spin-reverse 7s linear infinite",
      }} />
      {/* Inner hex */}
      <svg
        style={{ position: "absolute", inset: size * 0.28 }}
        viewBox="0 0 24 24" fill="none"
      >
        <polygon
          points="12,2 21,7 21,17 12,22 3,17 3,7"
          stroke="#00d4ffcc" strokeWidth="1.5" fill="#00d4ff11"
        />
        <polygon
          points="12,6 17,9 17,15 12,18 7,15 7,9"
          stroke="#00d4ff66" strokeWidth="1" fill="#00d4ff22"
        />
      </svg>
      {/* Core */}
      <div style={{
        position: "absolute",
        inset: size * 0.38,
        borderRadius: "50%",
        backgroundColor: "#00d4ff",
        boxShadow: "0 0 8px #00d4ff, 0 0 16px #00d4ffaa",
        animation: "arc-pulse 2s ease-in-out infinite",
      }} />
    </div>
  );
}

export function Sidebar({ items }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        bottom: "72px",
        width: isExpanded ? "220px" : "64px",
        background: "linear-gradient(180deg, rgba(2,8,20,0.97) 0%, rgba(4,14,32,0.97) 100%)",
        borderRight: "1px solid #00d4ff22",
        backdropFilter: "blur(20px)",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.25s cubic-bezier(0.23,1,0.32,1)",
        zIndex: 999,
        overflow: "hidden",
      }}
    >
      {/* Animated left edge accent */}
      <div style={{
        position: "absolute",
        left: 0, top: 0, bottom: 0,
        width: 2,
        background: "linear-gradient(180deg, transparent 0%, #00d4ff 30%, #00d4ff88 70%, transparent 100%)",
        opacity: 0.7,
      }} />

      {/* Header */}
      <div style={{
        padding: "14px 12px",
        borderBottom: "1px solid #00d4ff18",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        minHeight: "72px",
        flexShrink: 0,
        position: "relative",
      }}>
        <ArcReactorLogo size={isExpanded ? 40 : 38} />
        {isExpanded && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              color: "#00d4ff",
              fontWeight: 900,
              fontSize: "15px",
              letterSpacing: "0.18em",
              textShadow: "0 0 12px #00d4ffaa",
              fontFamily: "'Orbitron', monospace",
              lineHeight: 1.1,
            }}>
              SENTINEL
            </div>
            <div style={{
              color: "#00d4ff55",
              fontSize: "9px",
              letterSpacing: "0.25em",
              fontFamily: "monospace",
              marginTop: "2px",
            }}>
              SENTINEL AI
            </div>
          </div>
        )}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            background: "none",
            border: "1px solid #00d4ff22",
            borderRadius: "4px",
            color: "#00d4ff88",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#00d4ff66";
            (e.currentTarget as HTMLElement).style.color = "#00d4ff";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#00d4ff22";
            (e.currentTarget as HTMLElement).style.color = "#00d4ff88";
          }}
        >
          {isExpanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {/* Section label */}
      {isExpanded && (
        <div style={{
          padding: "10px 16px 6px",
          fontSize: "9px",
          letterSpacing: "0.3em",
          color: "#00d4ff33",
          fontFamily: "monospace",
          textTransform: "uppercase",
          flexShrink: 0,
        }}>
          ── MODULES ──
        </div>
      )}

      {/* Navigation Items */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "4px 8px" }}>
        {items.map((item) => {
          const isHovered = hoveredId === item.id;
          return (
            <button
              key={item.id}
              onClick={item.action}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                width: "100%",
                padding: isExpanded ? "10px 12px" : "10px",
                marginBottom: "4px",
                background: isHovered
                  ? "linear-gradient(90deg, #00d4ff18 0%, #00d4ff08 100%)"
                  : "transparent",
                border: "1px solid",
                borderColor: isHovered ? "#00d4ff44" : "#00d4ff11",
                borderRadius: "6px",
                color: isHovered ? "#00d4ff" : "#00d4ffaa",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "13px",
                fontWeight: isHovered ? 700 : 500,
                fontFamily: "'Orbitron', monospace",
                letterSpacing: "0.05em",
                transition: "all 0.15s cubic-bezier(0.23,1,0.32,1)",
                textAlign: "left",
                position: "relative",
                boxShadow: isHovered ? "0 0 12px #00d4ff18, inset 0 0 8px #00d4ff08" : "none",
                textShadow: isHovered ? "0 0 8px #00d4ff88" : "none",
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              {/* Active left bar */}
              {isHovered && (
                <div style={{
                  position: "absolute",
                  left: 0, top: "20%", bottom: "20%",
                  width: 2,
                  backgroundColor: "#00d4ff",
                  borderRadius: "0 2px 2px 0",
                  boxShadow: "0 0 6px #00d4ff",
                }} />
              )}
              {/* Scan shimmer on hover */}
              {isHovered && (
                <div style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(90deg, transparent 0%, #00d4ff08 50%, transparent 100%)",
                  animation: "scan-line 1.5s linear infinite",
                  pointerEvents: "none",
                }} />
              )}
              <span style={{
                fontSize: "16px",
                flexShrink: 0,
                filter: isHovered ? "drop-shadow(0 0 4px #00d4ff88)" : "none",
                transition: "filter 0.15s",
              }}>
                {item.icon}
              </span>
              {isExpanded && (
                <span style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontSize: "11px",
                  letterSpacing: "0.1em",
                }}>
                  {item.label.toUpperCase()}
                </span>
              )}
              {/* Badge */}
              {item.badge != null && item.badge > 0 && (
                <div style={{
                  minWidth: "18px",
                  height: "18px",
                  borderRadius: "9px",
                  backgroundColor: "#ff3333",
                  color: "#fff",
                  fontSize: "10px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 4px",
                  flexShrink: 0,
                  boxShadow: "0 0 6px #ff333388",
                  fontFamily: "monospace",
                }}>
                  {item.badge > 99 ? "99+" : item.badge}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer status */}
      <div style={{
        padding: "10px 12px",
        borderTop: "1px solid #00d4ff18",
        flexShrink: 0,
      }}>
        {isExpanded ? (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "9px",
            fontFamily: "monospace",
            color: "#00d4ff44",
            letterSpacing: "0.15em",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                backgroundColor: "#00ff88",
                boxShadow: "0 0 4px #00ff88",
                animation: "arc-pulse 2s ease-in-out infinite",
              }} />
              <span style={{ color: "#00ff8888" }}>ONLINE</span>
            </div>
            <LiveClock />
          </div>
        ) : (
          <div style={{
            display: "flex",
            justifyContent: "center",
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              backgroundColor: "#00ff88",
              boxShadow: "0 0 4px #00ff88",
              animation: "arc-pulse 2s ease-in-out infinite",
            }} />
          </div>
        )}
      </div>
    </div>
  );
}
