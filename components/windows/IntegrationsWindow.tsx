import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { IntegrationOnboardingWizard, type IntegrationId } from "./IntegrationOnboardingWizard";

type Category = "productivity" | "communication" | "home" | "entertainment" | "development";

interface PluginMeta {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: Category;
  hasLiveStatus?: boolean;
}

const PLUGINS: PluginMeta[] = [
  {
    id: "google-calendar",
    name: "Google Calendar",
    icon: "📅",
    description: "Sync events, reminders, and meetings from Google Calendar & Gmail.",
    category: "productivity",
    hasLiveStatus: true,
  },
  {
    id: "outlook-calendar",
    name: "Outlook Calendar",
    icon: "📆",
    description: "Connect Microsoft Outlook / Office 365 calendar via Microsoft Graph.",
    category: "productivity",
    hasLiveStatus: true,
  },
  {
    id: "apple-calendar",
    name: "Apple Calendar",
    icon: "🍎",
    description: "Connect iCloud Calendar using your Apple ID and an app-specific password.",
    category: "productivity",
    hasLiveStatus: true,
  },
  {
    id: "github",
    name: "GitHub",
    icon: "🐙",
    description: "View repos, pull requests, issues, and notifications.",
    category: "development",
    hasLiveStatus: true,
  },
  {
    id: "discord",
    name: "Discord",
    icon: "💬",
    description: "Read channels and send messages via your Discord bot.",
    category: "communication",
    hasLiveStatus: true,
  },
  {
    id: "slack",
    name: "Slack",
    icon: "📢",
    description: "Browse channels and send messages to your Slack workspace.",
    category: "communication",
    hasLiveStatus: true,
  },
  {
    id: "home-assistant",
    name: "Home Assistant",
    icon: "🏡",
    description: "Control lights, switches, climate, and smart home devices.",
    category: "home",
    hasLiveStatus: true,
  },
  {
    id: "spotify",
    name: "Spotify",
    icon: "🎵",
    description: "Control music playback and view now-playing info.",
    category: "entertainment",
    hasLiveStatus: true,
  },
  {
    id: "weather",
    name: "Weather",
    icon: "🌦",
    description: "Real-time weather data and forecasts via Open-Meteo.",
    category: "productivity",
  },
  {
    id: "maps",
    name: "Google Maps",
    icon: "🗺",
    description: "Location search, directions, and place discovery.",
    category: "productivity",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs Voice",
    icon: "🎙",
    description: "Premium text-to-speech with SENTINEL voice profiles.",
    category: "productivity",
  },
];

const CATEGORY_LABELS: Record<Category, string> = {
  productivity: "Productivity",
  communication: "Communication",
  home: "Smart Home",
  entertainment: "Entertainment",
  development: "Development",
};

const ALWAYS_ON = new Set(["weather", "maps", "elevenlabs"]);

// Apple Calendar connect form state
interface AppleFormState {
  appleId: string;
  appPassword: string;
  error: string;
  loading: boolean;
}

export function IntegrationsWindow() {
  const [filter, setFilter] = useState<Category | "all">("all");
  const [wizardId, setWizardId] = useState<IntegrationId | null>(null);
  const [showAppleForm, setShowAppleForm] = useState(false);
  const [appleForm, setAppleForm] = useState<AppleFormState>({
    appleId: "", appPassword: "", error: "", loading: false,
  });

  // Live status queries
  const { data: githubStatus } = trpc.github.status.useQuery();
  const { data: discordStatus } = trpc.discord.status.useQuery();
  const { data: slackStatus } = trpc.slack.status.useQuery();
  const { data: haStatus } = trpc.homeAssistant.getStatus.useQuery();
  const { data: spotifyStatus } = trpc.sentinel.spotifyStatus.useQuery();
  const { data: googleCalStatus } = trpc.sentinel.calendarStatus.useQuery();
  const { data: outlookStatus } = trpc.sentinel.outlookStatus.useQuery();
  const { data: appleCalStatus } = trpc.sentinel.appleCalendarStatus.useQuery();

  const disconnectGithub = trpc.github.disconnect.useMutation();
  const disconnectDiscord = trpc.discord.disconnect.useMutation();
  const disconnectSlack = trpc.slack.disconnect.useMutation();
  const disconnectHa = trpc.homeAssistant.disconnect.useMutation();
  const disconnectOutlook = trpc.sentinel.disconnectOutlook.useMutation();
  const disconnectApple = trpc.sentinel.disconnectAppleCalendar.useMutation();
  const connectApple = trpc.sentinel.connectAppleCalendar.useMutation();

  const utils = trpc.useUtils();

  function getLiveStatus(id: string): "connected" | "available" | "coming_soon" {
    if (ALWAYS_ON.has(id)) return "connected";
    switch (id) {
      case "github": return githubStatus?.connected ? "connected" : "available";
      case "discord": return discordStatus?.connected ? "connected" : "available";
      case "slack": return slackStatus?.connected ? "connected" : "available";
      case "home-assistant": return haStatus?.connected ? "connected" : "available";
      case "spotify": return spotifyStatus?.connected ? "connected" : "available";
      case "google-calendar": return googleCalStatus?.connected ? "connected" : "available";
      case "outlook-calendar": return outlookStatus?.connected ? "connected" : "available";
      case "apple-calendar": return appleCalStatus?.connected ? "connected" : "available";
      default: return "available";
    }
  }

  function handleDisconnect(id: string) {
    switch (id) {
      case "github": disconnectGithub.mutate(undefined, { onSuccess: () => utils.github.status.invalidate() }); break;
      case "discord": disconnectDiscord.mutate(undefined, { onSuccess: () => utils.discord.status.invalidate() }); break;
      case "slack": disconnectSlack.mutate(undefined, { onSuccess: () => utils.slack.status.invalidate() }); break;
      case "home-assistant": disconnectHa.mutate(undefined, { onSuccess: () => utils.homeAssistant.getStatus.invalidate() }); break;
      case "google-calendar": window.location.href = "/api/calendar/disconnect"; break;
      case "outlook-calendar":
        disconnectOutlook.mutate(undefined, { onSuccess: () => utils.sentinel.outlookStatus.invalidate() });
        break;
      case "apple-calendar":
        disconnectApple.mutate(undefined, { onSuccess: () => utils.sentinel.appleCalendarStatus.invalidate() });
        break;
      default: break;
    }
  }

  function handleConnect(id: string) {
    switch (id) {
      case "google-calendar":
        window.location.href = "/api/calendar/connect";
        break;
      case "outlook-calendar":
        window.location.href = "/api/outlook/connect";
        break;
      case "apple-calendar":
        setShowAppleForm(true);
        break;
      default: {
        const wizardMap: Record<string, IntegrationId> = {
          github: "github", discord: "discord", slack: "slack",
          "home-assistant": "homeAssistant", spotify: "spotify",
        };
        const wid = wizardMap[id];
        if (wid) setWizardId(wid);
        break;
      }
    }
  }

  async function handleAppleConnect() {
    setAppleForm(f => ({ ...f, error: "", loading: true }));
    try {
      await connectApple.mutateAsync({
        appleId: appleForm.appleId.trim(),
        appPassword: appleForm.appPassword.trim(),
      });
      await utils.sentinel.appleCalendarStatus.invalidate();
      setShowAppleForm(false);
      setAppleForm({ appleId: "", appPassword: "", error: "", loading: false });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      setAppleForm(f => ({ ...f, error: msg, loading: false }));
    }
  }

  const accent = "var(--color-primary, #00ccee)";
  const border = "var(--color-border, rgba(0,200,255,0.3))";
  const text = "var(--color-text, #e0e0e0)";

  const filtered = filter === "all" ? PLUGINS : PLUGINS.filter((p) => p.category === filter);
  const uniqueCategories = Array.from(new Set(PLUGINS.map((p) => p.category)));
  const categories = ["all", ...uniqueCategories] as const;

  const connectedCount = PLUGINS.filter((p) => getLiveStatus(p.id) === "connected").length;
  const availableCount = PLUGINS.filter((p) => getLiveStatus(p.id) === "available").length;

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
        position: "relative",
      }}
    >
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        <h2 style={{ color: accent, fontSize: "14px", letterSpacing: "0.1em", margin: 0 }}>
          🔌 INTEGRATIONS & PLUGINS
        </h2>
        <div style={{ fontSize: "11px", color: "rgba(0,200,255,0.4)", marginTop: "4px" }}>
          {connectedCount} connected · {availableCount} available to connect
        </div>
      </div>

      {/* Category Filter */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          padding: "10px 16px",
          borderBottom: `1px solid ${border}`,
          flexShrink: 0,
          overflowX: "auto",
        }}
      >
        {categories.map((cat) => {
          const isActive = filter === cat;
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat as Category | "all")}
              aria-pressed={isActive}
              style={{
                padding: "4px 10px",
                backgroundColor: isActive ? "rgba(0, 200, 255, 0.15)" : "transparent",
                border: `1px solid ${isActive ? "rgba(0,200,255,0.4)" : border}`,
                borderRadius: "12px",
                color: isActive ? accent : "rgba(0,200,255,0.5)",
                cursor: "pointer",
                fontSize: "11px",
                whiteSpace: "nowrap",
                transition: "all 0.2s",
              }}
            >
              {cat === "all" ? "All" : CATEGORY_LABELS[cat as Category]}
            </button>
          );
        })}
      </div>

      {/* Plugin List */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {filtered.map((plugin) => {
          const status = getLiveStatus(plugin.id);
          const isConnected = status === "connected";
          const isComingSoon = status === "coming_soon";
          const isAlwaysOn = ALWAYS_ON.has(plugin.id);

          return (
            <div
              key={plugin.id}
              role="listitem"
              aria-label={`${plugin.name} integration`}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                padding: "12px",
                backgroundColor: isConnected
                  ? "rgba(0, 255, 136, 0.05)"
                  : "rgba(0, 100, 150, 0.05)",
                border: `1px solid ${isConnected ? "rgba(0,255,136,0.2)" : border}`,
                borderRadius: "8px",
                opacity: isComingSoon ? 0.6 : 1,
              }}
            >
              <span style={{ fontSize: "22px", flexShrink: 0, marginTop: "1px" }}>{plugin.icon}</span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <span style={{ color: text, fontSize: "13px", fontWeight: "bold" }}>
                    {plugin.name}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      color: isConnected ? "#00ff88" : isComingSoon ? "rgba(0,200,255,0.3)" : accent,
                      border: `1px solid ${isConnected ? "#00ff88" : isComingSoon ? "rgba(0,200,255,0.3)" : accent}`,
                      borderRadius: "10px",
                      padding: "1px 6px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isConnected ? "Connected" : isComingSoon ? "Coming Soon" : "Available"}
                  </span>
                </div>
                <div style={{ fontSize: "11px", color: "rgba(0,200,255,0.4)", marginTop: "4px", lineHeight: "1.4" }}>
                  {plugin.description}
                </div>

                {/* Apple Calendar hint */}
                {plugin.id === "apple-calendar" && !isConnected && (
                  <div style={{ fontSize: "10px", color: "rgba(0,200,255,0.35)", marginTop: "4px" }}>
                    Requires an app-specific password from{" "}
                    <a
                      href="https://appleid.apple.com/account/manage"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: accent, textDecoration: "underline" }}
                    >
                      appleid.apple.com
                    </a>
                  </div>
                )}

                {/* Outlook hint */}
                {plugin.id === "outlook-calendar" && !isConnected && (
                  <div style={{ fontSize: "10px", color: "rgba(0,200,255,0.35)", marginTop: "4px" }}>
                    Requires a Microsoft Azure app with Calendars.ReadWrite permission.
                  </div>
                )}

                {!isAlwaysOn && !isComingSoon && (
                  <div style={{ marginTop: "8px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {isConnected ? (
                      <button
                        onClick={() => handleDisconnect(plugin.id)}
                        style={{
                          padding: "3px 10px",
                          backgroundColor: "rgba(255, 50, 50, 0.1)",
                          border: "1px solid rgba(255,50,50,0.3)",
                          borderRadius: "4px",
                          color: "#ff6666",
                          cursor: "pointer",
                          fontSize: "11px",
                          transition: "all 0.2s",
                        }}
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect(plugin.id)}
                        style={{
                          padding: "3px 10px",
                          backgroundColor: "rgba(0,200,255,0.1)",
                          border: "1px solid rgba(0,200,255,0.35)",
                          borderRadius: "4px",
                          color: accent,
                          cursor: "pointer",
                          fontSize: "11px",
                          fontFamily: "'Orbitron', monospace",
                          letterSpacing: "0.08em",
                          transition: "all 0.2s",
                        }}
                      >
                        ⚡ CONNECT
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: isConnected
                    ? "#00ff88"
                    : isComingSoon
                    ? "rgba(0,200,255,0.2)"
                    : "rgba(0,200,255,0.4)",
                  flexShrink: 0,
                  marginTop: "6px",
                  boxShadow: isConnected ? "0 0 6px #00ff88" : "none",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Onboarding Wizard Overlay */}
      {wizardId && (
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(0,8,20,0.96)",
          backdropFilter: "blur(4px)",
          zIndex: 10,
          display: "flex", flexDirection: "column",
          border: "1px solid rgba(0,200,255,0.3)",
          borderRadius: "inherit",
        }}>
          <IntegrationOnboardingWizard
            integrationId={wizardId}
            onClose={() => setWizardId(null)}
            onConnected={() => {
              setWizardId(null);
              utils.github.status.invalidate();
              utils.discord.status.invalidate();
              utils.slack.status.invalidate();
              utils.homeAssistant.getStatus.invalidate();
            }}
          />
        </div>
      )}

      {/* Apple Calendar Credentials Form */}
      {showAppleForm && (
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(0,8,20,0.97)",
          backdropFilter: "blur(4px)",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          gap: "16px",
        }}>
          <div style={{ color: accent, fontSize: "16px", fontWeight: "bold", letterSpacing: "0.1em" }}>
            🍎 CONNECT APPLE CALENDAR
          </div>
          <div style={{ fontSize: "11px", color: "rgba(0,200,255,0.5)", textAlign: "center", maxWidth: "320px" }}>
            Enter your Apple ID and an app-specific password. Generate one at{" "}
            <a
              href="https://appleid.apple.com/account/manage"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: accent }}
            >
              appleid.apple.com
            </a>{" "}
            under Security → App-Specific Passwords.
          </div>

          <div style={{ width: "100%", maxWidth: "320px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <input
              type="email"
              placeholder="Apple ID (email)"
              value={appleForm.appleId}
              onChange={e => setAppleForm(f => ({ ...f, appleId: e.target.value }))}
              style={{
                padding: "8px 12px",
                backgroundColor: "rgba(0,100,150,0.15)",
                border: `1px solid ${border}`,
                borderRadius: "6px",
                color: text,
                fontSize: "13px",
                outline: "none",
                fontFamily: "monospace",
              }}
            />
            <input
              type="password"
              placeholder="App-specific password (xxxx-xxxx-xxxx-xxxx)"
              value={appleForm.appPassword}
              onChange={e => setAppleForm(f => ({ ...f, appPassword: e.target.value }))}
              style={{
                padding: "8px 12px",
                backgroundColor: "rgba(0,100,150,0.15)",
                border: `1px solid ${border}`,
                borderRadius: "6px",
                color: text,
                fontSize: "13px",
                outline: "none",
                fontFamily: "monospace",
              }}
            />
            {appleForm.error && (
              <div style={{ color: "#ff6666", fontSize: "11px" }}>{appleForm.error}</div>
            )}
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleAppleConnect}
                disabled={appleForm.loading || !appleForm.appleId || !appleForm.appPassword}
                style={{
                  flex: 1,
                  padding: "8px",
                  backgroundColor: "rgba(0,200,255,0.15)",
                  border: `1px solid ${accent}`,
                  borderRadius: "6px",
                  color: accent,
                  cursor: appleForm.loading ? "wait" : "pointer",
                  fontSize: "12px",
                  fontFamily: "'Orbitron', monospace",
                  letterSpacing: "0.08em",
                  opacity: (!appleForm.appleId || !appleForm.appPassword) ? 0.5 : 1,
                }}
              >
                {appleForm.loading ? "CONNECTING…" : "⚡ CONNECT"}
              </button>
              <button
                onClick={() => { setShowAppleForm(false); setAppleForm({ appleId: "", appPassword: "", error: "", loading: false }); }}
                style={{
                  padding: "8px 14px",
                  backgroundColor: "transparent",
                  border: `1px solid ${border}`,
                  borderRadius: "6px",
                  color: "rgba(0,200,255,0.5)",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
