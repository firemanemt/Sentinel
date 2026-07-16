import { useState, useEffect, useCallback } from "react";

export type LayoutMode = "standard" | "portrait" | "compact";

const STORAGE_KEY = "sentinel-layout-mode";

function getDefaultLayout(): LayoutMode {
  // Auto-detect portrait orientation on first visit
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(STORAGE_KEY) as LayoutMode | null;
    if (saved && ["standard", "portrait", "compact"].includes(saved)) return saved;
    // Auto-suggest portrait if window is taller than wide
    if (window.innerHeight > window.innerWidth * 1.2) return "portrait";
  }
  return "standard";
}

export function useLayout() {
  const [layout, setLayoutState] = useState<LayoutMode>(getDefaultLayout);

  const setLayout = useCallback((mode: LayoutMode) => {
    setLayoutState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }, []);

  const cycleLayout = useCallback(() => {
    setLayoutState((prev) => {
      const next: LayoutMode =
        prev === "standard" ? "portrait" : prev === "portrait" ? "compact" : "standard";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  // Listen for orientation changes and suggest layout if not manually set
  useEffect(() => {
    const handleOrientationChange = () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        // Only auto-switch if user hasn't manually chosen
        if (window.innerHeight > window.innerWidth * 1.2) {
          setLayoutState("portrait");
        } else {
          setLayoutState("standard");
        }
      }
    };
    window.addEventListener("resize", handleOrientationChange);
    return () => window.removeEventListener("resize", handleOrientationChange);
  }, []);

  return { layout, setLayout, cycleLayout };
}
