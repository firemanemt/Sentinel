import { useState, useEffect } from "react";

export type HudTheme = "cyan" | "gold" | "red";

interface HudThemeConfig {
  primary: string;       // oklch
  primaryHex: string;    // hex for canvas / inline styles
  glow: string;          // rgba glow
  accent: string;        // secondary accent hex
  name: string;
}

export const HUD_THEMES: Record<HudTheme, HudThemeConfig> = {
  cyan: {
    primary: "oklch(0.72 0.18 200)",
    primaryHex: "#00ccee",
    glow: "rgba(0,200,255,",
    accent: "#4488ff",
    name: "SENTINEL BLUE",
  },
  gold: {
    primary: "oklch(0.78 0.18 80)",
    primaryHex: "#f0b030",
    glow: "rgba(240,176,48,",
    accent: "#ff9900",
    name: "IRON GOLD",
  },
  red: {
    primary: "oklch(0.65 0.22 25)",
    primaryHex: "#ff3333",
    glow: "rgba(255,50,50,",
    accent: "#ff6600",
    name: "WAR MACHINE",
  },
};

const STORAGE_KEY_THEME = "sentinel_hud_theme";
const STORAGE_KEY_INTENSITY = "sentinel_hud_intensity";

export function useHudTheme() {
  const [theme, setThemeState] = useState<HudTheme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_THEME);
    return (stored as HudTheme) ?? "cyan";
  });

  const [intensity, setIntensityState] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_INTENSITY);
    return stored ? parseFloat(stored) : 1.0;
  });

  const setTheme = (t: HudTheme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY_THEME, t);
  };

  const setIntensity = (v: number) => {
    const clamped = Math.max(0.2, Math.min(1.0, v));
    setIntensityState(clamped);
    localStorage.setItem(STORAGE_KEY_INTENSITY, String(clamped));
  };

  // Apply CSS variables to :root whenever theme or intensity changes
  useEffect(() => {
    const config = HUD_THEMES[theme];
    const root = document.documentElement;
    // Scale glow and border opacity by intensity
    root.style.setProperty("--hud-primary", config.primaryHex);
    root.style.setProperty("--hud-glow", config.glow + String(0.6 * intensity) + ")");
    root.style.setProperty("--hud-glow-dim", config.glow + String(0.25 * intensity) + ")");
    root.style.setProperty("--hud-border", config.glow + String(0.3 * intensity) + ")");
    root.style.setProperty("--hud-border-dim", config.glow + String(0.12 * intensity) + ")");
    root.style.setProperty("--hud-accent", config.accent);
    root.style.setProperty("--hud-intensity", String(intensity));
  }, [theme, intensity]);

  return { theme, setTheme, intensity, setIntensity, config: HUD_THEMES[theme] };
}
