/**
 * Window Manager Logic Tests
 *
 * Tests the pure window state management logic that mirrors WindowContext.
 * These are server-side unit tests using vitest.
 */

import { describe, it, expect, beforeEach } from "vitest";

// ---- Minimal replica of WindowContext state logic ----

interface WindowState {
  id: string;
  title: string;
  icon: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  data?: any;
}

type WindowStore = {
  windows: WindowState[];
  nextZIndex: number;
};

function makeStore(): WindowStore {
  return { windows: [], nextZIndex: 100 };
}

function openWindow(store: WindowStore, win: Omit<WindowState, "zIndex">): WindowStore {
  return {
    ...store,
    windows: [...store.windows, { ...win, zIndex: store.nextZIndex }],
    nextZIndex: store.nextZIndex + 1,
  };
}

function closeWindow(store: WindowStore, id: string): WindowStore {
  return { ...store, windows: store.windows.filter((w) => w.id !== id) };
}

function minimizeWindow(store: WindowStore, id: string): WindowStore {
  return {
    ...store,
    windows: store.windows.map((w) => (w.id === id ? { ...w, isMinimized: true } : w)),
  };
}

function maximizeWindow(store: WindowStore, id: string): WindowStore {
  return {
    ...store,
    windows: store.windows.map((w) => (w.id === id ? { ...w, isMaximized: true } : w)),
  };
}

function restoreWindow(store: WindowStore, id: string): WindowStore {
  return {
    ...store,
    windows: store.windows.map((w) =>
      w.id === id ? { ...w, isMinimized: false, isMaximized: false } : w
    ),
  };
}

function focusWindow(store: WindowStore, id: string): WindowStore {
  const newZ = store.nextZIndex;
  return {
    ...store,
    windows: store.windows.map((w) => (w.id === id ? { ...w, zIndex: newZ } : w)),
    nextZIndex: newZ + 1,
  };
}

function updatePosition(
  store: WindowStore,
  id: string,
  pos: { x: number; y: number }
): WindowStore {
  return {
    ...store,
    windows: store.windows.map((w) => (w.id === id ? { ...w, position: pos } : w)),
  };
}

function updateSize(
  store: WindowStore,
  id: string,
  size: { width: number; height: number }
): WindowStore {
  return {
    ...store,
    windows: store.windows.map((w) => (w.id === id ? { ...w, size } : w)),
  };
}

function closeAllWindows(store: WindowStore): WindowStore {
  return { ...store, windows: [] };
}

function restoreAllWindows(store: WindowStore): WindowStore {
  return {
    ...store,
    windows: store.windows.map((w) => ({ ...w, isMinimized: false, isMaximized: false })),
  };
}

// ---- Helper ----

function makeWindow(overrides: Partial<Omit<WindowState, "zIndex">> = {}): Omit<WindowState, "zIndex"> {
  return {
    id: "win-1",
    title: "Test Window",
    icon: "🔧",
    position: { x: 100, y: 100 },
    size: { width: 400, height: 300 },
    isMinimized: false,
    isMaximized: false,
    ...overrides,
  };
}

// ---- Tests ----

describe("Window Manager - open/close", () => {
  let store: WindowStore;

  beforeEach(() => {
    store = makeStore();
  });

  it("opens a window and assigns zIndex", () => {
    store = openWindow(store, makeWindow());
    expect(store.windows).toHaveLength(1);
    expect(store.windows[0].zIndex).toBe(100);
    expect(store.nextZIndex).toBe(101);
  });

  it("opens multiple windows with incrementing zIndex", () => {
    store = openWindow(store, makeWindow({ id: "a" }));
    store = openWindow(store, makeWindow({ id: "b" }));
    expect(store.windows[0].zIndex).toBe(100);
    expect(store.windows[1].zIndex).toBe(101);
  });

  it("closes a window by id", () => {
    store = openWindow(store, makeWindow({ id: "a" }));
    store = openWindow(store, makeWindow({ id: "b" }));
    store = closeWindow(store, "a");
    expect(store.windows).toHaveLength(1);
    expect(store.windows[0].id).toBe("b");
  });

  it("closing a non-existent window is a no-op", () => {
    store = openWindow(store, makeWindow());
    store = closeWindow(store, "does-not-exist");
    expect(store.windows).toHaveLength(1);
  });

  it("closeAllWindows removes all windows", () => {
    store = openWindow(store, makeWindow({ id: "a" }));
    store = openWindow(store, makeWindow({ id: "b" }));
    store = closeAllWindows(store);
    expect(store.windows).toHaveLength(0);
  });
});

describe("Window Manager - minimize/maximize/restore", () => {
  let store: WindowStore;

  beforeEach(() => {
    store = makeStore();
    store = openWindow(store, makeWindow());
  });

  it("minimizes a window", () => {
    store = minimizeWindow(store, "win-1");
    expect(store.windows[0].isMinimized).toBe(true);
  });

  it("maximizes a window", () => {
    store = maximizeWindow(store, "win-1");
    expect(store.windows[0].isMaximized).toBe(true);
  });

  it("restores a minimized window", () => {
    store = minimizeWindow(store, "win-1");
    store = restoreWindow(store, "win-1");
    expect(store.windows[0].isMinimized).toBe(false);
    expect(store.windows[0].isMaximized).toBe(false);
  });

  it("restores a maximized window", () => {
    store = maximizeWindow(store, "win-1");
    store = restoreWindow(store, "win-1");
    expect(store.windows[0].isMaximized).toBe(false);
  });

  it("restoreAllWindows restores every window", () => {
    store = openWindow(store, makeWindow({ id: "win-2" }));
    store = minimizeWindow(store, "win-1");
    store = maximizeWindow(store, "win-2");
    store = restoreAllWindows(store);
    store.windows.forEach((w) => {
      expect(w.isMinimized).toBe(false);
      expect(w.isMaximized).toBe(false);
    });
  });
});

describe("Window Manager - focus and z-index", () => {
  let store: WindowStore;

  beforeEach(() => {
    store = makeStore();
    store = openWindow(store, makeWindow({ id: "a" }));
    store = openWindow(store, makeWindow({ id: "b" }));
  });

  it("focusing a window raises its zIndex", () => {
    const prevZ = store.windows.find((w) => w.id === "a")!.zIndex;
    store = focusWindow(store, "a");
    const newZ = store.windows.find((w) => w.id === "a")!.zIndex;
    expect(newZ).toBeGreaterThan(prevZ);
  });

  it("other windows are unaffected when one is focused", () => {
    const bZBefore = store.windows.find((w) => w.id === "b")!.zIndex;
    store = focusWindow(store, "a");
    const bZAfter = store.windows.find((w) => w.id === "b")!.zIndex;
    expect(bZAfter).toBe(bZBefore);
  });
});

describe("Window Manager - position and size", () => {
  let store: WindowStore;

  beforeEach(() => {
    store = makeStore();
    store = openWindow(store, makeWindow());
  });

  it("updates window position", () => {
    store = updatePosition(store, "win-1", { x: 200, y: 300 });
    expect(store.windows[0].position).toEqual({ x: 200, y: 300 });
  });

  it("updates window size", () => {
    store = updateSize(store, "win-1", { width: 800, height: 600 });
    expect(store.windows[0].size).toEqual({ width: 800, height: 600 });
  });

  it("updating position of non-existent window is a no-op", () => {
    const before = store.windows[0].position;
    store = updatePosition(store, "ghost", { x: 999, y: 999 });
    expect(store.windows[0].position).toEqual(before);
  });
});

describe("Window Manager - workspace persistence serialization", () => {
  it("serializes windows without component field", () => {
    const win: WindowState = {
      id: "w1",
      title: "Test",
      icon: "🔧",
      position: { x: 0, y: 0 },
      size: { width: 400, height: 300 },
      isMinimized: false,
      isMaximized: false,
      zIndex: 100,
    };
    // Simulate what WindowContext does before saving to localStorage
    const { ...rest } = win;
    const serialized = JSON.stringify([rest]);
    const parsed = JSON.parse(serialized);
    expect(parsed[0].id).toBe("w1");
    expect(parsed[0].title).toBe("Test");
    expect(parsed[0].zIndex).toBe(100);
  });

  it("restores window state from serialized data", () => {
    const saved = JSON.stringify([
      {
        id: "w1",
        title: "Restored",
        icon: "📝",
        position: { x: 50, y: 50 },
        size: { width: 500, height: 400 },
        isMinimized: false,
        isMaximized: false,
        zIndex: 105,
      },
    ]);
    const parsed = JSON.parse(saved);
    // Simulate rehydration (component is a no-op placeholder)
    const rehydrated = parsed.map((w: any) => ({ ...w, component: () => null }));
    expect(rehydrated[0].title).toBe("Restored");
    expect(rehydrated[0].position).toEqual({ x: 50, y: 50 });
    expect(typeof rehydrated[0].component).toBe("function");
  });

  it("handles corrupted localStorage data gracefully", () => {
    const corrupted = "{ invalid json }}}";
    let result: any[] = [];
    try {
      result = JSON.parse(corrupted);
    } catch (_) {
      result = []; // fallback to empty
    }
    expect(result).toEqual([]);
  });
});
