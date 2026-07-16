import React, { useState } from "react";
import { useDesktopTheme, ThemeName } from "@/contexts/DesktopThemeContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useWindow } from "@/contexts/WindowContext";
import { trpc } from "@/lib/trpc";
import { useState as _useState } from "react";  // re-export hint
import { toast } from "sonner";

const THEME_PREVIEWS: Record<ThemeName, { bg: string; accent: string; border: string; label: string }> = {
  dark: { bg: "#0a1930", accent: "#00ccee", border: "rgba(0,200,255,0.3)", label: "Dark" },
  light: { bg: "#f5f5f5", accent: "#0099cc", border: "rgba(0,150,200,0.3)", label: "Light" },
  "blue-hud": { bg: "#001a33", accent: "#00ffff", border: "rgba(0,255,255,0.4)", label: "Blue HUD" },
  minimal: { bg: "#ffffff", accent: "#333333", border: "rgba(0,0,0,0.1)", label: "Minimal" },
  glass: { bg: "rgba(255,255,255,0.1)", accent: "#ffffff", border: "rgba(255,255,255,0.2)", label: "Glass" },
  cyber: { bg: "#0a0a0a", accent: "#ff00ff", border: "rgba(255,0,255,0.3)", label: "Cyber" },
};

const WORKSPACE_ICONS: Record<string, string> = {
  work: "💼",
  school: "🎓",
  programming: "💻",
  travel: "✈️",
  gaming: "🎮",
};

export function SettingsWindow() {
  const { themeName, setTheme, themes } = useDesktopTheme();
  const { layouts, currentLayout, setCurrentLayout, saveLayout, deleteLayout } = useWorkspace();
  const { windows, closeAllWindows, openWindow } = useWindow();
  const [activeTab, setActiveTab] = useState<"appearance" | "workspace" | "morning" | "about">("appearance");
  const [newLayoutName, setNewLayoutName] = useState("");

  const accent = "var(--color-primary, #00ccee)";
  const bg = "var(--color-background, #0a1930)";
  const border = "var(--color-border, rgba(0,200,255,0.3))";
  const text = "var(--color-text, #e0e0e0)";

  const handleSaveCurrentLayout = () => {
    const name = newLayoutName.trim() || `Layout ${layouts.length + 1}`;
    const windowData = windows.map(({ component, ...rest }) => rest);
    saveLayout(name, windowData);
    setNewLayoutName("");
  };

  const handleLoadLayout = (id: string) => {
    setCurrentLayout(id);
    // Layout loading is informational; actual window restore requires re-opening windows
    // which is handled by the workspace switching UI
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 12px",
    backgroundColor: active ? "rgba(0, 200, 255, 0.15)" : "transparent",
    border: `1px solid ${active ? "rgba(0, 200, 255, 0.4)" : "transparent"}`,
    borderRadius: "6px",
    color: active ? "#00ccee" : "rgba(0, 200, 255, 0.5)",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: active ? "bold" : "normal",
    transition: "all 0.2s",
    whiteSpace: "nowrap",
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "rgba(10, 25, 47, 0.95)",
        color: text,
        fontFamily: "monospace",
        overflow: "hidden",
      }}
    >
      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          padding: "10px 12px",
          borderBottom: `1px solid ${border}`,
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <button style={tabStyle(activeTab === "appearance")} onClick={() => setActiveTab("appearance")}>
          🎨 Appearance
        </button>
        <button style={tabStyle(activeTab === "workspace")} onClick={() => setActiveTab("workspace")}>
          🗂 Workspace
        </button>
        <button style={tabStyle(activeTab === "morning")} onClick={() => setActiveTab("morning")}>
          ☀️ Morning
        </button>
        <button style={tabStyle(activeTab === "about")} onClick={() => setActiveTab("about")}>
          ℹ️ About
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
        {activeTab === "appearance" && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <h3 style={{ color: accent, fontSize: "14px", marginBottom: "12px", letterSpacing: "0.1em" }}>
                THEME
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
                  gap: "10px",
                }}
              >
                {(Object.keys(THEME_PREVIEWS) as ThemeName[]).map((name) => {
                  const preview = THEME_PREVIEWS[name];
                  const isActive = themeName === name;
                  return (
                    <button
                      key={name}
                      onClick={() => setTheme(name)}
                      aria-label={`Select ${preview.label} theme`}
                      aria-pressed={isActive}
                      style={{
                        padding: "12px 8px",
                        backgroundColor: preview.bg,
                        border: `2px solid ${isActive ? preview.accent : preview.border}`,
                        borderRadius: "8px",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.2s",
                        outline: isActive ? `2px solid ${preview.accent}` : "none",
                        outlineOffset: "2px",
                      }}
                    >
                      {/* Color swatch row */}
                      <div style={{ display: "flex", gap: "4px" }}>
                        <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: preview.accent }} />
                        <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: preview.border }} />
                      </div>
                      <span style={{ color: preview.accent, fontSize: "11px", fontWeight: "bold" }}>
                        {preview.label}
                      </span>
                      {isActive && (
                        <span style={{ color: preview.accent, fontSize: "10px" }}>✓ Active</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${border}`, paddingTop: "16px" }}>
              <h3 style={{ color: accent, fontSize: "14px", marginBottom: "8px", letterSpacing: "0.1em" }}>
                CURRENT THEME COLORS
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "8px" }}>
                {Object.entries(themes[themeName].colors).map(([key, value]) => (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "6px 8px",
                      backgroundColor: "rgba(0, 100, 150, 0.1)",
                      borderRadius: "4px",
                      border: `1px solid ${border}`,
                    }}
                  >
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "3px",
                        backgroundColor: value,
                        border: "1px solid rgba(255,255,255,0.2)",
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div style={{ fontSize: "10px", color: "rgba(0,200,255,0.5)", textTransform: "uppercase" }}>
                        {key}
                      </div>
                      <div style={{ fontSize: "11px", color: text }}>{value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "workspace" && (
          <div>
            <h3 style={{ color: accent, fontSize: "14px", marginBottom: "12px", letterSpacing: "0.1em" }}>
              LAYOUT PROFILES
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
              {layouts.map((layout) => {
                const icon = WORKSPACE_ICONS[layout.id] || "🗂";
                const isActive = currentLayout === layout.id;
                return (
                  <div
                    key={layout.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 12px",
                      backgroundColor: isActive ? "rgba(0, 200, 255, 0.1)" : "rgba(0, 100, 150, 0.05)",
                      border: `1px solid ${isActive ? "rgba(0,200,255,0.4)" : border}`,
                      borderRadius: "6px",
                    }}
                  >
                    <span style={{ fontSize: "18px" }}>{icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: isActive ? accent : text, fontWeight: isActive ? "bold" : "normal", fontSize: "13px" }}>
                        {layout.name}
                      </div>
                      <div style={{ fontSize: "11px", color: "rgba(0,200,255,0.4)" }}>
                        {layout.windows.length} window{layout.windows.length !== 1 ? "s" : ""} saved
                      </div>
                    </div>
                    <button
                      onClick={() => handleLoadLayout(layout.id)}
                      aria-label={`Load ${layout.name} layout`}
                      style={{
                        padding: "4px 10px",
                        backgroundColor: isActive ? "rgba(0, 200, 255, 0.2)" : "rgba(0, 150, 200, 0.1)",
                        border: `1px solid ${border}`,
                        borderRadius: "4px",
                        color: accent,
                        cursor: "pointer",
                        fontSize: "11px",
                      }}
                    >
                      {isActive ? "Active" : "Load"}
                    </button>
                  </div>
                );
              })}
            </div>

            <div style={{ borderTop: `1px solid ${border}`, paddingTop: "16px" }}>
              <h3 style={{ color: accent, fontSize: "14px", marginBottom: "10px", letterSpacing: "0.1em" }}>
                SAVE CURRENT LAYOUT
              </h3>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <input
                  type="text"
                  value={newLayoutName}
                  onChange={(e) => setNewLayoutName(e.target.value)}
                  placeholder="Layout name..."
                  aria-label="New layout name"
                  style={{
                  flex: "1 1 160px",
                  minWidth: 0,
                  padding: "8px 12px",
                  backgroundColor: "rgba(0, 100, 150, 0.1)",
                  border: `1px solid ${border}`,
                  borderRadius: "4px",
                  color: text,
                    fontSize: "13px",
                    outline: "none",
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveCurrentLayout()}
                />
                <button
                  onClick={handleSaveCurrentLayout}
                  aria-label="Save current layout"
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "rgba(0, 200, 255, 0.15)",
                    border: `1px solid ${border}`,
                    borderRadius: "4px",
                    color: accent,
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: "bold",
                  }}
                >
                  Save
                </button>
              </div>
              <div style={{ fontSize: "11px", color: "rgba(0,200,255,0.4)", marginTop: "6px" }}>
                {windows.length} window{windows.length !== 1 ? "s" : ""} currently open
              </div>
            </div>
          </div>
        )}

        {activeTab === "morning" && <MorningRoutineTab accent={accent} border={border} text={text} />}

        {activeTab === "about" && (
          <div>
            <div
              style={{
                textAlign: "center",
                padding: "20px",
                borderBottom: `1px solid ${border}`,
                marginBottom: "20px",
              }}
            >
              <div style={{ fontSize: "48px", marginBottom: "8px" }}>⚡</div>
              <div style={{ color: accent, fontSize: "20px", fontWeight: "bold", letterSpacing: "0.2em" }}>
                SENTINEL
              </div>
              <div style={{ color: "rgba(0,200,255,0.5)", fontSize: "12px", marginTop: "4px" }}>
                Intelligent Assistant Platform
              </div>
              <div style={{ color: "rgba(0,200,255,0.4)", fontSize: "11px", marginTop: "8px" }}>
                Version 1.0 — Sentinel AI
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[
                { label: "AI Engine", value: "Manus Forge LLM" },
                { label: "Voice", value: "ElevenLabs TTS" },
                { label: "Maps", value: "Google Maps API" },
                { label: "Framework", value: "React 19 + tRPC" },
                { label: "Database", value: "MySQL / TiDB" },
                { label: "Deployed", value: "sentinel2.manus.space" },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    backgroundColor: "rgba(0, 100, 150, 0.05)",
                    borderRadius: "4px",
                    border: `1px solid ${border}`,
                  }}
                >
                  <span style={{ color: "rgba(0,200,255,0.5)", fontSize: "12px" }}>{label}</span>
                  <span style={{ color: text, fontSize: "12px" }}>{value}</span>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: "20px",
                padding: "12px",
                backgroundColor: "rgba(0, 200, 255, 0.05)",
                border: `1px solid ${border}`,
                borderRadius: "6px",
                fontSize: "12px",
                color: "rgba(0,200,255,0.6)",
                textAlign: "center",
              }}
            >
              "At your service, as always, sir."
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Morning Routine Tab ───────────────────────────────────────────────────────
const ALL_SECTION_DEFS = [
  { id: "weather",   label: "🌡 Weather",       description: "Current conditions, temperature, wind, UV" },
  { id: "alerts",    label: "🚨 NWS Alerts",    description: "Active watches & warnings (US only)" },
  { id: "forecast",  label: "📅 Forecast",      description: "7-day weather outlook" },
  { id: "air",       label: "💨 Air Quality",   description: "AQI, PM2.5, ozone levels" },
  { id: "calendar",  label: "📆 Calendar",      description: "Today's events and appointments" },
  { id: "email",     label: "📧 Email",         description: "Unread email count and top subjects" },
  { id: "reminders", label: "⏰ Reminders",     description: "Upcoming reminders due today" },
  { id: "stocks",    label: "📈 Stocks",        description: "Key market indices and watchlist" },
  { id: "news",      label: "📰 News",          description: "Top headlines" },
  { id: "spotify",   label: "🎵 Music",         description: "Play your wake-up track on Spotify" },
];

function MorningRoutineTab({ accent, border, text }: { accent: string; border: string; text: string }) {
  const { data: configData, isLoading } = trpc.sentinel.getMorningConfig.useQuery();
  const saveConfig = trpc.sentinel.saveMorningConfig.useMutation({
    onSuccess: () => toast.success("Morning routine saved"),
    onError: () => toast.error("Failed to save"),
  });

  const [sections, setSections] = useState<string[]>([]);
  const [wakeTime, setWakeTime] = useState("07:00");
  const [musicQuery, setMusicQuery] = useState("Highway to Hell AC/DC");
  const [customGreeting, setCustomGreeting] = useState("Good morning, sir");
  const [readAloud, setReadAloud] = useState(true);
  const [weatherLocation, setWeatherLocation] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Hydrate from server config once loaded
  React.useEffect(() => {
    if (configData && !initialized) {
      setSections(configData.config.sections);
      setWakeTime(configData.config.wakeTime);
      setMusicQuery(configData.config.musicQuery);
      setCustomGreeting(configData.config.customGreeting);
      setReadAloud(configData.config.readAloud);
      setWeatherLocation(configData.config.weatherLocation ?? "");
      setInitialized(true);
    }
  }, [configData, initialized]);

  const toggleSection = (id: string) => {
    setSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    saveConfig.mutate({
      sections,
      wakeTime,
      musicQuery,
      customGreeting,
      readAloud,
      weatherLocation: weatherLocation.trim() || null,
    });
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    backgroundColor: "rgba(0, 100, 150, 0.08)",
    border: `1px solid ${border}`,
    borderRadius: "4px",
    color: text,
    fontSize: "13px",
    outline: "none",
    fontFamily: "monospace",
  };

  const labelStyle: React.CSSProperties = {
    color: "rgba(0,200,255,0.6)",
    fontSize: "11px",
    letterSpacing: "0.08em",
    marginBottom: "4px",
    display: "block",
  };

  if (isLoading) {
    return (
      <div style={{ color: "rgba(0,200,255,0.5)", fontSize: "12px", padding: "20px", textAlign: "center" }}>
        Loading morning routine configuration...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${border}`, paddingBottom: "12px" }}>
        <h3 style={{ color: accent, fontSize: "14px", letterSpacing: "0.1em", margin: 0 }}>
          ☀️ MORNING ROUTINE
        </h3>
        <div style={{ color: "rgba(0,200,255,0.4)", fontSize: "11px", marginTop: "4px" }}>
          Customize what SENTINEL includes in your morning briefing
        </div>
      </div>

      {/* Greeting & Wake Time */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <label style={labelStyle}>CUSTOM GREETING</label>
          <input
            style={inputStyle}
            value={customGreeting}
            onChange={(e) => setCustomGreeting(e.target.value)}
            placeholder="Good morning, sir"
          />
        </div>
        <div>
          <label style={labelStyle}>WAKE TIME</label>
          <input
            type="time"
            style={inputStyle}
            value={wakeTime}
            onChange={(e) => setWakeTime(e.target.value)}
          />
        </div>
      </div>

      {/* Music & Location */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <label style={labelStyle}>WAKE-UP MUSIC (Spotify query)</label>
          <input
            style={inputStyle}
            value={musicQuery}
            onChange={(e) => setMusicQuery(e.target.value)}
            placeholder="Highway to Hell AC/DC"
          />
        </div>
        <div>
          <label style={labelStyle}>WEATHER LOCATION (optional override)</label>
          <input
            style={inputStyle}
            value={weatherLocation}
            onChange={(e) => setWeatherLocation(e.target.value)}
            placeholder="Uses home zip code if blank"
          />
        </div>
      </div>

      {/* Read Aloud toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <button
          onClick={() => setReadAloud(!readAloud)}
          style={{
            width: "42px",
            height: "22px",
            borderRadius: "11px",
            border: `1px solid ${border}`,
            backgroundColor: readAloud ? "rgba(0,200,255,0.25)" : "rgba(0,0,0,0.3)",
            cursor: "pointer",
            position: "relative",
            transition: "background 0.2s",
            flexShrink: 0,
          }}
          aria-label={`Read aloud: ${readAloud ? "on" : "off"}`}
        >
          <span
            style={{
              position: "absolute",
              top: "2px",
              left: readAloud ? "22px" : "2px",
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              backgroundColor: readAloud ? accent : "rgba(0,200,255,0.3)",
              transition: "left 0.2s",
            }}
          />
        </button>
        <span style={{ color: text, fontSize: "12px" }}>
          Read briefing aloud via ElevenLabs TTS
        </span>
      </div>

      {/* Sections */}
      <div>
        <label style={{ ...labelStyle, marginBottom: "10px" }}>BRIEFING SECTIONS</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {ALL_SECTION_DEFS.map((sec) => {
            const enabled = sections.includes(sec.id);
            return (
              <button
                key={sec.id}
                onClick={() => toggleSection(sec.id)}
                style={{
                  padding: "10px 12px",
                  backgroundColor: enabled ? "rgba(0,200,255,0.12)" : "rgba(0,0,0,0.2)",
                  border: `1px solid ${enabled ? "rgba(0,200,255,0.5)" : border}`,
                  borderRadius: "6px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ color: enabled ? accent : "rgba(0,200,255,0.45)", fontSize: "12px", fontWeight: "bold" }}>
                  {enabled ? "◉" : "◎"} {sec.label}
                </div>
                <div style={{ color: "rgba(0,200,255,0.35)", fontSize: "10px", marginTop: "2px" }}>
                  {sec.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saveConfig.isPending}
        style={{
          padding: "10px 20px",
          backgroundColor: "rgba(0,200,255,0.15)",
          border: `1px solid rgba(0,200,255,0.5)`,
          borderRadius: "6px",
          color: accent,
          cursor: saveConfig.isPending ? "wait" : "pointer",
          fontSize: "13px",
          fontWeight: "bold",
          letterSpacing: "0.1em",
          transition: "all 0.2s",
          alignSelf: "flex-start",
        }}
      >
        {saveConfig.isPending ? "SAVING..." : "⚡ SAVE MORNING ROUTINE"}
      </button>
    </div>
  );
}
