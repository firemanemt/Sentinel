import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import { BookmarkPlus, Check } from "lucide-react";

export interface Message {
  id: string;
  role: "user" | "sentinel";
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
}

interface MessageBubbleProps {
  message: Message;
}

// ── Tool badge definitions ────────────────────────────────────────────────────
const TOOL_BADGES: Array<{ key: string; label: string; color: string; bg: string; border: string }> = [
  { key: "weather",       label: "WEATHER",        color: "#4488ff", bg: "oklch(0.55 0.22 250 / 0.2)", border: "oklch(0.55 0.22 250 / 0.4)" },
  { key: "search",        label: "SEARCH",         color: "#00ccee", bg: "oklch(0.72 0.18 200 / 0.15)", border: "oklch(0.72 0.18 200 / 0.3)" },
  { key: "calendar",      label: "CALENDAR",       color: "#00ff88", bg: "oklch(0.55 0.22 150 / 0.2)", border: "oklch(0.55 0.22 150 / 0.4)" },
  { key: "time",          label: "TIME",           color: "#ffcc44", bg: "oklch(0.55 0.22 60 / 0.2)",  border: "oklch(0.55 0.22 60 / 0.4)" },
  { key: "email",         label: "EMAIL",          color: "#cc88ff", bg: "oklch(0.55 0.22 280 / 0.2)", border: "oklch(0.55 0.22 280 / 0.4)" },
  { key: "spotify",       label: "SPOTIFY",        color: "#1db954", bg: "oklch(0.55 0.22 145 / 0.2)", border: "oklch(0.55 0.22 145 / 0.4)" },
  { key: "reminder",      label: "REMINDER",       color: "#ff9933", bg: "oklch(0.55 0.22 40 / 0.2)",  border: "oklch(0.55 0.22 40 / 0.4)" },
  { key: "directions",    label: "DIRECTIONS",     color: "#00eebb", bg: "oklch(0.55 0.22 175 / 0.2)", border: "oklch(0.55 0.22 175 / 0.4)" },
  { key: "alerts",        label: "NWS ALERTS",     color: "#ff4444", bg: "oklch(0.55 0.22 25 / 0.2)",  border: "oklch(0.55 0.22 25 / 0.4)" },
  { key: "memory",        label: "MEMORY",         color: "#ee88ff", bg: "oklch(0.55 0.22 300 / 0.2)", border: "oklch(0.55 0.22 300 / 0.4)" },
  { key: "github",        label: "GITHUB",         color: "#aaaaaa", bg: "oklch(0.35 0.02 220 / 0.3)", border: "oklch(0.55 0.02 220 / 0.4)" },
  { key: "discord",       label: "DISCORD",        color: "#7289da", bg: "oklch(0.45 0.18 270 / 0.2)", border: "oklch(0.55 0.18 270 / 0.4)" },
  { key: "home_assistant",label: "HOME ASSISTANT", color: "#41bdf5", bg: "oklch(0.55 0.18 210 / 0.2)", border: "oklch(0.55 0.18 210 / 0.4)" },
  { key: "briefing",      label: "BRIEFING",       color: "#ffd700", bg: "oklch(0.55 0.22 90 / 0.2)",  border: "oklch(0.55 0.22 90 / 0.4)" },
  { key: "stocks",        label: "STOCKS",         color: "#44ff88", bg: "oklch(0.55 0.22 145 / 0.15)", border: "oklch(0.55 0.22 145 / 0.35)" },
  { key: "news",          label: "NEWS",           color: "#ff8844", bg: "oklch(0.55 0.22 50 / 0.2)",  border: "oklch(0.55 0.22 50 / 0.4)" },
];

// ── Remember This button ──────────────────────────────────────────────────────
function RememberButton({ content }: { content: string }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const saveFact = trpc.sentinel.saveFact.useMutation();

  const handleRemember = useCallback(async () => {
    if (saved || saving) return;
    setSaving(true);
    // Derive a short key from the first 40 chars of content
    const key = `note_${Date.now()}`;
    const value = content.length > 500 ? content.slice(0, 500) + "…" : content;
    try {
      await saveFact.mutateAsync({ key, value });
      setSaved(true);
    } catch {
      // silently fail — user can retry
    } finally {
      setSaving(false);
    }
  }, [content, saved, saving, saveFact]);

  return (
    <button
      onClick={handleRemember}
      disabled={saved || saving}
      title={saved ? "Saved to SENTINEL memory" : "Remember this"}
      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-sm font-mono tracking-wider transition-all duration-200"
      style={{
        background: saved ? "oklch(0.55 0.22 145 / 0.25)" : "oklch(0.55 0.18 200 / 0.12)",
        color: saved ? "#00ff88" : "#4488aa",
        border: saved ? "1px solid oklch(0.55 0.22 145 / 0.5)" : "1px solid oklch(0.55 0.18 200 / 0.25)",
        cursor: saved ? "default" : "pointer",
        opacity: saving ? 0.6 : 1,
      }}
    >
      {saved ? (
        <><Check size={10} /> REMEMBERED</>
      ) : (
        <><BookmarkPlus size={10} /> REMEMBER</>
      )}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MessageBubble({ message }: MessageBubbleProps) {
  const isSentinel = message.role === "sentinel";
  const timeStr = message.timestamp.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const activeBadges = TOOL_BADGES.filter(
    (b) => message.toolsUsed?.includes(b.key)
  );
  // Also check for open_window: prefixed entries
  const openedWindows = (message.toolsUsed ?? [])
    .filter((t) => t.startsWith("open_window:"))
    .map((t) => {
      const rest = t.slice("open_window:".length);
      const colonIdx = rest.indexOf(":");
      return colonIdx === -1 ? rest : rest.slice(0, colonIdx);
    });

  return (
    <div
      className={`flex flex-col gap-1 animate-fade-in-up ${isSentinel ? "items-start" : "items-end"}`}
    >
      {/* Label */}
      <div
        className="text-xs font-mono tracking-widest px-1"
        style={{
          color: isSentinel ? "#00ccee" : "#8899bb",
          textShadow: isSentinel ? "0 0 8px #00ccee88" : "none",
        }}
      >
        {isSentinel ? "SENTINEL" : "YOU"} · {timeStr}
      </div>

      {/* Bubble */}
      <div
        className={`relative max-w-[85%] px-4 py-3 rounded-sm text-sm leading-relaxed ${
          isSentinel ? "hud-corners" : ""
        }`}
        style={{
          background: isSentinel
            ? "oklch(0.08 0.015 220 / 0.55)"
            : "oklch(0.11 0.03 220 / 0.5)",
          backdropFilter: "blur(6px)",
          border: isSentinel
            ? "1px solid oklch(0.72 0.18 200 / 0.35)"
            : "1px solid oklch(0.35 0.1 200 / 0.25)",
          boxShadow: isSentinel
            ? "0 0 16px oklch(0.72 0.18 200 / 0.12), inset 0 0 12px oklch(0.72 0.18 200 / 0.04)"
            : "none",
          color: isSentinel ? "#b0e8f0" : "#8899cc",
          fontFamily: "'Exo 2', sans-serif",
        }}
      >
        {/* Corner brackets for SENTINEL */}
        {isSentinel && (
          <>
            <span
              className="absolute top-0 left-0 w-3 h-3"
              style={{
                borderTop: "2px solid #00ccee",
                borderLeft: "2px solid #00ccee",
                opacity: 0.8,
              }}
            />
            <span
              className="absolute bottom-0 right-0 w-3 h-3"
              style={{
                borderBottom: "2px solid #00ccee",
                borderRight: "2px solid #00ccee",
                opacity: 0.8,
              }}
            />
          </>
        )}

        <Streamdown>{message.content}</Streamdown>

        {/* Tool usage badges + Remember button */}
        {isSentinel && (
          <div className="flex gap-1 mt-2 flex-wrap items-center">
            {activeBadges.map((b) => (
              <span
                key={b.key}
                className="text-xs px-2 py-0.5 rounded-sm font-mono tracking-wider"
                style={{ background: b.bg, color: b.color, border: `1px solid ${b.border}` }}
              >
                ◈ {b.label}
              </span>
            ))}
            {openedWindows.map((w) => (
              <span
                key={`ow-${w}`}
                className="text-xs px-2 py-0.5 rounded-sm font-mono tracking-wider"
                style={{ background: "oklch(0.55 0.18 200 / 0.15)", color: "#00ccee", border: "1px solid oklch(0.55 0.18 200 / 0.35)" }}
              >
                ◈ OPENED {w.toUpperCase()}
              </span>
            ))}
            {/* Remember This button — always visible on SENTINEL messages */}
            <RememberButton content={message.content} />
          </div>
        )}
      </div>
    </div>
  );
}
