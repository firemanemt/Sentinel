/**
 * SENTINEL Plugin Initializer
 *
 * Registers all built-in plugins with the PluginRegistry at application startup.
 * Import and call initPlugins() once in main.tsx or App.tsx.
 */

import { PluginRegistry } from "./pluginRegistry";

export function initPlugins() {
  // Core plugins (cannot be disabled)
  PluginRegistry.register({
    id: "chat",
    name: "AI Chat",
    icon: "💬",
    description: "Converse with SENTINEL — your AI assistant with voice and text.",
    category: "core",
    enabled: true,
    core: true,
    order: 1,
    defaultSize: { width: 600, height: 500 },
  });

  // Productivity plugins
  PluginRegistry.register({
    id: "weather",
    name: "Weather",
    icon: "🌦",
    description: "Real-time weather data and 7-day forecasts via Open-Meteo.",
    category: "productivity",
    enabled: true,
    order: 2,
    defaultSize: { width: 400, height: 300 },
  });

  PluginRegistry.register({
    id: "maps",
    name: "Maps",
    icon: "🗺",
    description: "Location search, directions, and place discovery via Google Maps.",
    category: "productivity",
    enabled: true,
    order: 3,
    defaultSize: { width: 700, height: 600 },
  });

  PluginRegistry.register({
    id: "calendar",
    name: "Calendar",
    icon: "📅",
    description: "Manage events, reminders, and schedules.",
    category: "productivity",
    enabled: true,
    order: 4,
    defaultSize: { width: 600, height: 500 },
  });

  PluginRegistry.register({
    id: "notes",
    name: "Notes",
    icon: "📝",
    description: "Quick notes with markdown support.",
    category: "productivity",
    enabled: true,
    order: 5,
    defaultSize: { width: 500, height: 400 },
  });

  PluginRegistry.register({
    id: "files",
    name: "Files",
    icon: "📁",
    description: "Browse and manage your files.",
    category: "productivity",
    enabled: true,
    order: 6,
    defaultSize: { width: 600, height: 500 },
  });

  // System plugins
  PluginRegistry.register({
    id: "browser",
    name: "Browser",
    icon: "🌐",
    description: "Embedded web browser for quick lookups.",
    category: "productivity",
    enabled: false,
    order: 7,
    defaultSize: { width: 800, height: 600 },
  });

  // Communication plugins (coming soon)
  PluginRegistry.register({
    id: "discord",
    name: "Discord",
    icon: "💬",
    description: "Monitor server notifications and lost pet case alerts.",
    category: "communication",
    enabled: false,
    order: 10,
    defaultSize: { width: 600, height: 500 },
  });

  PluginRegistry.register({
    id: "slack",
    name: "Slack",
    icon: "📢",
    description: "View workspace messages and channel activity.",
    category: "communication",
    enabled: false,
    order: 11,
    defaultSize: { width: 600, height: 500 },
  });

  // Entertainment plugins (coming soon)
  PluginRegistry.register({
    id: "spotify",
    name: "Spotify",
    icon: "🎵",
    description: "Control music playback and view now-playing info.",
    category: "entertainment",
    enabled: false,
    order: 20,
    defaultSize: { width: 400, height: 500 },
  });

  // Development plugins (coming soon)
  PluginRegistry.register({
    id: "github",
    name: "GitHub",
    icon: "🐙",
    description: "View pull requests, issues, and repository activity.",
    category: "development",
    enabled: false,
    order: 30,
    defaultSize: { width: 700, height: 600 },
  });

  // Home plugins (coming soon)
  PluginRegistry.register({
    id: "home-assistant",
    name: "Home Assistant",
    icon: "🏠",
    description: "Control smart home devices and automations.",
    category: "home",
    enabled: false,
    order: 40,
    defaultSize: { width: 600, height: 500 },
  });

  // Settings & Integrations (always available)
  PluginRegistry.register({
    id: "integrations",
    name: "Integrations",
    icon: "🔌",
    description: "Manage connected services and plugin settings.",
    category: "core",
    enabled: true,
    core: true,
    order: 98,
    defaultSize: { width: 600, height: 500 },
  });

  PluginRegistry.register({
    id: "settings",
    name: "Settings",
    icon: "⚙",
    description: "Appearance, workspace profiles, and system preferences.",
    category: "core",
    enabled: true,
    core: true,
    order: 99,
    defaultSize: { width: 600, height: 500 },
  });

  // Restore persisted enabled/disabled state
  PluginRegistry.restore();
}
