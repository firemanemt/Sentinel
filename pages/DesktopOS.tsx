/**
 * DesktopOS — SENTINEL HUD Interface
 *
 * Layout matches the reference design:
 * ┌─────────────────────────────────────────────────────────────┐
 * │  SENTINEL ◆ STANDBY        OPERATOR · time    date time │
 * ├──────────┬──────────────────────────────────┬───────────────┤
 * │ LEFT     │                                  │ RIGHT         │
 * │ SIDEBAR  │   CENTER: arc reactor + chat     │ SIDEBAR       │
 * │ 160px    │                                  │ 160px         │
 * ├──────────┴──────────────────────────────────┴───────────────┤
 * │  ◆ ticker scrolling status text                             │
 * ├─────────────────────────────────────────────────────────────┤
 * │  [⊞]  [🎤]  ENTER COMMAND...                    [⚙] [⏻]   │
 * └─────────────────────────────────────────────────────────────┘
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useWindow } from "@/contexts/WindowContext";
import { DesktopWindow } from "@/components/DesktopWindow";
import { SearchCommandPalette } from "@/components/SearchCommandPalette";
import { NotificationCenter, useNotifications } from "@/components/NotificationCenter";
import { KeyboardHelp } from "@/components/KeyboardHelp";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { WINDOW_REGISTRY, resolveWindowComponent } from "@/lib/windowRegistry";
import { HUDLeftSidebar, HUDRightSidebar, type HUDSidebarItem } from "@/components/HUDSidebar";
import ArcReactor from "@/components/ArcReactor";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSentinel } from "@/hooks/useJarvis";

const resolveComponent = resolveWindowComponent;

// ─── Ticker text ──────────────────────────────────────────────────────────────
const TICKER_ITEMS = [
  "◆ NEURAL NET ACTIVE",
  "◆ ENVIRONMENTAL SENSORS NOMINAL",
  "◆ RUNTIME: CORE AI OPERATIONAL",
  "◆ LIVE QUANTUM ENCRYPTION ACTIVE",
  "◆ NEURAL NETWORK ONLINE",
  "◆ ALL SYSTEMS NOMINAL",
  "◆ VOICE SYNTHESIS READY",
  "◆ GEOLOCATION SERVICES ACTIVE",
  "◆ WEATHER MONITORING ENABLED",
  "◆ CALENDAR SYNC RUNNING",
];

// ─── HUD Chat Message (center panel) ─────────────────────────────────────────
interface HUDMessage {
  id: string;
  role: "user" | "assistant" | "sentinel";
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
}

function HUDMessageBubble({ msg }: { msg: HUDMessage }) {
  const time = msg.timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const isSentinel = msg.role === "assistant" || msg.role === "sentinel";

  if (isSentinel) {
    return (
      <div style={{ marginBottom: "12px", maxWidth: "70%" }}>
        <div style={{ fontSize: "9px", color: "rgba(0,200,255,0.5)", fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: "4px" }}>
          SENTINEL · {time}
        </div>
        <div style={{ position: "relative", padding: "10px 12px" }}>
          {/* Corner brackets */}
          <div style={{ position: "absolute", top: 0, left: 0, width: 10, height: 10, borderTop: "1px solid rgba(0,200,255,0.6)", borderLeft: "1px solid rgba(0,200,255,0.6)" }} />
          <div style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderBottom: "1px solid rgba(0,200,255,0.6)", borderRight: "1px solid rgba(0,200,255,0.6)" }} />
          <div style={{ position: "absolute", inset: 0, border: "1px solid rgba(0,200,255,0.12)", background: "rgba(0,200,255,0.03)" }} />
          <p style={{ margin: 0, fontSize: "11px", color: "rgba(220,240,255,0.9)", fontFamily: "monospace", lineHeight: 1.6, position: "relative", zIndex: 1 }}>
            {msg.content}
          </p>
          {msg.toolsUsed && msg.toolsUsed.length > 0 && (
            <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "4px", position: "relative", zIndex: 1 }}>
              {msg.toolsUsed.filter(t => !t.startsWith("open_window:")).map((tool, i) => (
                <span key={i} style={{
                  fontSize: "7px", padding: "2px 6px",
                  border: "1px solid rgba(0,200,255,0.3)",
                  color: "rgba(0,200,255,0.7)", fontFamily: "monospace",
                  letterSpacing: "0.1em", background: "rgba(0,200,255,0.05)",
                }}>
                  ◆ {tool.replace(/_/g, " ").toUpperCase()}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: "12px", display: "flex", justifyContent: "flex-end" }}>
      <div style={{ maxWidth: "70%" }}>
        <div style={{ fontSize: "9px", color: "rgba(0,200,255,0.4)", fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: "4px", textAlign: "right" }}>
          OPERATOR · {time}
        </div>
        <p style={{ margin: 0, fontSize: "11px", color: "rgba(200,220,255,0.7)", fontFamily: "monospace", lineHeight: 1.6, textAlign: "right" }}>
          {msg.content}
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function DesktopOS() {
  const [, navigate] = useLocation();
  const { windows, openWindow, closeWindow, minimizeWindow } = useWindow();
  const { notifications, addNotification, removeNotification, clearAll } = useNotifications();
  const { user, loading, isAuthenticated } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/login");
    }
  }, [loading, isAuthenticated, navigate]);

  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [focusedWindowId, setFocusedWindowId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth >= 768 && window.innerWidth < 1100);

  // ── SENTINEL Brain (full hook) ────────────────────────────────────────────────
  const sentinel = useSentinel();
  const sentinelState = sentinel.state;
  const hudMessages = sentinel.messages;

  // HUD state
  const [commandInput, setCommandInput] = useState("");
  const [uptimeSeconds, setUptimeSeconds] = useState(0);
  const [lastScanSeconds, setLastScanSeconds] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [tickerOffset, setTickerOffset] = useState(0);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevWindowCount = useRef(0);

  // Resizable sidebars (PC/tablet) — initialized from localStorage
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [leftWidth, setLeftWidth] = useState(() => {
    if (typeof window === "undefined") return 160;
    return parseInt(localStorage.getItem("hud-left-width") ?? "160", 10);
  });
  const [rightWidth, setRightWidth] = useState(() => {
    if (typeof window === "undefined") return 160;
    return parseInt(localStorage.getItem("hud-right-width") ?? "160", 10);
  });
  const handleLeftWidth = (w: number) => { setLeftWidth(w); localStorage.setItem("hud-left-width", String(w)); };
  const handleRightWidth = (w: number) => { setRightWidth(w); localStorage.setItem("hud-right-width", String(w)); };

  // System metrics (real CPU/MEM/NET from server)
  const { data: systemMetrics } = trpc.system.getMetrics.useQuery(undefined, { refetchInterval: 3000 });

  // Data queries
  const { data: githubConnected } = trpc.github.status.useQuery(undefined, { refetchInterval: 60_000 });
  const { data: githubNotifs } = trpc.github.notifications.useQuery(
    { all: false },
    { enabled: !!githubConnected?.connected, refetchInterval: 60_000 }
  );
  const githubBadge = githubNotifs?.length ?? 0;

  // open_window bridge — fires whenever lastToolsUsed changes
  useEffect(() => {
    for (const t of sentinel.lastToolsUsed) {
      if (t.startsWith("open_window:")) {
        const rest = t.slice("open_window:".length);
        const colonIdx = rest.indexOf(":");
        const windowType = colonIdx === -1 ? rest : rest.slice(0, colonIdx);
        const dataStr = colonIdx === -1 ? undefined : rest.slice(colonIdx + 1);
        let routeData: Record<string, unknown> | undefined;
        if (dataStr) { try { routeData = JSON.parse(dataStr) as Record<string, unknown>; } catch { /* ignore */ } }
        if (windowType) window.dispatchEvent(new CustomEvent("sentinel:open-window", { detail: { windowType, routeData } }));
      }
    }
  }, [sentinel.lastToolsUsed]);

  // Clocks
  useEffect(() => {
    const id = setInterval(() => {
      setCurrentTime(new Date());
      setUptimeSeconds(s => s + 1);
      setLastScanSeconds(s => (s + 1) % 3600);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Ticker animation
  useEffect(() => {
    const id = setInterval(() => setTickerOffset(o => o + 0.5), 30);
    return () => clearInterval(id);
  }, []);

  // Responsive
  useEffect(() => {
    const handler = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1100);
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [hudMessages]);

  // Window open notification
  useEffect(() => {
    const count = windows.length;
    if (count > prevWindowCount.current && count > 0) {
      const newest = windows[windows.length - 1];
      if (newest) addNotification({ title: `${newest.icon ?? ""} ${newest.title} opened`, message: "Window is ready.", type: "info" });
    }
    prevWindowCount.current = count;
  }, [windows.length]);

  // Welcome message injected via useSentinel on first load — no duplicate needed

  useKeyboardShortcuts([
    { key: "h", ctrl: true, callback: () => setShowKeyboardHelp(prev => !prev) },
    { key: "w", ctrl: true, callback: () => { if (focusedWindowId) closeWindow(focusedWindowId); } },
    { key: "m", ctrl: true, callback: () => { if (focusedWindowId) minimizeWindow(focusedWindowId); } },
    { key: "k", ctrl: true, callback: () => inputRef.current?.focus() },
  ]);

  const openAndFocus = useCallback(
    (win: Omit<typeof windows[0], "zIndex">) => {
      openWindow(win);
      if (isMobile) setTimeout(() => setFocusedWindowId(win.id), 0);
    },
    [openWindow, isMobile]
  );

  // sentinel:open-window bridge
  useEffect(() => {
    const handler = (e: Event) => {
      const { windowType, routeData } = (e as CustomEvent<{ windowType: string; routeData?: Record<string, unknown> }>).detail;
      if (!windowType) return;
      const component = resolveComponent(windowType);
      const iconMap: Record<string, string> = {
        maps: "🗺", weather: "🌦", calendar: "📅", notes: "📝", files: "📁",
        spotify: "🎵", github: "🐙", discord: "💬", slack: "💼",
        "home-assistant": "🏡", integrations: "🔌", settings: "⚙", chat: "💬",
        stocks: "📈", tasks: "✅", news: "📰",
      };
      const titleMap: Record<string, string> = {
        maps: "Maps", weather: "Weather", calendar: "Calendar", notes: "Notes",
        files: "Files", spotify: "Spotify", github: "GitHub", discord: "Discord",
        slack: "Slack", "home-assistant": "Home Assistant", integrations: "Integrations",
        settings: "Settings", chat: "SENTINEL", stocks: "Stocks", tasks: "Tasks", news: "News",
      };
      openAndFocus({
        id: `${windowType}-${Date.now()}`,
        title: titleMap[windowType] ?? windowType,
        icon: iconMap[windowType] ?? "🪟",
        windowType,
        component,
        data: routeData,
        position: { x: 180 + Math.random() * 80, y: 60 + Math.random() * 60 },
        size: { width: 680, height: 560 },
        isMinimized: false,
        isMaximized: false,
      });
    };
    window.addEventListener("sentinel:open-window", handler);
    return () => window.removeEventListener("sentinel:open-window", handler);
  }, [openAndFocus]);

  const sendCommand = () => {
    const text = commandInput.trim();
    if (!text) return;
    setCommandInput("");
    void sentinel.sendMessage(text);
  };

  // ─── Sidebar items ──────────────────────────────────────────────────────────
  const makeOpener = (id: string, title: string, icon: string, windowType: string, size = { width: 680, height: 560 }) => ({
    id, label: title, icon,
    action: () => openAndFocus({
      id: `${windowType}-${Date.now()}`, title, icon, windowType,
      component: WINDOW_REGISTRY[windowType as keyof typeof WINDOW_REGISTRY] ?? WINDOW_REGISTRY.chat,
      position: { x: 180 + Math.random() * 80, y: 60 + Math.random() * 60 },
      size, isMinimized: false, isMaximized: false,
    }),
  });

  // Left sidebar: first 7 items (Applications)
  // Right sidebar: items 7+ (Tools)
  const sidebarItems: HUDSidebarItem[] = [
    // ── LEFT: Applications (7) ──────────────────────────────────────────────
    makeOpener("weather", "Weather", "🌦", "weather", { width: 420, height: 560 }),
    makeOpener("maps", "Maps", "🗺", "maps", { width: 720, height: 600 }),
    makeOpener("calendar", "Calendar", "📅", "calendar", { width: 620, height: 520 }),
    makeOpener("spotify", "Spotify", "🎵", "spotify", { width: 400, height: 580 }),
    makeOpener("news", "News", "📰", "news", { width: 600, height: 520 }),
    makeOpener("notes", "Notes", "📝", "notes", { width: 520, height: 440 }),
    makeOpener("tasks", "Tasks", "✅", "tasks", { width: 520, height: 440 }),
    // ── RIGHT: Tools (7) ────────────────────────────────────────────────────
    makeOpener("stocks", "Stocks", "📈", "stocks", { width: 600, height: 520 }),
    { id: "github", label: "GitHub", icon: "🐙", badge: githubBadge > 0 ? githubBadge : undefined, action: () => openAndFocus({ id: `github-${Date.now()}`, title: "GitHub", icon: "🐙", windowType: "github", component: WINDOW_REGISTRY.github, position: { x: 180, y: 60 }, size: { width: 620, height: 560 }, isMinimized: false, isMaximized: false }) },
    makeOpener("discord", "Discord", "💬", "discord", { width: 560, height: 520 }),
    makeOpener("home-assistant", "Home", "🏡", "home-assistant", { width: 560, height: 550 }),
    makeOpener("integrations", "Integrations", "🔌", "integrations", { width: 620, height: 520 }),
    makeOpener("settings", "Settings", "⚙", "settings", { width: 620, height: 520 }),
    makeOpener("files", "Files", "📁", "files", { width: 560, height: 480 }),
    { id: "command-center", label: "Command Center", icon: "🌐", action: () => { window.open('/command-center', '_blank'); } },
  ];

  // ─── Ticker text ────────────────────────────────────────────────────────────
  const tickerText = TICKER_ITEMS.join("   ");
  const tickerRepeat = tickerText + "   " + tickerText;

  // ─── Time formatting ────────────────────────────────────────────────────────
  const timeStr = currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const dateStr = currentTime.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();

  // ─── Mobile focused window ──────────────────────────────────────────────────
  if (isMobile && focusedWindowId) {
    const focusedWindow = windows.find(w => w.id === focusedWindowId);
    if (focusedWindow) {
      const WindowContent = resolveComponent(focusedWindow.windowType);
      return (
        <>
          <SearchCommandPalette />
          <NotificationCenter notifications={notifications} onRemove={removeNotification} onClearAll={clearAll} />
          <div style={{ width: "100%", height: "100vh", background: "#000", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(0,200,255,0.15)", background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
              <button onClick={() => setFocusedWindowId(null)} style={{ padding: "5px 10px", background: "rgba(0,200,255,0.1)", border: "1px solid rgba(0,200,255,0.3)", color: "#00ccee", cursor: "pointer", fontSize: "11px", fontFamily: "monospace", letterSpacing: "0.1em" }}>← BACK</button>
              <span style={{ color: "#00ccee", fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.1em", flex: 1 }}>{focusedWindow.icon} {focusedWindow.title.toUpperCase()}</span>
              <button onClick={() => { minimizeWindow(focusedWindow.id); setFocusedWindowId(null); }} style={{ padding: "4px 8px", background: "rgba(255,150,0,0.1)", border: "1px solid rgba(255,150,0,0.3)", color: "#ffaa00", cursor: "pointer", fontSize: "12px" }}>−</button>
              <button onClick={() => { closeWindow(focusedWindow.id); setFocusedWindowId(null); }} style={{ padding: "4px 8px", background: "rgba(255,50,50,0.1)", border: "1px solid rgba(255,50,50,0.3)", color: "#ff4444", cursor: "pointer", fontSize: "12px" }}>✕</button>
            </div>
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
              <WindowContent data={focusedWindow.data} />
            </div>
          </div>
        </>
      );
    }
  }

  // ─── Mobile grid ────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <SearchCommandPalette />
        <NotificationCenter notifications={notifications} onRemove={removeNotification} onClearAll={clearAll} />
        <div style={{ width: "100%", height: "100vh", background: "#000", display: "flex", flexDirection: "column", fontFamily: "monospace", position: "relative" }}>

          {/* Mobile app drawer overlay */}
          {mobileDrawerOpen && (
            <div
              onClick={() => setMobileDrawerOpen(false)}
              style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.7)" }}
            >
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  background: "#000d14",
                  border: "1px solid rgba(0,200,255,0.25)",
                  borderBottom: "none",
                  padding: "12px 8px 20px",
                  maxHeight: "70vh",
                  overflowY: "auto",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", padding: "0 4px" }}>
                  <span style={{ color: "rgba(0,200,255,0.6)", fontSize: "9px", letterSpacing: "0.3em", fontFamily: "monospace" }}>◆ APPLICATIONS</span>
                  <button onClick={() => setMobileDrawerOpen(false)} style={{ background: "none", border: "none", color: "rgba(0,200,255,0.5)", cursor: "pointer", fontSize: "16px", lineHeight: 1 }}>✕</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
                  {sidebarItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => { item.action(); setMobileDrawerOpen(false); }}
                      style={{
                        padding: "10px 4px",
                        background: "rgba(0,200,255,0.05)",
                        border: "1px solid rgba(0,200,255,0.15)",
                        color: "#00ccee",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "4px",
                        position: "relative",
                      }}
                    >
                      <span style={{ fontSize: "20px" }}>{item.icon}</span>
                      <span style={{ fontSize: "8px", fontFamily: "monospace", letterSpacing: "0.05em", textAlign: "center" }}>{item.label.toUpperCase()}</span>
                      {item.badge ? <span style={{ position: "absolute", top: 2, right: 2, background: "#ff4444", color: "#fff", borderRadius: "50%", width: 14, height: 14, fontSize: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>{item.badge > 9 ? "9+" : item.badge}</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Mobile top bar */}
          <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(0,200,255,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <span style={{ color: "#00ccee", fontSize: "10px", letterSpacing: "0.2em" }}>SENTINEL ◆ {sentinelState.toUpperCase()}</span>
            <span style={{ color: "rgba(0,200,255,0.5)", fontSize: "9px" }}>{timeStr}</span>
          </div>

          {/* Mobile chat area */}
          <div ref={chatScrollRef} style={{ flex: 1, overflowY: "auto", padding: "12px", scrollbarWidth: "none" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px", opacity: 0.4 }}>
              <ArcReactor state={sentinelState} size={80} />
            </div>
            {hudMessages.map(msg => (
              <HUDMessageBubble key={msg.id} msg={msg as HUDMessage} />
            ))}
            {sentinelState === "thinking" && (
              <div style={{ fontSize: "9px", color: "rgba(0,200,255,0.5)", fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: "8px" }}>
                SENTINEL · PROCESSING<span style={{ animation: "thinking-dots 1s infinite" }}>...</span>
              </div>
            )}
            {sentinel.error && (
              <div style={{ marginBottom: "12px", padding: "8px 12px", border: "1px solid rgba(255,100,100,0.3)", background: "rgba(255,50,50,0.05)", fontSize: "10px", color: "rgba(255,150,150,0.8)", fontFamily: "monospace", letterSpacing: "0.08em" }}>
                ⚠ SYSTEM ADVISORY: {sentinel.error}
              </div>
            )}
          </div>

          {/* Mobile command bar — hamburger | input | mic | send */}
          <div style={{ padding: "8px 10px", borderTop: "1px solid rgba(0,200,255,0.15)", display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
            <button
              onClick={() => setMobileDrawerOpen(true)}
              style={{ padding: "8px", background: "rgba(0,200,255,0.08)", border: "1px solid rgba(0,200,255,0.2)", color: "#00ccee", cursor: "pointer", fontSize: "14px", flexShrink: 0 }}
              title="Apps"
            >⊞</button>
            <input
              ref={inputRef}
              value={commandInput}
              onChange={e => setCommandInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendCommand()}
              placeholder="ENTER COMMAND..."
              style={{ flex: 1, background: "transparent", border: "none", borderBottom: "1px solid rgba(0,200,255,0.3)", color: "rgba(0,200,255,0.9)", fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.08em", padding: "6px 0", outline: "none", minWidth: 0 }}
            />
            <button
              onClick={() => sentinelState === "listening" ? sentinel.stopListening() : sentinel.startListening()}
              style={{ padding: "8px", background: sentinelState === "listening" ? "rgba(0,200,255,0.2)" : "rgba(0,200,255,0.08)", border: `1px solid ${sentinelState === "listening" ? "rgba(0,200,255,0.6)" : "rgba(0,200,255,0.2)"}`, color: "#00ccee", cursor: "pointer", fontSize: "14px", flexShrink: 0 }}
              title="Voice input"
            >🎤</button>
            <button
              onClick={sendCommand}
              disabled={sentinelState === "thinking"}
              style={{ padding: "8px 12px", background: "rgba(0,200,255,0.1)", border: "1px solid rgba(0,200,255,0.3)", color: "#00ccee", cursor: "pointer", fontSize: "11px", fontFamily: "monospace", letterSpacing: "0.1em", flexShrink: 0 }}
            >SEND</button>
          </div>
        </div>
      </>
    );
  }

  // ─── Desktop / Tablet Layout ─────────────────────────────────────────────────

  return (
    <>
      <SearchCommandPalette />
      <NotificationCenter notifications={notifications} onRemove={removeNotification} onClearAll={clearAll} />
      <KeyboardHelp isOpen={showKeyboardHelp} onClose={() => setShowKeyboardHelp(false)} />

      <div style={{
        width: "100%", height: "100vh", background: "#000",
        display: "flex", flexDirection: "column", overflow: "hidden",
        fontFamily: "'Courier New', Courier, monospace",
        position: "relative",
      }}>
        {/* Scanline overlay */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 50, backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.004) 2px, rgba(0,255,255,0.004) 4px)" }} />

        {/* Corner brackets */}
        {[
          { top: 8, left: 8, borderTop: "1px solid rgba(0,200,255,0.4)", borderLeft: "1px solid rgba(0,200,255,0.4)" },
          { top: 8, right: 8, borderTop: "1px solid rgba(0,200,255,0.4)", borderRight: "1px solid rgba(0,200,255,0.4)" },
          { bottom: 8, left: 8, borderBottom: "1px solid rgba(0,200,255,0.4)", borderLeft: "1px solid rgba(0,200,255,0.4)" },
          { bottom: 8, right: 8, borderBottom: "1px solid rgba(0,200,255,0.4)", borderRight: "1px solid rgba(0,200,255,0.4)" },
        ].map((s, i) => (
          <div key={i} style={{ position: "absolute", width: 16, height: 16, pointerEvents: "none", zIndex: 51, ...s }} />
        ))}

        {/* ── TOP BAR ── */}
        <div style={{
          height: "28px", flexShrink: 0,
          borderBottom: "1px solid rgba(0,200,255,0.12)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 12px",
        }}>
          <span style={{ fontSize: "9px", color: "#00ccee", letterSpacing: "0.2em" }}>
            SENTINEL ◆ {sentinelState.toUpperCase()}
          </span>
          <span style={{ fontSize: "9px", color: "rgba(0,200,255,0.5)", letterSpacing: "0.15em" }}>
            OPERATOR · {timeStr}
          </span>
          <span style={{ fontSize: "9px", color: "rgba(0,200,255,0.4)", letterSpacing: "0.12em" }}>
            {dateStr}  {timeStr}
          </span>
        </div>

        {/* ── MAIN BODY: left sidebar | center | right sidebar ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

          {/* LEFT SIDEBAR */}
          <HUDLeftSidebar
            items={sidebarItems}
            width={leftWidth}
            onWidthChange={handleLeftWidth}
          />

          {/* CENTER */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
            {/* Arc reactor background */}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 0 }}>
              <div style={{ opacity: 0.18 }}>
                <ArcReactor state={sentinelState} size={Math.min(window.innerWidth - leftWidth - rightWidth - 40, 340)} />
              </div>
            </div>

            {/* Chat messages */}
            <div
              ref={chatScrollRef}
              style={{
                flex: 1, overflowY: "auto", padding: "16px 20px",
                scrollbarWidth: "none", position: "relative", zIndex: 1,
              }}
            >
              {hudMessages.map(msg => (
                <HUDMessageBubble
                  key={msg.id}
                  msg={msg as HUDMessage}
                />
              ))}
              {sentinelState === "thinking" && (
                <div style={{ fontSize: "9px", color: "rgba(0,200,255,0.5)", letterSpacing: "0.1em", marginBottom: "8px" }}>
                  SENTINEL · PROCESSING<span style={{ animation: "thinking-dots 1s infinite" }}>...</span>
                </div>
              )}
              {sentinel.error && (
                <div style={{ marginBottom: "12px", padding: "8px 12px", border: "1px solid rgba(255,100,100,0.3)", background: "rgba(255,50,50,0.05)", fontSize: "10px", color: "rgba(255,150,150,0.8)", fontFamily: "monospace", letterSpacing: "0.08em" }}>
                  ⚠ SYSTEM ADVISORY: {sentinel.error}
                </div>
              )}
            </div>

            {/* Floating windows render on top of center */}
            {windows.map(win => (
              <DesktopWindow key={win.id} window={win} />
            ))}
          </div>

          {/* RIGHT SIDEBAR */}
          <HUDRightSidebar
            items={sidebarItems}
            voiceActive={sentinelState !== "idle"}
            calendarConnected={false}
            lastScanSeconds={lastScanSeconds}
            messageCount={hudMessages.length}
            uptimeSeconds={uptimeSeconds}
            width={rightWidth}
            onWidthChange={handleRightWidth}
            metrics={systemMetrics}
          />
        </div>

        {/* ── TICKER ── */}
        <div style={{
          height: "20px", flexShrink: 0,
          borderTop: "1px solid rgba(0,200,255,0.08)",
          borderBottom: "1px solid rgba(0,200,255,0.08)",
          overflow: "hidden", position: "relative",
        }}>
          <div style={{
            position: "absolute", top: 0, left: 0, height: "100%",
            display: "flex", alignItems: "center",
            transform: `translateX(-${tickerOffset % (tickerText.length * 6.5)}px)`,
            whiteSpace: "nowrap",
          }}>
            <span style={{ fontSize: "8px", color: "rgba(0,200,255,0.35)", letterSpacing: "0.15em" }}>
              {tickerRepeat}
            </span>
          </div>
        </div>

        {/* ── BOTTOM COMMAND BAR ── */}
        <div style={{
          height: "44px", flexShrink: 0,
          borderTop: "1px solid rgba(0,200,255,0.15)",
          display: "flex", alignItems: "center", gap: "8px",
          padding: "0 10px",
        }}>
          {/* Grid / windows button */}
          <button
            onClick={() => {/* toggle window overview */}}
            style={{ width: 28, height: 28, background: "rgba(0,200,255,0.06)", border: "1px solid rgba(0,200,255,0.2)", color: "#00ccee", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: 0 }}
            title="Windows"
          >
            ⊞
          </button>

          {/* Mic button */}
          <button
            onClick={() => sentinelState === "listening" ? sentinel.stopListening() : sentinel.startListening()}
            style={{ width: 28, height: 28, background: sentinelState === "listening" ? "rgba(0,255,136,0.15)" : "rgba(0,200,255,0.06)", border: `1px solid ${sentinelState === "listening" ? "rgba(0,255,136,0.4)" : "rgba(0,200,255,0.2)"}`, color: sentinelState === "listening" ? "#00ff88" : "#00ccee", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", flexShrink: 0 }}
            title="Voice Input"
          >
            🎤
          </button>

          {/* Command input */}
          <input
            ref={inputRef}
            value={commandInput}
            onChange={e => setCommandInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendCommand()}
            placeholder="ENTER COMMAND..."
            style={{
              flex: 1, background: "transparent",
              border: "none", borderBottom: "1px solid rgba(0,200,255,0.2)",
              color: "rgba(0,200,255,0.9)", fontFamily: "monospace",
              fontSize: "11px", letterSpacing: "0.1em",
              padding: "4px 0", outline: "none",
            }}
          />

          {/* Settings button */}
          <button
            onClick={() => openAndFocus({ id: `settings-${Date.now()}`, title: "Settings", icon: "⚙", windowType: "settings", component: WINDOW_REGISTRY.settings, position: { x: 200, y: 80 }, size: { width: 620, height: 520 }, isMinimized: false, isMaximized: false })}
            style={{ width: 28, height: 28, background: "rgba(0,200,255,0.06)", border: "1px solid rgba(0,200,255,0.2)", color: "rgba(0,200,255,0.6)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", flexShrink: 0 }}
            title="Settings"
          >
            ⚙
          </button>

          {/* Power / close */}
          <button
            style={{ width: 28, height: 28, background: "rgba(255,50,50,0.06)", border: "1px solid rgba(255,50,50,0.2)", color: "rgba(255,50,50,0.6)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", flexShrink: 0 }}
            title="Shutdown"
          >
            ⏻
          </button>
        </div>
      </div>
    </>
  );
}
