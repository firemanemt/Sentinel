import React, { createContext, useContext, useState, useEffect } from "react";

export type ThemeName = "dark" | "light" | "blue-hud" | "minimal" | "glass" | "cyber";

export interface Theme {
  name: ThemeName;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    accent: string;
    border: string;
    success: string;
    warning: string;
    error: string;
  };
}

const THEMES: Record<ThemeName, Theme> = {
  dark: {
    name: "dark",
    colors: {
      primary: "#00ccee",
      secondary: "#0099cc",
      background: "#0a1930",
      text: "#e0e0e0",
      accent: "#00ccee",
      border: "rgba(0, 200, 255, 0.3)",
      success: "#00ff00",
      warning: "#ffaa00",
      error: "#ff4444",
    },
  },
  light: {
    name: "light",
    colors: {
      primary: "#0099cc",
      secondary: "#0066aa",
      background: "#f5f5f5",
      text: "#333333",
      accent: "#0099cc",
      border: "rgba(0, 150, 200, 0.3)",
      success: "#00aa00",
      warning: "#ff8800",
      error: "#cc0000",
    },
  },
  "blue-hud": {
    name: "blue-hud",
    colors: {
      primary: "#00ffff",
      secondary: "#0088ff",
      background: "#001a33",
      text: "#00ffff",
      accent: "#00ffff",
      border: "rgba(0, 255, 255, 0.4)",
      success: "#00ff00",
      warning: "#ffff00",
      error: "#ff0000",
    },
  },
  minimal: {
    name: "minimal",
    colors: {
      primary: "#333333",
      secondary: "#666666",
      background: "#ffffff",
      text: "#000000",
      accent: "#333333",
      border: "rgba(0, 0, 0, 0.1)",
      success: "#00aa00",
      warning: "#ff8800",
      error: "#cc0000",
    },
  },
  glass: {
    name: "glass",
    colors: {
      primary: "#ffffff",
      secondary: "#cccccc",
      background: "rgba(255, 255, 255, 0.1)",
      text: "#ffffff",
      accent: "#ffffff",
      border: "rgba(255, 255, 255, 0.2)",
      success: "#00ff00",
      warning: "#ffff00",
      error: "#ff0000",
    },
  },
  cyber: {
    name: "cyber",
    colors: {
      primary: "#ff00ff",
      secondary: "#00ffff",
      background: "#0a0a0a",
      text: "#ff00ff",
      accent: "#00ffff",
      border: "rgba(255, 0, 255, 0.3)",
      success: "#00ff00",
      warning: "#ffff00",
      error: "#ff0000",
    },
  },
};

interface DesktopThemeContextType {
  theme: Theme;
  themeName: ThemeName;
  setTheme: (name: ThemeName) => void;
  themes: Record<ThemeName, Theme>;
}

const DesktopThemeContext = createContext<DesktopThemeContextType | undefined>(undefined);

const STORAGE_KEY = "sentinel-desktop-theme";

export function DesktopThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>("dark");

  // Load theme from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in THEMES) {
      setThemeName(saved as ThemeName);
    }
  }, []);

  // Save theme to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, themeName);
    applyTheme(THEMES[themeName]);
  }, [themeName]);

  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    root.style.setProperty("--color-primary", theme.colors.primary);
    root.style.setProperty("--color-secondary", theme.colors.secondary);
    root.style.setProperty("--color-background", theme.colors.background);
    root.style.setProperty("--color-text", theme.colors.text);
    root.style.setProperty("--color-accent", theme.colors.accent);
    root.style.setProperty("--color-border", theme.colors.border);
    root.style.setProperty("--color-success", theme.colors.success);
    root.style.setProperty("--color-warning", theme.colors.warning);
    root.style.setProperty("--color-error", theme.colors.error);
  };

  return (
    <DesktopThemeContext.Provider
      value={{
        theme: THEMES[themeName],
        themeName,
        setTheme: setThemeName,
        themes: THEMES,
      }}
    >
      {children}
    </DesktopThemeContext.Provider>
  );
}

export function useDesktopTheme() {
  const context = useContext(DesktopThemeContext);
  if (!context) {
    throw new Error("useDesktopTheme must be used within DesktopThemeProvider");
  }
  return context;
}
