export function HudScanLine() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Scan line */}
      <div
        className="absolute left-0 right-0 h-px opacity-20"
        style={{
          background: "linear-gradient(90deg, transparent, #00ccee, transparent)",
          animation: "scan-line 6s linear infinite",
          top: 0,
        }}
      />
      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#00ccee 1px, transparent 1px), linear-gradient(90deg, #00ccee 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, oklch(0.04 0.01 220 / 0.7) 100%)",
        }}
      />
    </div>
  );
}

export function HudCornerBrackets({ state }: { state?: string }) {
  const isActive = state && state !== "idle";
  const bracketStyle = (pos: string) => ({
    position: "fixed" as const,
    width: 60,
    height: 60,
    zIndex: 50,
    pointerEvents: "none" as const,
    animation: isActive ? "corner-flash 4s ease-in-out infinite" : undefined,
    ...Object.fromEntries(
      pos.split("-").map((p) => [p, 24])
    ),
  });

  const lineColor = isActive ? "#00cceeaa" : "#00ccee66";

  return (
    <>
      {/* Top-left */}
      <div style={bracketStyle("top-left")}>
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
          <line x1="0" y1="0" x2="40" y2="0" stroke={lineColor} strokeWidth="1.5" />
          <line x1="0" y1="0" x2="0" y2="40" stroke={lineColor} strokeWidth="1.5" />
          <line x1="0" y1="0" x2="12" y2="12" stroke={lineColor} strokeWidth="0.5" strokeOpacity="0.4" />
        </svg>
      </div>
      {/* Top-right */}
      <div style={bracketStyle("top-right")}>
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
          <line x1="60" y1="0" x2="20" y2="0" stroke={lineColor} strokeWidth="1.5" />
          <line x1="60" y1="0" x2="60" y2="40" stroke={lineColor} strokeWidth="1.5" />
          <line x1="60" y1="0" x2="48" y2="12" stroke={lineColor} strokeWidth="0.5" strokeOpacity="0.4" />
        </svg>
      </div>
      {/* Bottom-left */}
      <div style={bracketStyle("bottom-left")}>
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
          <line x1="0" y1="60" x2="40" y2="60" stroke={lineColor} strokeWidth="1.5" />
          <line x1="0" y1="60" x2="0" y2="20" stroke={lineColor} strokeWidth="1.5" />
          <line x1="0" y1="60" x2="12" y2="48" stroke={lineColor} strokeWidth="0.5" strokeOpacity="0.4" />
        </svg>
      </div>
      {/* Bottom-right */}
      <div style={bracketStyle("bottom-right")}>
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
          <line x1="60" y1="60" x2="20" y2="60" stroke={lineColor} strokeWidth="1.5" />
          <line x1="60" y1="60" x2="60" y2="20" stroke={lineColor} strokeWidth="1.5" />
          <line x1="60" y1="60" x2="48" y2="48" stroke={lineColor} strokeWidth="0.5" strokeOpacity="0.4" />
        </svg>
      </div>
    </>
  );
}

export function HudStatusBar({ status, model, extra }: { status: string; model?: string; extra?: React.ReactNode }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).toUpperCase();
  const timeStr = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <div
      className="flex items-center justify-between px-6 py-2 text-xs font-mono tracking-widest border-b animate-hud-flicker"
      style={{
        borderColor: "oklch(0.35 0.1 200 / 0.3)",
        color: "#00ccee88",
        background: "oklch(0.07 0.012 220 / 0.95)",
      }}
    >
      <div className="flex items-center gap-4">
        <span style={{ color: "#00cceeaa" }}>SENTINEL v3.0</span>
        <span className="opacity-40">|</span>
        <span>{status.toUpperCase()}</span>
      </div>
      <div className="flex items-center gap-3">
        {model && <span className="opacity-60">{model.toUpperCase()}</span>}
        <span className="opacity-40">|</span>
        <span>{dateStr}</span>
        <span className="opacity-40">|</span>
        <LiveClock />
        {extra && <><span className="opacity-40">|</span>{extra}</>}
      </div>
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = React.useState(
    new Date().toLocaleTimeString("en-GB", { hour12: false })
  );

  React.useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString("en-GB", { hour12: false }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return <span>{time}</span>;
}

import React from "react";
