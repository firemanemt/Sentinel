/**
 * SENTINEL Plugin Registry
 *
 * Defines the plugin interface and a central registry for all SENTINEL modules.
 * Plugins can be enabled/disabled at runtime and their state is persisted to localStorage.
 */

import React from "react";

export interface SentinelPlugin {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Emoji icon */
  icon: string;
  /** Short description */
  description: string;
  /** Category for grouping */
  category: "core" | "productivity" | "communication" | "home" | "entertainment" | "development";
  /** Whether the plugin is currently active */
  enabled: boolean;
  /** Window component to render when opened */
  component?: React.ComponentType<any>;
  /** Default window size */
  defaultSize?: { width: number; height: number };
  /** Keyboard shortcut to open (e.g. "Ctrl+Shift+M") */
  shortcut?: string;
  /** Sidebar position (lower = higher up) */
  order?: number;
  /** Whether the plugin can be disabled by the user */
  core?: boolean;
}

const STORAGE_KEY = "sentinel-plugin-registry";

class PluginRegistryClass {
  private plugins: Map<string, SentinelPlugin> = new Map();
  private listeners: Array<() => void> = [];

  register(plugin: SentinelPlugin) {
    this.plugins.set(plugin.id, plugin);
  }

  getAll(): SentinelPlugin[] {
    return Array.from(this.plugins.values()).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  }

  getEnabled(): SentinelPlugin[] {
    return this.getAll().filter((p) => p.enabled);
  }

  get(id: string): SentinelPlugin | undefined {
    return this.plugins.get(id);
  }

  enable(id: string) {
    const plugin = this.plugins.get(id);
    if (plugin) {
      this.plugins.set(id, { ...plugin, enabled: true });
      this.persist();
      this.notify();
    }
  }

  disable(id: string) {
    const plugin = this.plugins.get(id);
    if (plugin && !plugin.core) {
      this.plugins.set(id, { ...plugin, enabled: false });
      this.persist();
      this.notify();
    }
  }

  toggle(id: string) {
    const plugin = this.plugins.get(id);
    if (!plugin || plugin.core) return;
    if (plugin.enabled) {
      this.disable(id);
    } else {
      this.enable(id);
    }
  }

  /** Persist enabled state to localStorage */
  persist() {
    const state: Record<string, boolean> = {};
    this.plugins.forEach((p, id) => {
      state[id] = p.enabled;
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  /** Restore enabled state from localStorage */
  restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const state: Record<string, boolean> = JSON.parse(raw);
      this.plugins.forEach((plugin, id) => {
        if (id in state && !plugin.core) {
          this.plugins.set(id, { ...plugin, enabled: state[id] });
        }
      });
    } catch (_) {}
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }
}

export const PluginRegistry = new PluginRegistryClass();
