import React, { useState, useCallback } from "react";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  timestamp: number;
  icon?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback(
    (notification: Omit<Notification, "id" | "timestamp">) => {
      const id = `notif-${Date.now()}`;
      const newNotif: Notification = {
        ...notification,
        id,
        timestamp: Date.now(),
      };

      setNotifications((prev) => [newNotif, ...prev]);

      // Auto-remove after 5 seconds if not error
      if (notification.type !== "error") {
        setTimeout(() => {
          setNotifications((prev) => prev.filter((n) => n.id !== id));
        }, 5000);
      }

      return id;
    },
    []
  );

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return { notifications, addNotification, removeNotification, clearAll };
}

interface NotificationCenterProps {
  notifications: Notification[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
}

export function NotificationCenter({
  notifications,
  onRemove,
  onClearAll,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getTypeColor = (type: string) => {
    switch (type) {
      case "success":
        return "#00ff88";
      case "warning":
        return "#ffaa00";
      case "error":
        return "#ff3333";
      default:
        return "#00ccee";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "success":
        return "✓";
      case "warning":
        return "⚠";
      case "error":
        return "✕";
      default:
        return "ℹ";
    }
  };

  return (
    <div style={{ position: "fixed", bottom: "100px", right: "16px", zIndex: 1000 }}>
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          backgroundColor: "rgba(0, 150, 200, 0.2)",
          border: "1px solid rgba(0, 200, 255, 0.3)",
          color: "#00ccee",
          fontSize: "20px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.backgroundColor = "rgba(0, 150, 200, 0.4)";
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.backgroundColor = "rgba(0, 150, 200, 0.2)";
        }}
      >
        🔔
        {notifications.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              backgroundColor: "#ff3333",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: "bold",
            }}
          >
            {notifications.length}
          </div>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            bottom: "60px",
            right: 0,
            width: "350px",
            maxHeight: "500px",
            backgroundColor: "rgba(10, 25, 47, 0.95)",
            border: "1px solid rgba(0, 200, 255, 0.3)",
            borderRadius: "8px",
            boxShadow: "0 0 30px rgba(0, 200, 255, 0.2)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid rgba(0, 200, 255, 0.2)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ color: "#00ccee", fontWeight: "bold" }}>Notifications</div>
            {notifications.length > 0 && (
              <button
                onClick={onClearAll}
                style={{
                  padding: "4px 8px",
                  backgroundColor: "rgba(255, 50, 50, 0.2)",
                  border: "1px solid rgba(255, 50, 50, 0.3)",
                  borderRadius: "4px",
                  color: "#ff3333",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              >
                Clear All
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: "24px",
                  textAlign: "center",
                  color: "rgba(0, 200, 255, 0.5)",
                }}
              >
                No notifications
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid rgba(0, 200, 255, 0.1)",
                    display: "flex",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "20px",
                      color: getTypeColor(notif.type),
                      minWidth: "24px",
                    }}
                  >
                    {notif.icon || getTypeIcon(notif.type)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        color: "#00ccee",
                        fontWeight: "bold",
                        fontSize: "14px",
                        marginBottom: "4px",
                      }}
                    >
                      {notif.title}
                    </div>
                    <div
                      style={{
                        color: "rgba(0, 200, 255, 0.6)",
                        fontSize: "12px",
                        marginBottom: "8px",
                      }}
                    >
                      {notif.message}
                    </div>
                    {notif.action && (
                      <button
                        onClick={() => {
                          notif.action?.onClick();
                          onRemove(notif.id);
                        }}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "rgba(0, 150, 200, 0.2)",
                          border: "1px solid rgba(0, 200, 255, 0.3)",
                          borderRadius: "4px",
                          color: "#00ccee",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "bold",
                        }}
                      >
                        {notif.action.label}
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => onRemove(notif.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "rgba(0, 200, 255, 0.5)",
                      cursor: "pointer",
                      fontSize: "16px",
                      padding: 0,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
