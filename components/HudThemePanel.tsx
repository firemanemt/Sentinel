import type { HudTheme } from "@/hooks/useHudTheme";
import { HUD_THEMES } from "@/hooks/useHudTheme";

interface HudThemePanelProps {
  theme: HudTheme;
  intensity: number;
  onThemeChange: (t: HudTheme) => void;
  onIntensityChange: (v: number) => void;
}

export function HudThemePanel({ theme, intensity, onThemeChange, onIntensityChange }: HudThemePanelProps) {
  const themes: HudTheme[] = ["cyan", "gold", "red"];

  return (
    <div
      style={{
        border: "1px solid var(--hud-border, rgba(0,200,255,0.3))",
        background: "rgba(0,5,15,0.7)",
        borderRadius: "2px",
        padding: "8px",
      }}
    >
      <div
        style={{
          fontFamily: "monospace",
          fontSize: "9px",
          letterSpacing: "0.15em",
          color: "var(--hud-primary, #00ccee)",
          opacity: 0.7,
          marginBottom: "8px",
          borderBottom: "1px solid var(--hud-border-dim, rgba(0,200,255,0.1))",
          paddingBottom: "4px",
        }}
      >
        HUD THEME
      </div>

      {/* Theme colour swatches */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
        {themes.map((t) => {
          const cfg = HUD_THEMES[t];
          const isActive = t === theme;
          return (
            <button
              key={t}
              onClick={() => onThemeChange(t)}
              title={cfg.name}
              style={{
                flex: 1,
                padding: "4px 2px",
                fontFamily: "monospace",
                fontSize: "8px",
                letterSpacing: "0.05em",
                color: isActive ? cfg.primaryHex : "rgba(255,255,255,0.3)",
                background: isActive ? `${cfg.glow}0.12)` : "transparent",
                border: isActive ? `1px solid ${cfg.primaryHex}88` : "1px solid rgba(255,255,255,0.1)",
                borderRadius: "1px",
                cursor: "pointer",
                transition: "all 0.2s",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "3px",
                  background: cfg.primaryHex,
                  borderRadius: "1px",
                  marginBottom: "3px",
                  opacity: isActive ? 1 : 0.4,
                  boxShadow: isActive ? `0 0 6px ${cfg.primaryHex}` : "none",
                }}
              />
              {cfg.name.split(" ")[0]}
            </button>
          );
        })}
      </div>

      {/* Intensity slider */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "monospace",
            fontSize: "8px",
            color: "rgba(255,255,255,0.3)",
            marginBottom: "4px",
          }}
        >
          <span>HUD INTENSITY</span>
          <span style={{ color: "var(--hud-primary, #00ccee)", opacity: 0.8 }}>
            {Math.round(intensity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0.2}
          max={1.0}
          step={0.05}
          value={intensity}
          onChange={(e) => onIntensityChange(parseFloat(e.target.value))}
          style={{
            width: "100%",
            accentColor: "var(--hud-primary, #00ccee)",
            cursor: "pointer",
          }}
        />
      </div>
    </div>
  );
}
