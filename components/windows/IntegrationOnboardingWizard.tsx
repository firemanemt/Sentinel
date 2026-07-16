import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ExternalLink, CheckCircle, AlertCircle, Loader2, ChevronRight, ChevronLeft, Copy, Eye, EyeOff } from "lucide-react";

export type IntegrationId = "github" | "discord" | "slack" | "homeAssistant" | "spotify";

interface Step {
  title: string;
  description: string;
  link?: { label: string; url: string };
  hint?: string;
}

interface IntegrationConfig {
  name: string;
  icon: string;
  color: string;
  steps: Step[];
  fields: {
    key: string;
    label: string;
    placeholder: string;
    type?: "text" | "password" | "url";
    hint?: string;
  }[];
}

const INTEGRATIONS: Record<IntegrationId, IntegrationConfig> = {
  github: {
    name: "GitHub",
    icon: "🐙",
    color: "#f0f6fc",
    steps: [
      {
        title: "Open GitHub Settings",
        description: "Go to your GitHub account settings to create a Personal Access Token.",
        link: { label: "GitHub Settings → Developer settings", url: "https://github.com/settings/tokens" },
      },
      {
        title: "Generate a new token",
        description: 'Click "Generate new token (classic)". Give it a name like "SENTINEL". Set expiration to "No expiration" or your preference.',
        hint: "Required scopes: repo, read:user, notifications",
      },
      {
        title: "Select scopes",
        description: "Check: repo (full), read:user, notifications. These let SENTINEL read your repos, PRs, issues, and notifications.",
      },
      {
        title: "Copy and paste your token",
        description: "Click Generate token. Copy it immediately — GitHub only shows it once.",
      },
    ],
    fields: [
      { key: "token", label: "Personal Access Token", placeholder: "ghp_xxxxxxxxxxxxxxxxxxxx", type: "password", hint: "Starts with ghp_ (classic) or github_pat_ (fine-grained)" },
    ],
  },
  discord: {
    name: "Discord",
    icon: "💬",
    color: "#5865f2",
    steps: [
      {
        title: "Open Discord Developer Portal",
        description: "Go to the Discord Developer Portal and create a new application.",
        link: { label: "Discord Developer Portal", url: "https://discord.com/developers/applications" },
      },
      {
        title: "Create a Bot",
        description: 'Inside your application, click "Bot" in the left sidebar, then "Add Bot". Give it a name like "SENTINEL".',
      },
      {
        title: "Enable Privileged Intents",
        description: 'Under Bot settings, enable "Message Content Intent" and "Server Members Intent". These are required to read messages.',
      },
      {
        title: "Copy Bot Token",
        description: 'Click "Reset Token" then copy the token. Also invite the bot to your server using the OAuth2 URL Generator with bot + applications.commands scopes.',
        hint: "Bot needs: Read Messages, Read Message History, Send Messages permissions",
      },
    ],
    fields: [
      { key: "token", label: "Bot Token", placeholder: "MTxxxxxxxxxxxxxxxxxxxxxxxx.xxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "password", hint: "Found in Bot settings → Token" },
    ],
  },
  slack: {
    name: "Slack",
    icon: "💼",
    color: "#4a154b",
    steps: [
      {
        title: "Create a Slack App",
        description: "Go to the Slack API portal and create a new app for your workspace.",
        link: { label: "Slack API → Create App", url: "https://api.slack.com/apps" },
      },
      {
        title: "Add Bot Token Scopes",
        description: 'Under "OAuth & Permissions", add these Bot Token Scopes: channels:read, channels:history, chat:write, users:read.',
        hint: "Required scopes: channels:read, channels:history, chat:write, users:read",
      },
      {
        title: "Install to Workspace",
        description: 'Click "Install to Workspace" and authorize. This generates your Bot User OAuth Token.',
      },
      {
        title: "Copy Bot Token",
        description: 'Copy the "Bot User OAuth Token" — it starts with xoxb-.',
      },
    ],
    fields: [
      { key: "token", label: "Bot User OAuth Token", placeholder: "xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx", type: "password", hint: "Starts with xoxb-" },
    ],
  },
  homeAssistant: {
    name: "Home Assistant",
    icon: "🏡",
    color: "#18bcf2",
    steps: [
      {
        title: "Find your Home Assistant URL",
        description: "This is the URL you use to access Home Assistant locally or via Nabu Casa. Examples: http://homeassistant.local:8123 or https://your-id.ui.nabu.casa",
        hint: "Must be accessible from your browser. Use HTTPS for remote access.",
      },
      {
        title: "Create a Long-Lived Access Token",
        description: 'In Home Assistant, go to your Profile (bottom-left avatar) → Long-Lived Access Tokens → Create Token. Name it "SENTINEL".',
        link: { label: "Home Assistant Profile", url: "http://homeassistant.local:8123/profile" },
      },
      {
        title: "Copy your token",
        description: "Copy the token immediately — it's only shown once.",
      },
    ],
    fields: [
      { key: "url", label: "Home Assistant URL", placeholder: "http://homeassistant.local:8123", type: "url", hint: "Include http:// or https://" },
      { key: "token", label: "Long-Lived Access Token", placeholder: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", type: "password", hint: "Created in your HA Profile" },
    ],
  },
  spotify: {
    name: "Spotify",
    icon: "🎵",
    color: "#1db954",
    steps: [
      {
        title: "Connect via OAuth",
        description: "SENTINEL uses Spotify's official OAuth flow. Click Connect below and you'll be redirected to Spotify to authorize.",
        hint: "Requires a Spotify Premium account for playback control.",
      },
    ],
    fields: [],
  },
};

interface Props {
  integrationId: IntegrationId;
  onClose: () => void;
  onConnected: () => void;
}

export function IntegrationOnboardingWizard({ integrationId, onClose, onConnected }: Props) {
  const config = INTEGRATIONS[integrationId];
  const [step, setStep] = useState(0);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const githubConnect = trpc.github.connect.useMutation();
  const discordConnect = trpc.discord.connect.useMutation();
  const slackConnect = trpc.slack.connect.useMutation();
  const haConnect = trpc.homeAssistant.connect.useMutation();

  const totalSteps = config.steps.length + (config.fields.length > 0 ? 1 : 0);
  const isFieldStep = step === config.steps.length;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      if (integrationId === "github") {
        await githubConnect.mutateAsync({ token: fieldValues.token });
      } else if (integrationId === "discord") {
        await discordConnect.mutateAsync({ token: fieldValues.token });
      } else if (integrationId === "slack") {
        await slackConnect.mutateAsync({ token: fieldValues.token });
      } else if (integrationId === "homeAssistant") {
        await haConnect.mutateAsync({ url: fieldValues.url, token: fieldValues.token });
      }
      setConnected(true);
      setTimeout(onConnected, 1200);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Connection failed. Check your credentials and try again.");
    } finally {
      setConnecting(false);
    }
  };

  const allFieldsFilled = config.fields.every((f) => (fieldValues[f.key] ?? "").trim().length > 0);

  if (connected) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: "16px", padding: "40px 24px", textAlign: "center",
      }}>
        <div style={{ fontSize: "48px" }}>{config.icon}</div>
        <CheckCircle size={48} color="#00ff88" style={{ filter: "drop-shadow(0 0 12px #00ff88)" }} />
        <div style={{ color: "#00ff88", fontFamily: "'Orbitron', monospace", fontSize: "14px", letterSpacing: "0.15em" }}>
          {config.name.toUpperCase()} CONNECTED
        </div>
        <div style={{ color: "#00d4ff66", fontSize: "12px", fontFamily: "monospace" }}>
          Integration active. Closing wizard...
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      fontFamily: "monospace", color: "#00d4ffcc",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid #00d4ff18",
        display: "flex", alignItems: "center", gap: "12px",
      }}>
        <span style={{ fontSize: "24px" }}>{config.icon}</span>
        <div>
          <div style={{
            fontFamily: "'Orbitron', monospace", fontSize: "13px",
            color: "#00d4ff", letterSpacing: "0.15em",
          }}>
            CONNECT {config.name.toUpperCase()}
          </div>
          <div style={{ fontSize: "10px", color: "#00d4ff44", letterSpacing: "0.1em" }}>
            STEP {Math.min(step + 1, totalSteps)} OF {totalSteps}
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ flex: 1, height: "2px", background: "#00d4ff18", borderRadius: "1px", marginLeft: "8px" }}>
          <div style={{
            height: "100%", borderRadius: "1px",
            width: `${((step + 1) / totalSteps) * 100}%`,
            background: "linear-gradient(90deg, #00d4ff, #00d4ff88)",
            transition: "width 0.3s ease",
            boxShadow: "0 0 6px #00d4ff",
          }} />
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>
        {!isFieldStep ? (
          // Instruction step
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{
              fontSize: "14px", fontFamily: "'Orbitron', monospace",
              color: "#00d4ff", letterSpacing: "0.1em",
            }}>
              {config.steps[step].title}
            </div>
            <div style={{
              fontSize: "12px", lineHeight: "1.7",
              color: "#00d4ffaa", letterSpacing: "0.03em",
            }}>
              {config.steps[step].description}
            </div>
            {config.steps[step].link && (
              <a
                href={config.steps[step].link!.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "8px 14px",
                  background: "#00d4ff18",
                  border: "1px solid #00d4ff44",
                  borderRadius: "4px",
                  color: "#00d4ff",
                  textDecoration: "none",
                  fontSize: "11px",
                  letterSpacing: "0.08em",
                  transition: "all 0.15s",
                  alignSelf: "flex-start",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#00d4ff28";
                  (e.currentTarget as HTMLElement).style.borderColor = "#00d4ff88";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#00d4ff18";
                  (e.currentTarget as HTMLElement).style.borderColor = "#00d4ff44";
                }}
              >
                <ExternalLink size={12} />
                {config.steps[step].link!.label}
              </a>
            )}
            {config.steps[step].hint && (
              <div style={{
                padding: "10px 14px",
                background: "#ffaa0011",
                border: "1px solid #ffaa0033",
                borderRadius: "4px",
                fontSize: "11px",
                color: "#ffaa00aa",
                letterSpacing: "0.03em",
              }}>
                ⚡ {config.steps[step].hint}
              </div>
            )}
          </div>
        ) : (
          // Credentials input step
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{
              fontSize: "14px", fontFamily: "'Orbitron', monospace",
              color: "#00d4ff", letterSpacing: "0.1em",
            }}>
              ENTER CREDENTIALS
            </div>
            <div style={{ fontSize: "11px", color: "#00d4ff66", letterSpacing: "0.05em" }}>
              Your credentials are stored securely in the database and never leave your server.
            </div>

            {config.fields.map((field) => (
              <div key={field.key} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "10px", color: "#00d4ff88", letterSpacing: "0.15em" }}>
                  {field.label.toUpperCase()}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={field.type === "password" && !showPasswords[field.key] ? "password" : "text"}
                    value={fieldValues[field.key] ?? ""}
                    onChange={(e) => setFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    style={{
                      width: "100%",
                      padding: "10px 40px 10px 12px",
                      background: "#00d4ff08",
                      border: "1px solid #00d4ff33",
                      borderRadius: "4px",
                      color: "#00d4ffcc",
                      fontSize: "11px",
                      fontFamily: "monospace",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#00d4ff88")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#00d4ff33")}
                  />
                  <div style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", display: "flex", gap: "4px" }}>
                    {field.type === "password" && (
                      <button
                        onClick={() => setShowPasswords(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                        style={{ background: "none", border: "none", color: "#00d4ff44", cursor: "pointer", padding: "2px" }}
                      >
                        {showPasswords[field.key] ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    )}
                    {fieldValues[field.key] && (
                      <button
                        onClick={() => handleCopy(fieldValues[field.key], field.key)}
                        style={{ background: "none", border: "none", color: copied === field.key ? "#00ff88" : "#00d4ff44", cursor: "pointer", padding: "2px" }}
                      >
                        <Copy size={12} />
                      </button>
                    )}
                  </div>
                </div>
                {field.hint && (
                  <div style={{ fontSize: "10px", color: "#00d4ff44", letterSpacing: "0.03em" }}>
                    {field.hint}
                  </div>
                )}
              </div>
            ))}

            {error && (
              <div style={{
                display: "flex", alignItems: "flex-start", gap: "8px",
                padding: "10px 14px",
                background: "#ff444411",
                border: "1px solid #ff444433",
                borderRadius: "4px",
                fontSize: "11px",
                color: "#ff8888",
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: "1px" }} />
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div style={{
        padding: "14px 20px",
        borderTop: "1px solid #00d4ff18",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: "10px",
      }}>
        <button
          onClick={step === 0 ? onClose : () => setStep(s => s - 1)}
          style={{
            padding: "8px 16px",
            background: "transparent",
            border: "1px solid #00d4ff33",
            borderRadius: "4px",
            color: "#00d4ff66",
            cursor: "pointer",
            fontSize: "11px",
            fontFamily: "'Orbitron', monospace",
            letterSpacing: "0.1em",
            display: "flex", alignItems: "center", gap: "6px",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#00d4ff66";
            (e.currentTarget as HTMLElement).style.color = "#00d4ffaa";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#00d4ff33";
            (e.currentTarget as HTMLElement).style.color = "#00d4ff66";
          }}
        >
          <ChevronLeft size={12} />
          {step === 0 ? "CANCEL" : "BACK"}
        </button>

        {isFieldStep ? (
          <button
            onClick={handleConnect}
            disabled={!allFieldsFilled || connecting}
            style={{
              padding: "8px 20px",
              background: allFieldsFilled && !connecting ? "#00d4ff22" : "#00d4ff08",
              border: `1px solid ${allFieldsFilled && !connecting ? "#00d4ff88" : "#00d4ff22"}`,
              borderRadius: "4px",
              color: allFieldsFilled && !connecting ? "#00d4ff" : "#00d4ff44",
              cursor: allFieldsFilled && !connecting ? "pointer" : "not-allowed",
              fontSize: "11px",
              fontFamily: "'Orbitron', monospace",
              letterSpacing: "0.1em",
              display: "flex", alignItems: "center", gap: "8px",
              transition: "all 0.15s",
              boxShadow: allFieldsFilled && !connecting ? "0 0 12px #00d4ff22" : "none",
            }}
          >
            {connecting ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle size={12} />}
            {connecting ? "CONNECTING..." : "CONNECT"}
          </button>
        ) : (
          <button
            onClick={() => setStep(s => s + 1)}
            style={{
              padding: "8px 20px",
              background: "#00d4ff22",
              border: "1px solid #00d4ff88",
              borderRadius: "4px",
              color: "#00d4ff",
              cursor: "pointer",
              fontSize: "11px",
              fontFamily: "'Orbitron', monospace",
              letterSpacing: "0.1em",
              display: "flex", alignItems: "center", gap: "6px",
              transition: "all 0.15s",
              boxShadow: "0 0 12px #00d4ff22",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#00d4ff33";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 16px #00d4ff33";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#00d4ff22";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 12px #00d4ff22";
            }}
          >
            NEXT
            <ChevronRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
