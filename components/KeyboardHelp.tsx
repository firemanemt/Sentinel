import React, { useState } from "react";

interface KeyboardHelpProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function KeyboardHelp({ isOpen: externalIsOpen, onClose }: KeyboardHelpProps = {}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const handleClose = () => {
    setInternalIsOpen(false);
    onClose?.();
  };

  const shortcuts = [
    { keys: "Ctrl+K", action: "Open search & command palette" },
    { keys: "Ctrl+N", action: "New window" },
    { keys: "Ctrl+W", action: "Close focused window" },
    { keys: "Ctrl+M", action: "Minimize focused window" },
    { keys: "Ctrl+Shift+M", action: "Maximize focused window" },
    { keys: "Ctrl+Tab", action: "Switch to next window" },
    { keys: "Ctrl+Shift+Tab", action: "Switch to previous window" },
    { keys: "Ctrl+H", action: "Show keyboard help" },
    { keys: "Escape", action: "Close focused window or dialog" },
  ];

  return (
    <>
      <button
        onClick={() => setInternalIsOpen(true)}
        style={{
          position: "fixed",
          bottom: "16px",
          left: "16px",
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          backgroundColor: "rgba(0, 150, 200, 0.2)",
          border: "1px solid rgba(0, 200, 255, 0.3)",
          color: "#00ccee",
          cursor: "pointer",
          fontSize: "18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 999,
        }}
        title="Keyboard shortcuts (Ctrl+H)"
      >
        ⌨
      </button>

      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10001,
          }}
          onClick={handleClose}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "rgba(10, 25, 47, 0.95)",
              border: "1px solid rgba(0, 200, 255, 0.3)",
              borderRadius: "8px",
              padding: "24px",
              maxWidth: "500px",
              maxHeight: "600px",
              overflowY: "auto",
              boxShadow: "0 0 30px rgba(0, 200, 255, 0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <div style={{ color: "#00ccee", fontWeight: "bold", fontSize: "18px" }}>
                Keyboard Shortcuts
              </div>
              <button
                onClick={handleClose}
                style={{
                  background: "none",
                  border: "none",
                  color: "#00ccee",
                  cursor: "pointer",
                  fontSize: "20px",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {shortcuts.map((shortcut, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    backgroundColor: "rgba(0, 100, 150, 0.1)",
                    borderRadius: "4px",
                    borderLeft: "3px solid rgba(0, 200, 255, 0.3)",
                  }}
                >
                  <div style={{ color: "rgba(0, 200, 255, 0.6)", fontSize: "12px" }}>
                    {shortcut.action}
                  </div>
                  <div
                    style={{
                      backgroundColor: "rgba(0, 150, 200, 0.2)",
                      border: "1px solid rgba(0, 200, 255, 0.3)",
                      borderRadius: "4px",
                      padding: "4px 8px",
                      color: "#00ccee",
                      fontSize: "11px",
                      fontWeight: "bold",
                      fontFamily: "monospace",
                    }}
                  >
                    {shortcut.keys}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: "16px",
                padding: "12px",
                backgroundColor: "rgba(0, 100, 150, 0.1)",
                borderRadius: "4px",
                color: "rgba(0, 200, 255, 0.6)",
                fontSize: "12px",
              }}
            >
              💡 Tip: Press Ctrl+H anytime to show this help menu
            </div>
          </div>
        </div>
      )}
    </>
  );
}
