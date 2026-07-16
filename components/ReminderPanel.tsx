import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface ReminderPanelProps {
  className?: string;
}

export function ReminderPanel({ className = "" }: ReminderPanelProps) {
  const utils = trpc.useUtils();

  const { data: reminders = [], isLoading } = trpc.sentinel.getReminders.useQuery(undefined, {
    refetchInterval: 30 * 1000,
  });

  const deleteMutation = trpc.sentinel.deleteReminder.useMutation({
    onSuccess: () => utils.sentinel.getReminders.invalidate(),
    onError: () => toast.error("Failed to delete reminder"),
  });

  const snoozeMutation = trpc.sentinel.snoozeReminder.useMutation({
    onSuccess: () => {
      utils.sentinel.getReminders.invalidate();
      toast.success("Reminder snoozed for 10 minutes");
    },
    onError: () => toast.error("Failed to snooze reminder"),
  });

  const panelStyle: React.CSSProperties = {
    border: "1px solid rgba(0,200,255,0.2)",
    background: "rgba(0,10,20,0.6)",
    borderRadius: "2px",
  };

  const headerStyle: React.CSSProperties = {
    borderBottom: "1px solid rgba(0,200,255,0.15)",
    padding: "4px 8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  };

  return (
    <div style={panelStyle} className={className}>
      <div style={headerStyle}>
        <span style={{ color: "rgba(0,200,255,0.6)", fontFamily: "monospace", fontSize: "9px", letterSpacing: "0.15em" }}>
          REMINDERS
        </span>
        <span style={{ color: "rgba(0,200,255,0.4)", fontFamily: "monospace", fontSize: "9px" }}>
          {reminders.length}
        </span>
      </div>

      <div style={{ padding: "4px 6px", maxHeight: "120px", overflowY: "auto" }}>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "6px" }}>
            <span style={{ color: "rgba(0,200,255,0.3)", fontFamily: "monospace", fontSize: "9px" }}>LOADING...</span>
          </div>
        ) : reminders.length === 0 ? (
          <div style={{ textAlign: "center", padding: "6px" }}>
            <span style={{ color: "rgba(0,200,255,0.25)", fontFamily: "monospace", fontSize: "9px" }}>NO PENDING REMINDERS</span>
          </div>
        ) : (
          reminders.map((r) => {
            const dueDate = new Date(r.dueAt);
            const timeStr = dueDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const dateStr = dueDate.toLocaleDateString([], { month: "short", day: "numeric" });
            const isToday = dueDate.toDateString() === new Date().toDateString();

            return (
              <div
                key={r.id}
                style={{
                  padding: "4px 2px",
                  borderBottom: "1px solid rgba(0,200,255,0.07)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "4px",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "rgba(0,220,255,0.85)", fontFamily: "monospace", fontSize: "9px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.text}
                  </div>
                  <div style={{ color: "rgba(0,200,255,0.4)", fontFamily: "monospace", fontSize: "8px", marginTop: "1px" }}>
                    {isToday ? timeStr : `${dateStr} ${timeStr}`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "2px", flexShrink: 0 }}>
                  <button
                    onClick={() => snoozeMutation.mutate({ id: r.id, minutes: 10 })}
                    title="Snooze 10 min"
                    style={{
                      padding: "1px 3px",
                      fontFamily: "monospace",
                      fontSize: "8px",
                      color: "rgba(0,200,255,0.5)",
                      background: "transparent",
                      border: "1px solid rgba(0,200,255,0.2)",
                      borderRadius: "1px",
                      cursor: "pointer",
                    }}
                  >
                    ZZ
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate({ id: r.id })}
                    title="Delete"
                    style={{
                      padding: "1px 3px",
                      fontFamily: "monospace",
                      fontSize: "8px",
                      color: "rgba(255,80,80,0.5)",
                      background: "transparent",
                      border: "1px solid rgba(255,80,80,0.2)",
                      borderRadius: "1px",
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
