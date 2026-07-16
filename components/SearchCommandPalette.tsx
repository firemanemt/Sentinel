import React, { useState, useEffect, useRef } from "react";
import { useWindow } from "@/contexts/WindowContext";

interface SearchResult {
  id: string;
  title: string;
  category: "window" | "command" | "setting";
  action: () => void;
  icon?: string;
}

export function SearchCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { windows, openWindow } = useWindow();

  // Listen for Ctrl+K or Cmd+K to open palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(!isOpen);
        setQuery("");
        setSelectedIndex(0);
      }
      if (isOpen && e.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus input when palette opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Search through available commands and windows
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    const q = query.toLowerCase();
    const searchResults: SearchResult[] = [];

    // Search open windows
    windows.forEach((w) => {
      if (w.title.toLowerCase().includes(q)) {
        searchResults.push({
          id: `window-${w.id}`,
          title: `Show ${w.title}`,
          category: "window",
          icon: w.icon,
          action: () => {
            // Restore window if minimized
            setIsOpen(false);
          },
        });
      }
    });

    // Search commands
    const commands: SearchResult[] = [
      {
        id: "cmd-new-chat",
        title: "New Chat",
        category: "command",
        icon: "💬",
        action: () => {
          openWindow({
            id: `chat-${Date.now()}`,
            title: "AI Chat",
            icon: "💬",
            component: () => <div>Chat Window</div>,
            position: { x: 100, y: 100 },
            size: { width: 600, height: 500 },
            isMinimized: false,
            isMaximized: false,
          });
          setIsOpen(false);
        },
      },
      {
        id: "cmd-settings",
        title: "Open Settings",
        category: "command",
        icon: "⚙",
        action: () => {
          openWindow({
            id: `settings-${Date.now()}`,
            title: "Settings",
            icon: "⚙",
            component: () => <div>Settings Window</div>,
            position: { x: 200, y: 200 },
            size: { width: 600, height: 500 },
            isMinimized: false,
            isMaximized: false,
          });
          setIsOpen(false);
        },
      },
      {
        id: "cmd-close-all",
        title: "Close All Windows",
        category: "command",
        icon: "✕",
        action: () => {
          // Close all windows
          setIsOpen(false);
        },
      },
    ];

    commands.forEach((cmd) => {
      if (cmd.title.toLowerCase().includes(q)) {
        searchResults.push(cmd);
      }
    });

    setResults(searchResults);
    setSelectedIndex(0);
  }, [query, windows, openWindow]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selectedIndex]) {
        results[selectedIndex].action();
      }
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "100px",
        zIndex: 9999,
        backdropFilter: "blur(4px)",
      }}
      onClick={() => setIsOpen(false)}
    >
      <div
        style={{
          width: "90%",
          maxWidth: "600px",
          backgroundColor: "rgba(10, 25, 47, 0.95)",
          border: "1px solid rgba(0, 200, 255, 0.3)",
          borderRadius: "8px",
          boxShadow: "0 0 30px rgba(0, 200, 255, 0.2)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(0, 200, 255, 0.2)" }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands, windows, or settings... (Ctrl+K)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: "100%",
              padding: "8px 12px",
              backgroundColor: "rgba(0, 50, 100, 0.3)",
              border: "1px solid rgba(0, 200, 255, 0.3)",
              borderRadius: "4px",
              color: "#00ccee",
              fontSize: "14px",
              outline: "none",
            }}
          />
        </div>

        {/* Results */}
        <div style={{ maxHeight: "400px", overflowY: "auto" }}>
          {results.length === 0 ? (
            <div
              style={{
                padding: "24px",
                textAlign: "center",
                color: "rgba(0, 200, 255, 0.5)",
              }}
            >
              {query ? "No results found" : "Start typing to search"}
            </div>
          ) : (
            results.map((result, index) => (
              <div
                key={result.id}
                onClick={() => result.action()}
                style={{
                  padding: "12px 16px",
                  backgroundColor:
                    index === selectedIndex ? "rgba(0, 150, 200, 0.3)" : "transparent",
                  borderLeft: index === selectedIndex ? "3px solid #00ccee" : "3px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span style={{ fontSize: "16px" }}>{result.icon || "•"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#00ccee", fontWeight: "bold", fontSize: "14px" }}>
                    {result.title}
                  </div>
                  <div
                    style={{
                      color: "rgba(0, 200, 255, 0.5)",
                      fontSize: "12px",
                      textTransform: "capitalize",
                    }}
                  >
                    {result.category}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "8px 16px",
            borderTop: "1px solid rgba(0, 200, 255, 0.2)",
            fontSize: "12px",
            color: "rgba(0, 200, 255, 0.4)",
            display: "flex",
            gap: "16px",
            justifyContent: "flex-end",
          }}
        >
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
