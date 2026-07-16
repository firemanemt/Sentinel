import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { WindowState } from "./WindowContext";

export interface WorkspaceLayout {
  id: string;
  name: string;
  windows: Omit<WindowState, "component">[];
  createdAt: number;
}

interface WorkspaceContextType {
  layouts: WorkspaceLayout[];
  currentLayout: string | null;
  saveLayout: (name: string, windows: Omit<WindowState, "component">[]) => void;
  loadLayout: (id: string) => Omit<WindowState, "component">[] | null;
  deleteLayout: (id: string) => void;
  renameLayout: (id: string, newName: string) => void;
  setCurrentLayout: (id: string | null) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const STORAGE_KEY = "sentinel-layouts";

const DEFAULT_LAYOUTS: WorkspaceLayout[] = [
  {
    id: "work",
    name: "Work",
    windows: [],
    createdAt: Date.now(),
  },
  {
    id: "school",
    name: "School",
    windows: [],
    createdAt: Date.now(),
  },
  {
    id: "programming",
    name: "Programming",
    windows: [],
    createdAt: Date.now(),
  },
  {
    id: "travel",
    name: "Travel",
    windows: [],
    createdAt: Date.now(),
  },
  {
    id: "gaming",
    name: "Gaming",
    windows: [],
    createdAt: Date.now(),
  },
];

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [layouts, setLayouts] = useState<WorkspaceLayout[]>([]);
  const [currentLayout, setCurrentLayout] = useState<string | null>(null);

  // Load layouts from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setLayouts(parsed);
      } catch (e) {
        console.error("Failed to load layouts from localStorage", e);
        setLayouts(DEFAULT_LAYOUTS);
      }
    } else {
      setLayouts(DEFAULT_LAYOUTS);
    }
  }, []);

  // Save layouts to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
  }, [layouts]);

  const saveLayout = useCallback(
    (name: string, windows: Omit<WindowState, "component">[]) => {
      const id = `layout-${Date.now()}`;
      const newLayout: WorkspaceLayout = {
        id,
        name,
        windows,
        createdAt: Date.now(),
      };

      setLayouts((prev) => [...prev, newLayout]);
    },
    []
  );

  const loadLayout = useCallback(
    (id: string) => {
      const layout = layouts.find((l) => l.id === id);
      return layout ? layout.windows : null;
    },
    [layouts]
  );

  const deleteLayout = useCallback((id: string) => {
    setLayouts((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const renameLayout = useCallback((id: string, newName: string) => {
    setLayouts((prev) =>
      prev.map((l) => (l.id === id ? { ...l, name: newName } : l))
    );
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        layouts,
        currentLayout,
        saveLayout,
        loadLayout,
        deleteLayout,
        renameLayout,
        setCurrentLayout,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}
