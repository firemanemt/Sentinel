/**
 * Window component registry.
 *
 * Maps windowType strings to React components.  This is the single source of
 * truth used by both DesktopOS (when opening windows) and DesktopWindow (when
 * rendering them).  Storing the type string in WindowState instead of the
 * component function means localStorage serialisation never loses the reference.
 */
import React from "react";
import SentinelWindow from "@/components/windows/JarvisWindow";
import { MapsWindow } from "@/components/windows/MapsWindow";
import { WeatherWindow } from "@/components/windows/WeatherWindow";
import { CalendarWindow } from "@/components/windows/CalendarWindow";
import { NotesWindow } from "@/components/windows/NotesWindow";
import { FilesWindow } from "@/components/windows/FilesWindow";
import { SettingsWindow } from "@/components/windows/SettingsWindow";
import { IntegrationsWindow } from "@/components/windows/IntegrationsWindow";
import GitHubWindow from "@/components/windows/GitHubWindow";
import DiscordWindow from "@/components/windows/DiscordWindow";
import SlackWindow from "@/components/windows/SlackWindow";
import HomeAssistantWindow from "@/components/windows/HomeAssistantWindow";
import SpotifyWindow from "@/components/windows/SpotifyWindow";
import StocksWindow from "@/components/windows/StocksWindow";
import NewsWindow from "@/components/windows/NewsWindow";

// Wrapper components that satisfy the (data?: any) => JSX.Element contract.
const BrowserWindowContent = (_props: { data?: any }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#00ccee", fontSize: "14px" }}>
    Browser — Coming Soon
  </div>
);

export const WINDOW_REGISTRY: Record<string, React.ComponentType<{ data?: any }>> = {
  chat: SentinelWindow,
  maps: MapsWindow,
  weather: WeatherWindow,
  calendar: CalendarWindow,
  notes: NotesWindow,
  files: FilesWindow,
  browser: BrowserWindowContent,
  integrations: IntegrationsWindow,
  settings: SettingsWindow,
  github: GitHubWindow,
  discord: DiscordWindow,
  slack: SlackWindow,
  "home-assistant": HomeAssistantWindow,
  spotify: SpotifyWindow,
  stocks: StocksWindow,
  news: NewsWindow,
};

/** Resolve a component by windowType; returns a placeholder if not found. */
export function resolveWindowComponent(windowType?: string): React.ComponentType<{ data?: any }> {
  if (windowType && WINDOW_REGISTRY[windowType]) return WINDOW_REGISTRY[windowType];
  return (_props: { data?: any }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "rgba(0,200,255,0.4)", fontSize: "13px" }}>
      Window content unavailable - please close and reopen this window.
    </div>
  );
}
