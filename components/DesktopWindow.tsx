import React, { useRef, useState, useEffect, useCallback } from "react";
import { useWindow, WindowState } from "@/contexts/WindowContext";
import { X, Minus, Square, Maximize2 } from "lucide-react";
import { resolveWindowComponent } from "@/lib/windowRegistry";

interface DesktopWindowProps {
  window: WindowState;
}

export function DesktopWindow({ window }: DesktopWindowProps) {
  const {
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    restoreWindow,
    focusWindow,
    updateWindowPosition,
    updateWindowSize,
  } = useWindow();
  const windowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - window.position.x,
      y: e.clientY - window.position.y,
    });
    focusWindow(window.id);
  };

  useEffect(() => {
    if (!isDragging) return;

    const SNAP_THRESHOLD = 20;
    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      updateWindowPosition(window.id, { x: newX, y: newY });
    };

    const handleMouseUp = (e: MouseEvent) => {
      setIsDragging(false);
      const vw = globalThis.innerWidth;
      const vh = globalThis.innerHeight;
      let { x, y } = { x: e.clientX - dragStart.x, y: e.clientY - dragStart.y };
      const w = window.size.width;
      const h = window.size.height;
      if (x < SNAP_THRESHOLD) x = 0;
      if (y < SNAP_THRESHOLD) y = 0;
      if (x + w > vw - SNAP_THRESHOLD) x = vw - w;
      if (y + h > vh - SNAP_THRESHOLD) y = vh - h;
      updateWindowPosition(window.id, { x, y });
    };

    globalThis.addEventListener("mousemove", handleMouseMove);
    globalThis.addEventListener("mouseup", handleMouseUp);
    return () => {
      globalThis.removeEventListener("mousemove", handleMouseMove);
      globalThis.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart, window.id, updateWindowPosition]);

  // Handle resizing
  const handleResizeStart = (e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    setIsResizing(direction);
    focusWindow(window.id);
  };

  useEffect(() => {
    if (!isResizing) return;

    const startX = window.position.x;
    const startY = window.position.y;
    const startWidth = window.size.width;
    const startHeight = window.size.height;
    let initialMouseX: number | null = null;
    let initialMouseY: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (initialMouseX === null) {
        initialMouseX = e.clientX;
        initialMouseY = e.clientY;
        return;
      }
      const dx = e.clientX - initialMouseX;
      const dy = e.clientY - (initialMouseY ?? e.clientY);
      let newX = startX, newY = startY, newW = startWidth, newH = startHeight;
      if (isResizing.includes("e")) newW = Math.max(300, startWidth + dx);
      if (isResizing.includes("s")) newH = Math.max(200, startHeight + dy);
      if (isResizing.includes("w")) { newW = Math.max(300, startWidth - dx); newX = startX + dx; }
      if (isResizing.includes("n")) { newH = Math.max(200, startHeight - dy); newY = startY + dy; }
      updateWindowPosition(window.id, { x: newX, y: newY });
      updateWindowSize(window.id, { width: newW, height: newH });
    };

    const handleMouseUp = () => setIsResizing(null);
    globalThis.addEventListener("mousemove", handleMouseMove);
    globalThis.addEventListener("mouseup", handleMouseUp);
    return () => {
      globalThis.removeEventListener("mousemove", handleMouseMove);
      globalThis.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, window.id, window.position, window.size, updateWindowPosition, updateWindowSize]);

  // Keyboard shortcuts on title bar
  const handleTitleBarKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); minimizeWindow(window.id); }
      if (e.altKey && e.key === "F4") { e.preventDefault(); closeWindow(window.id); }
      if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); maximizeWindow(window.id); }
      if (e.altKey && e.key === "ArrowDown") {
        e.preventDefault();
        window.isMaximized ? restoreWindow(window.id) : minimizeWindow(window.id);
      }
    },
    [window.id, window.isMaximized, minimizeWindow, closeWindow, maximizeWindow, restoreWindow]
  );

  if (window.isMinimized) return null;

  // Prefer registry lookup (survives localStorage restore); fall back to stored component fn
  const Component = resolveWindowComponent(window.windowType) ?? window.component;
  const isMaximized = window.isMaximized;

  return (
    <div
      ref={windowRef}
      role="dialog"
      aria-label={`${window.title} window`}
      aria-modal="false"
      style={{
        position: "fixed",
        left: isMaximized ? 0 : window.position.x,
        top: isMaximized ? 0 : window.position.y,
        width: isMaximized ? "100%" : window.size.width,
        height: isMaximized ? "100%" : window.size.height,
        zIndex: window.zIndex,
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(160deg, rgba(2,10,24,0.97) 0%, rgba(4,16,36,0.97) 100%)",
        border: "1px solid #00d4ff33",
        borderRadius: isMaximized ? 0 : "6px",
        boxShadow: `
          0 0 0 1px #00d4ff11,
          0 0 20px #00d4ff18,
          0 0 60px #00d4ff08,
          inset 0 0 30px #00d4ff05
        `,
        backdropFilter: "blur(16px)",
        outline: "none",
        overflow: "hidden",
      }}
      onClick={() => focusWindow(window.id)}
    >
      {/* Corner brackets */}
      {!isMaximized && (
        <>
          {/* Top-left */}
          <div style={{ position: "absolute", top: -1, left: -1, width: 16, height: 16, pointerEvents: "none", zIndex: 20 }}>
            <div style={{ position: "absolute", top: 0, left: 0, width: 10, height: 1.5, backgroundColor: "#00d4ff", boxShadow: "0 0 4px #00d4ff" }} />
            <div style={{ position: "absolute", top: 0, left: 0, width: 1.5, height: 10, backgroundColor: "#00d4ff", boxShadow: "0 0 4px #00d4ff" }} />
          </div>
          {/* Top-right */}
          <div style={{ position: "absolute", top: -1, right: -1, width: 16, height: 16, pointerEvents: "none", zIndex: 20 }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: 10, height: 1.5, backgroundColor: "#00d4ff", boxShadow: "0 0 4px #00d4ff" }} />
            <div style={{ position: "absolute", top: 0, right: 0, width: 1.5, height: 10, backgroundColor: "#00d4ff", boxShadow: "0 0 4px #00d4ff" }} />
          </div>
          {/* Bottom-left */}
          <div style={{ position: "absolute", bottom: -1, left: -1, width: 16, height: 16, pointerEvents: "none", zIndex: 20 }}>
            <div style={{ position: "absolute", bottom: 0, left: 0, width: 10, height: 1.5, backgroundColor: "#00d4ff", boxShadow: "0 0 4px #00d4ff" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, width: 1.5, height: 10, backgroundColor: "#00d4ff", boxShadow: "0 0 4px #00d4ff" }} />
          </div>
          {/* Bottom-right */}
          <div style={{ position: "absolute", bottom: -1, right: -1, width: 16, height: 16, pointerEvents: "none", zIndex: 20 }}>
            <div style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 1.5, backgroundColor: "#00d4ff", boxShadow: "0 0 4px #00d4ff" }} />
            <div style={{ position: "absolute", bottom: 0, right: 0, width: 1.5, height: 10, backgroundColor: "#00d4ff", boxShadow: "0 0 4px #00d4ff" }} />
          </div>
        </>
      )}

      {/* Animated top border line */}
      <div style={{
        position: "absolute",
        top: 0, left: "10%", right: "10%",
        height: 1,
        background: "linear-gradient(90deg, transparent, #00d4ffaa, #00d4ff, #00d4ffaa, transparent)",
        opacity: 0.8,
        pointerEvents: "none",
        zIndex: 15,
      }} />

      {/* Title Bar */}
      <div
        role="toolbar"
        aria-label={`${window.title} title bar`}
        onMouseDown={handleMouseDown}
        onKeyDown={handleTitleBarKeyDown}
        tabIndex={0}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: "1px solid #00d4ff18",
          background: "linear-gradient(90deg, rgba(0,212,255,0.08) 0%, rgba(0,212,255,0.04) 50%, rgba(0,212,255,0.08) 100%)",
          cursor: isDragging ? "grabbing" : "grab",
          userSelect: "none",
          outline: "none",
          flexShrink: 0,
          position: "relative",
        }}
      >
        {/* Title bar scan shimmer */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(90deg, transparent 0%, #00d4ff06 50%, transparent 100%)",
          animation: "scan-line 4s linear infinite",
          pointerEvents: "none",
        }} />

        <div style={{ display: "flex", alignItems: "center", gap: "8px", position: "relative" }}>
          {/* Window type indicator */}
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            backgroundColor: "#00d4ff",
            boxShadow: "0 0 6px #00d4ff",
            animation: "arc-pulse 2s ease-in-out infinite",
            flexShrink: 0,
          }} />
          <span style={{ fontSize: "15px" }} aria-hidden="true">
            {window.icon}
          </span>
          <span
            id={`window-title-${window.id}`}
            style={{
              color: "#00d4ff",
              fontWeight: 700,
              fontSize: "11px",
              letterSpacing: "0.18em",
              fontFamily: "'Orbitron', monospace",
              textShadow: "0 0 8px #00d4ff88",
              textTransform: "uppercase",
            }}
          >
            {window.title}
          </span>
        </div>

        <div role="group" aria-label="Window controls" style={{ display: "flex", gap: "6px", position: "relative" }}>
          <WindowControlBtn
            onClick={() => minimizeWindow(window.id)}
            aria-label={`Minimize ${window.title}`}
            title="Minimize (Esc)"
            color="#ffaa00"
          >
            <Minus size={10} />
          </WindowControlBtn>
          <WindowControlBtn
            onClick={() => window.isMaximized ? restoreWindow(window.id) : maximizeWindow(window.id)}
            aria-label={window.isMaximized ? `Restore ${window.title}` : `Maximize ${window.title}`}
            title={window.isMaximized ? "Restore (Alt+↓)" : "Maximize (Alt+↑)"}
            color="#00d4ff"
          >
            {window.isMaximized ? <Maximize2 size={10} /> : <Square size={10} />}
          </WindowControlBtn>
          <WindowControlBtn
            onClick={() => closeWindow(window.id)}
            aria-label={`Close ${window.title}`}
            title="Close (Alt+F4)"
            color="#ff4444"
          >
            <X size={10} />
          </WindowControlBtn>
        </div>
      </div>

      {/* Content */}
      <div
        role="region"
        aria-labelledby={`window-title-${window.id}`}
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          position: "relative",
        }}
      >
        {/* Subtle scan line overlay on content */}
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,212,255,0.012) 2px, rgba(0,212,255,0.012) 4px)",
          pointerEvents: "none",
          zIndex: 1,
        }} />
        <div style={{ flex: 1, overflow: "auto", position: "relative", zIndex: 2 }}>
          <Component data={window.data} />
        </div>
      </div>

      {/* Resize Handles - 8-point */}
      {!isMaximized && (
        <>
          {(["nw", "ne", "sw", "se"] as const).map((dir) => (
            <div
              key={dir}
              role="separator"
              aria-label={`Resize ${dir}`}
              onMouseDown={(e) => handleResizeStart(e, dir)}
              style={{
                position: "absolute",
                width: "14px",
                height: "14px",
                cursor: `${dir}-resize`,
                zIndex: 10,
                ...(dir.includes("n") ? { top: 0 } : { bottom: 0 }),
                ...(dir.includes("w") ? { left: 0 } : { right: 0 }),
              }}
            />
          ))}
          <div onMouseDown={(e) => handleResizeStart(e, "n")} aria-label="Resize top"
            style={{ position: "absolute", top: 0, left: "14px", right: "14px", height: "4px", cursor: "n-resize", zIndex: 9 }} />
          <div onMouseDown={(e) => handleResizeStart(e, "s")} aria-label="Resize bottom"
            style={{ position: "absolute", bottom: 0, left: "14px", right: "14px", height: "4px", cursor: "s-resize", zIndex: 9 }} />
          <div onMouseDown={(e) => handleResizeStart(e, "w")} aria-label="Resize left"
            style={{ position: "absolute", left: 0, top: "14px", bottom: "14px", width: "4px", cursor: "w-resize", zIndex: 9 }} />
          <div onMouseDown={(e) => handleResizeStart(e, "e")} aria-label="Resize right"
            style={{ position: "absolute", right: 0, top: "14px", bottom: "14px", width: "4px", cursor: "e-resize", zIndex: 9 }} />
        </>
      )}
    </div>
  );
}

function WindowControlBtn({
  onClick,
  "aria-label": ariaLabel,
  title,
  color,
  children,
}: {
  onClick: () => void;
  "aria-label": string;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={(e) => (e.currentTarget.style.outline = `2px solid ${color}66`)}
      onBlur={(e) => (e.currentTarget.style.outline = "none")}
      style={{
        width: "22px",
        height: "22px",
        borderRadius: "3px",
        background: hovered ? `${color}22` : "transparent",
        border: `1px solid ${hovered ? color + "88" : color + "33"}`,
        color: hovered ? color : `${color}88`,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.12s cubic-bezier(0.23,1,0.32,1)",
        boxShadow: hovered ? `0 0 8px ${color}44` : "none",
        transform: hovered ? "scale(0.95)" : "scale(1)",
      }}
    >
      {children}
    </button>
  );
}
