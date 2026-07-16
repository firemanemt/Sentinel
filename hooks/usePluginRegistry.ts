import { useState, useEffect, useCallback } from "react";
import { PluginRegistry, SentinelPlugin } from "@/lib/pluginRegistry";

/**
 * React hook that subscribes to the PluginRegistry and re-renders on changes.
 */
export function usePluginRegistry() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const unsubscribe = PluginRegistry.subscribe(() => forceUpdate((n) => n + 1));
    return unsubscribe;
  }, []);

  const plugins = PluginRegistry.getAll();
  const enabledPlugins = PluginRegistry.getEnabled();

  const toggle = useCallback((id: string) => {
    PluginRegistry.toggle(id);
  }, []);

  const enable = useCallback((id: string) => {
    PluginRegistry.enable(id);
  }, []);

  const disable = useCallback((id: string) => {
    PluginRegistry.disable(id);
  }, []);

  return { plugins, enabledPlugins, toggle, enable, disable };
}
