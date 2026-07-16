import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export interface WindowState {
  id: string;
  title: string;
  icon: string;
  windowType?: string;  // stable string key used to resolve component after localStorage restore
  component: React.ComponentType<any>;
  position: { x: number; y: number };
  size: { width: number; height: number };
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  data?: any;
}

interface WindowContextType {
  windows: WindowState[];
  openWindow: (window: Omit<WindowState, "zIndex">) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  updateWindowPosition: (id: string, position: { x: number; y: number }) => void;
  updateWindowSize: (id: string, size: { width: number; height: number }) => void;
  closeAllWindows: () => void;
  restoreAllWindows: () => void;
  resetWorkspace: () => void;
}

const WindowContext = createContext<WindowContextType | undefined>(undefined);

const STORAGE_KEY = "sentinel-windows";
const MAX_Z_INDEX = 9999;

export function WindowProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [nextZIndex, setNextZIndex] = useState(100);

  // Load windows from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Filter out component references (they can't be serialized)
        setWindows(
          parsed.map((w: any) => ({
            ...w,
            component: w.component || (() => null),
          }))
        );
      } catch (e) {
        console.error("Failed to load windows from localStorage", e);
      }
    }
  }, []);

  // Save windows to localStorage whenever they change
  useEffect(() => {
    const toSave = windows.map(({ component, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, [windows]);

  const openWindow = useCallback(
    (newWindow: Omit<WindowState, "zIndex">) => {
      setWindows((prev) => [
        ...prev,
        {
          ...newWindow,
          zIndex: nextZIndex,
        },
      ]);
      setNextZIndex((prev) => Math.min(prev + 1, MAX_Z_INDEX));
    },
    [nextZIndex]
  );

  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isMinimized: true } : w))
    );
  }, []);

  const maximizeWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isMaximized: true } : w))
    );
  }, []);

  const restoreWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, isMinimized: false, isMaximized: false } : w
      )
    );
  }, []);

  const focusWindow = useCallback((id: string) => {
    setWindows((prev) => {
      const window = prev.find((w) => w.id === id);
      if (!window) return prev;

      const newZIndex = Math.min(nextZIndex, MAX_Z_INDEX);
      setNextZIndex((prev) => Math.min(prev + 1, MAX_Z_INDEX));

      return prev.map((w) => (w.id === id ? { ...w, zIndex: newZIndex } : w));
    });
  }, [nextZIndex]);

  const updateWindowPosition = useCallback(
    (id: string, position: { x: number; y: number }) => {
      setWindows((prev) =>
        prev.map((w) => (w.id === id ? { ...w, position } : w))
      );
    },
    []
  );

  const updateWindowSize = useCallback(
    (id: string, size: { width: number; height: number }) => {
      setWindows((prev) =>
        prev.map((w) => (w.id === id ? { ...w, size } : w))
      );
    },
    []
  );

  const closeAllWindows = useCallback(() => {
    setWindows([]);
  }, []);

  const restoreAllWindows = useCallback(() => {
    setWindows((prev) =>
      prev.map((w) => ({ ...w, isMinimized: false, isMaximized: false }))
    );
  }, []);

  const resetWorkspace = useCallback(() => {
    setWindows([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <WindowContext.Provider
      value={{
        windows,
        openWindow,
        closeWindow,
        minimizeWindow,
        maximizeWindow,
        restoreWindow,
        focusWindow,
        updateWindowPosition,
        updateWindowSize,
        closeAllWindows,
        restoreAllWindows,
        resetWorkspace,
      }}
    >
      {children}
    </WindowContext.Provider>
  );
}

export function useWindow() {
  const context = useContext(WindowContext);
  if (!context) {
    throw new Error("useWindow must be used within WindowProvider");
  }
  return context;
}
