import React, { useState } from "react";
import { useWindow } from "@/contexts/WindowContext";
import { RotateCcw, X, Layers } from "lucide-react";

export function Dock() {
  const { windows, restoreWindow, closeAllWindows, restoreAllWindows, resetWorkspace } = useWindow();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const minimizedWindows = windows.filter((w) => w.isMinimized);
  const totalWindows = windows.filter((w) => !w.isMinimized).length;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "72px",
        background: "linear-gradient(0deg, rgba(2,6,16,0.98) 0%, rgba(4,12,28,0.96) 100%)",
        borderTop: "1px solid #00d4ff22",
        backdropFilter: "blur(20px)",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: "8px",
        zIndex: 1000,
        overflow: "hidden",
      }}
    >
      {/* Top edge accent line */}
      <div style={{
        position: "absolute",
        top: 0, left: "10%", right: "10%",
        height: 1,
        background: "linear-gradient(90deg, transparent, #00d4ff88, #00d4ff, #00d4ff88, transparent)",
        opacity: 0.6,
      }} />

      {/* System status left */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        flexShrink: 0,
        marginRight: "8px",
      }}>
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2px",
        }}>
          <div style={{
            fontSize: "9px",
            fontFamily: "monospace",
            letterSpacing: "0.2em",
            color: "#00d4ff44",
          }}>
            ACTIVE
          </div>
          <div style={{
            fontSize: "16px",
            fontWeight: 900,
            color: "#00d4ff",
            fontFamily: "'Orbitron', monospace",
            textShadow: "0 0 8px #00d4ffaa",
            lineHeight: 1,
          }}>
            {totalWindows}
          </div>
        </div>
        <div style={{
          width: 1, height: "32px",
          background: "linear-gradient(180deg, transparent, #00d4ff44, transparent)",
        }} />
      </div>

      {/* Minimized Windows */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        gap: "6px",
        overflowX: "auto",
        overflowY: "hidden",
        scrollbarWidth: "none",
      }}>
        {minimizedWindows.length === 0 ? (
          <div style={{
            fontSize: "10px",
            fontFamily: "monospace",
            letterSpacing: "0.2em",
            color: "#00d4ff22",
          }}>
            ── NO MINIMIZED PROCESSES ──
          </div>
        ) : (
          minimizedWindows.map((w) => {
            const isHovered = hoveredId === w.id;
            return (
              <button
                key={w.id}
                onClick={() => restoreWindow(w.id)}
                onMouseEnter={() => setHoveredId(w.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 10px",
                  background: isHovered
                    ? "linear-gradient(90deg, #00d4ff22, #00d4ff11)"
                    : "rgba(0, 212, 255, 0.06)",
                  border: "1px solid",
                  borderColor: isHovered ? "#00d4ff66" : "#00d4ff22",
                  borderRadius: "4px",
                  color: isHovered ? "#00d4ff" : "#00d4ff88",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 600,
                  fontFamily: "'Orbitron', monospace",
                  letterSpacing: "0.08em",
                  transition: "all 0.15s cubic-bezier(0.23,1,0.32,1)",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  boxShadow: isHovered ? "0 0 10px #00d4ff22" : "none",
                  textShadow: isHovered ? "0 0 6px #00d4ff88" : "none",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {isHovered && (
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(90deg, transparent, #00d4ff08, transparent)",
                    animation: "scan-line 1s linear infinite",
                    pointerEvents: "none",
                  }} />
                )}
                <span style={{ fontSize: "14px" }}>{w.icon}</span>
                <span style={{ fontSize: "10px", letterSpacing: "0.1em" }}>
                  {w.title.toUpperCase()}
                </span>
                {/* Minimized indicator dot */}
                <div style={{
                  width: 4, height: 4, borderRadius: "50%",
                  backgroundColor: "#ffaa00",
                  boxShadow: "0 0 4px #ffaa00",
                  flexShrink: 0,
                }} />
              </button>
            );
          })
        )}
      </div>

      {/* Divider */}
      <div style={{
        width: 1, height: "32px", flexShrink: 0,
        background: "linear-gradient(180deg, transparent, #00d4ff44, transparent)",
      }} />

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
        <HudButton
          onClick={restoreAllWindows}
          title="Restore All"
          color="#00d4ff"
          icon={<RotateCcw size={12} />}
          label="RESTORE"
        />
        <HudButton
          onClick={closeAllWindows}
          title="Close All"
          color="#ff4444"
          icon={<X size={12} />}
          label="CLOSE ALL"
        />
        <HudButton
          onClick={resetWorkspace}
          title="Reset Workspace"
          color="#ffaa44"
          icon={<Layers size={12} />}
          label="RESET"
        />
      </div>
    </div>
  );
}

function HudButton({
  onClick,
  title,
  color,
  icon,
  label,
}: {
  onClick: () => void;
  title: string;
  color: string;
  icon: React.ReactNode;
  label: string;
}) {
  const [hovered, setHovered] = useState(false);
  const alpha = hovered ? "33" : "11";
  const borderAlpha = hovered ? "88" : "33";

  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "5px",
        padding: "6px 10px",
        background: `${color}${alpha}`,
        border: `1px solid ${color}${borderAlpha}`,
        borderRadius: "4px",
        color: hovered ? color : `${color}aa`,
        cursor: "pointer",
        fontSize: "10px",
        fontWeight: 700,
        fontFamily: "'Orbitron', monospace",
        letterSpacing: "0.1em",
        transition: "all 0.15s cubic-bezier(0.23,1,0.32,1)",
        boxShadow: hovered ? `0 0 10px ${color}33` : "none",
        textShadow: hovered ? `0 0 6px ${color}88` : "none",
        transform: hovered ? "scale(0.97)" : "scale(1)",
        whiteSpace: "nowrap",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
