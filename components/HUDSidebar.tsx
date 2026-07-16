import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface HUDSidebarItem {
  id: string;
  label: string;
  icon: string;
  badge?: number;
  action: () => void;
}

interface HUDPanelProps {
  title: string;
  children: React.ReactNode;
  scale?: number;
}

// ─── Scale helper: returns font sizes proportional to sidebar width ───────────
// base width = 160px → scale = 1.0; 320px → scale = 2.0; 140px → scale = 0.875
function useScale(width: number) {
  return Math.max(0.75, Math.min(2.0, width / 160));
}

// ─── HUD Panel (corner-bracket box) ──────────────────────────────────────────
function HUDPanel({ title, children, scale = 1 }: HUDPanelProps) {
  const fs = (base: number) => `${Math.round(base * scale)}px`;
  return (
    <div style={{ marginBottom: `${Math.round(10 * scale)}px`, position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 8, height: 8, borderTop: "1px solid rgba(0,200,255,0.5)", borderLeft: "1px solid rgba(0,200,255,0.5)" }} />
      <div style={{ position: "absolute", bottom: 0, right: 0, width: 8, height: 8, borderBottom: "1px solid rgba(0,200,255,0.5)", borderRight: "1px solid rgba(0,200,255,0.5)" }} />
      <div style={{ padding: `${Math.round(6 * scale)}px ${Math.round(8 * scale)}px ${Math.round(8 * scale)}px` }}>
        <div style={{
          fontSize: fs(8), letterSpacing: "0.15em", color: "rgba(0,200,255,0.5)",
          fontFamily: "monospace", marginBottom: `${Math.round(6 * scale)}px`,
          display: "flex", alignItems: "center", gap: "5px",
        }}>
          <span style={{ color: "rgba(0,200,255,0.4)" }}>◆</span>
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Status Row ───────────────────────────────────────────────────────────────
function StatusRow({ label, value, color, scale = 1 }: { label: string; value: string; color?: string; scale?: number }) {
  const fs = `${Math.round(8 * scale)}px`;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: `${Math.round(3 * scale)}px` }}>
      <span style={{ fontSize: fs, color: "rgba(0,200,255,0.4)", fontFamily: "monospace", letterSpacing: "0.08em" }}>{label}</span>
      <span style={{ fontSize: fs, fontFamily: "monospace", letterSpacing: "0.08em", color: color ?? "rgba(0,200,255,0.85)", fontWeight: "bold" }}>{value}</span>
    </div>
  );
}

// ─── Circular Gauge ───────────────────────────────────────────────────────────
function CircularGauge({ value, label, color, scale = 1 }: { value: number; label: string; color: string; scale?: number }) {
  const size = Math.round(40 * scale);
  const r = Math.round(16 * scale);
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  const cx = size / 2;
  const cy = size / 2;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: `${Math.round(3 * scale)}px` }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,200,255,0.1)" strokeWidth={Math.round(3 * scale)} />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth={Math.round(3 * scale)}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
        <text x={cx} y={cy + Math.round(4 * scale)} textAnchor="middle" fill={color} fontSize={Math.round(9 * scale)} fontFamily="monospace" fontWeight="bold">{value}</text>
      </svg>
      <span style={{ fontSize: `${Math.round(7 * scale)}px`, color: "rgba(0,200,255,0.4)", fontFamily: "monospace", letterSpacing: "0.1em" }}>{label}</span>
    </div>
  );
}

// ─── Waveform Monitor ─────────────────────────────────────────────────────────
function WaveformMonitor({ active, scale = 1 }: { active: boolean; scale?: number }) {
  const [bars, setBars] = useState(() => Array(20).fill(0).map(() => Math.random() * 0.3));
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setBars(Array(20).fill(0).map(() => Math.random()));
    }, 120);
    return () => clearInterval(id);
  }, [active]);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "1px", height: `${Math.round(24 * scale)}px`, marginBottom: `${Math.round(6 * scale)}px` }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          flex: 1, backgroundColor: `rgba(0,200,255,${0.2 + h * 0.7})`,
          height: `${Math.max(10, h * 100)}%`,
          transition: "height 0.1s ease",
        }} />
      ))}
    </div>
  );
}

// ─── App Tab Button ───────────────────────────────────────────────────────────
function AppTabButton({ item, scale = 1 }: { item: HUDSidebarItem; scale?: number }) {
  const [hovered, setHovered] = useState(false);
  const fs = `${Math.round(8 * scale)}px`;
  const iconFs = `${Math.round(10 * scale)}px`;
  const pad = `${Math.round(3 * scale)}px ${Math.round(4 * scale)}px`;
  return (
    <button
      onClick={item.action}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        width: "100%", padding: pad, marginBottom: `${Math.round(2 * scale)}px`,
        background: hovered ? "rgba(0,200,255,0.08)" : "transparent",
        border: hovered ? "1px solid rgba(0,200,255,0.15)" : "1px solid transparent",
        cursor: "pointer",
        transition: "background 0.15s ease, border 0.15s ease",
        position: "relative",
        borderRadius: "1px",
      }}
    >
      <span style={{ fontSize: iconFs, marginRight: `${Math.round(4 * scale)}px` }}>{item.icon}</span>
      <span style={{ fontSize: fs, color: "rgba(0,200,255,0.7)", fontFamily: "monospace", letterSpacing: "0.08em", flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {item.label.toUpperCase()}
      </span>
      <span style={{ fontSize: `${Math.round(7 * scale)}px`, fontFamily: "monospace", flexShrink: 0, marginLeft: "2px" }}>
        {item.badge ? (
          <span style={{ color: "#ff4444", fontWeight: "bold" }}>{item.badge > 9 ? "9+" : item.badge}</span>
        ) : <span style={{ color: "#00ff88" }}>●</span>}
      </span>
    </button>
  );
}

// ─── Drag Resize Handle ───────────────────────────────────────────────────────
function ResizeHandle({ onDrag, side }: { onDrag: (dx: number) => void; side: "left" | "right" }) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    lastX.current = e.clientX;
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onDrag(side === "left" ? dx : -dx);
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onDrag, side]);

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: "absolute",
        top: 0,
        [side === "left" ? "right" : "left"]: 0,
        width: "6px",
        height: "100%",
        cursor: "col-resize",
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
      }}
      title="Drag to resize"
    >
      {/* Subtle drag indicator */}
      <div style={{
        width: "2px",
        height: "40px",
        background: "rgba(0,200,255,0.2)",
        borderRadius: "1px",
        transition: "background 0.15s",
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(0,200,255,0.5)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(0,200,255,0.2)"; }}
      />
    </div>
  );
}

// ─── Left Sidebar ─────────────────────────────────────────────────────────────
// Contains: APPLICATIONS (first 7 items) + TOOLS (items 7+)
export function HUDLeftSidebar({
  items,
  width,
  onWidthChange,
}: {
  items: HUDSidebarItem[];
  width: number;
  onWidthChange: (w: number) => void;
}) {
  const scale = useScale(width);
  const appItems = items.slice(0, 7);
  const toolItems = items.slice(7);

  const handleDrag = (dx: number) => {
    onWidthChange(Math.max(140, Math.min(320, width + dx)));
  };

  return (
    <div style={{
      width: `${width}px`, minWidth: `${width}px`, height: "100%",
      borderRight: "1px solid rgba(0,200,255,0.12)",
      overflowY: "auto", overflowX: "hidden",
      padding: `${Math.round(8 * scale)}px ${Math.round(6 * scale)}px`,
      scrollbarWidth: "none",
      position: "relative",
      flexShrink: 0,
    }}>
      <ResizeHandle onDrag={handleDrag} side="left" />

      <HUDPanel title="APPLICATIONS" scale={scale}>
        {appItems.map(item => <AppTabButton key={item.id} item={item} scale={scale} />)}
      </HUDPanel>

      <HUDPanel title="TOOLS" scale={scale}>
        {toolItems.map(item => <AppTabButton key={item.id} item={item} scale={scale} />)}
      </HUDPanel>
    </div>
  );
}

// ─── Right Sidebar ────────────────────────────────────────────────────────────
// Contains: SYSTEM STATUS + SESSION INFO + SYSTEM METRICS + DIAGNOSTICS + CAPABILITIES + AUDIO MONITOR + SECURITY
export function HUDRightSidebar({
  items: _items,
  voiceActive,
  calendarConnected,
  lastScanSeconds,
  messageCount,
  uptimeSeconds,
  width,
  onWidthChange,
  metrics,
}: {
  items: HUDSidebarItem[];
  voiceActive: boolean;
  calendarConnected: boolean;
  lastScanSeconds: number;
  messageCount: number;
  uptimeSeconds: number;
  width: number;
  onWidthChange: (w: number) => void;
  metrics?: { cpu: number; mem: number; net: number };
}) {
  const scale = useScale(width);

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  const formatScan = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `00:${m}:${sec}`;
  };

  const cpu = metrics?.cpu ?? 72;
  const mem = metrics?.mem ?? 45;
  const net = metrics?.net ?? 88;

  const handleDrag = (dx: number) => {
    onWidthChange(Math.max(140, Math.min(320, width + dx)));
  };

  return (
    <div style={{
      width: `${width}px`, minWidth: `${width}px`, height: "100%",
      borderLeft: "1px solid rgba(0,200,255,0.12)",
      overflowY: "auto", overflowX: "hidden",
      padding: `${Math.round(8 * scale)}px ${Math.round(6 * scale)}px`,
      scrollbarWidth: "none",
      position: "relative",
      flexShrink: 0,
    }}>
      <ResizeHandle onDrag={handleDrag} side="right" />

      <HUDPanel title="SYSTEM STATUS" scale={scale}>
        <StatusRow label="NEURAL NET" value="ONLINE" color="#00ff88" scale={scale} />
        <StatusRow label="STATE" value={voiceActive ? "ACTIVE" : "IDLE"} color={voiceActive ? "#00ff88" : "rgba(0,200,255,0.5)"} scale={scale} />
        <StatusRow label="UPTIME" value={formatUptime(uptimeSeconds)} scale={scale} />
        <StatusRow label="MEMORY" value="NOMINAL" color="#00ff88" scale={scale} />
        <StatusRow label="CORE TEMP" value="36.2°C" scale={scale} />
      </HUDPanel>

      <HUDPanel title="SESSION INFO" scale={scale}>
        <StatusRow label="MESSAGES" value={messageCount.toString()} scale={scale} />
        <StatusRow label="PROTOCOL" value="SECURE" color="#00ff88" scale={scale} />
        <StatusRow label="ENCRYPTION" value="AES-256" scale={scale} />
        <StatusRow label="LATENCY" value="12ms" scale={scale} />
      </HUDPanel>

      <HUDPanel title="SYSTEM METRICS" scale={scale}>
        <div style={{ display: "flex", justifyContent: "space-around", padding: `${Math.round(4 * scale)}px 0` }}>
          <CircularGauge value={cpu} label="CPU" color="#00ff88" scale={scale} />
          <CircularGauge value={mem} label="MEM" color="#00ccee" scale={scale} />
          <CircularGauge value={net} label="NET" color="#00ff88" scale={scale} />
        </div>
      </HUDPanel>

      <HUDPanel title="DIAGNOSTICS" scale={scale}>
        <StatusRow label="VOICE ENGINE" value="ACTIVE" color="#00ff88" scale={scale} />
        <StatusRow label="STT ENGINE" value="WHISPER" scale={scale} />
        <StatusRow label="WAKE DETECT" value="OFF" color="rgba(0,200,255,0.4)" scale={scale} />
        <StatusRow label="AUDIO INPUT" value="ENABLED" color="#00ff88" scale={scale} />
        <StatusRow label="TTS OUTPUT" value="ENABLED" color="#00ff88" scale={scale} />
      </HUDPanel>

      <HUDPanel title="CAPABILITIES" scale={scale}>
        <StatusRow label="WEATHER API" value="● READY" color="#00ff88" scale={scale} />
        <StatusRow label="WEB SEARCH" value="● USED" color="#00ccee" scale={scale} />
        <StatusRow label="CALENDAR" value={calendarConnected ? "● READY" : "○ OFF"} color={calendarConnected ? "#00ff88" : "rgba(0,200,255,0.4)"} scale={scale} />
        <StatusRow label="CLOCK" value="● READY" color="#00ff88" scale={scale} />
      </HUDPanel>

      <HUDPanel title="AUDIO MONITOR" scale={scale}>
        <WaveformMonitor active={voiceActive} scale={scale} />
        <StatusRow label="SAMPLE RATE" value="44.1 kHz" scale={scale} />
        <StatusRow label="BIT DEPTH" value="16-bit" scale={scale} />
        <StatusRow label="CHANNELS" value="MONO" scale={scale} />
      </HUDPanel>

      <HUDPanel title="SECURITY" scale={scale}>
        <StatusRow label="CLEARANCE" value="LEVEL 5" color="#00ff88" scale={scale} />
        <StatusRow label="FIREWALL" value="ACTIVE" color="#00ff88" scale={scale} />
        <StatusRow label="INTRUSION" value="NONE" scale={scale} />
        <StatusRow label="LAST SCAN" value={formatScan(lastScanSeconds)} scale={scale} />
      </HUDPanel>
    </div>
  );
}
