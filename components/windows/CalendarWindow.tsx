import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";

type Period = "today" | "week";
type Source = "google" | "outlook" | "apple";

interface CalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  isAllDay: boolean;
  source: Source;
}

const SOURCE_COLORS: Record<Source, string> = {
  google: "#4285F4",
  outlook: "#0078D4",
  apple: "#A2AAAD",
};

const SOURCE_LABELS: Record<Source, string> = {
  google: "Google",
  outlook: "Outlook",
  apple: "Apple",
};

const SOURCE_ICONS: Record<Source, string> = {
  google: "📅",
  outlook: "📆",
  apple: "🍎",
};

function formatTime(iso: string, isAllDay: boolean): string {
  if (isAllDay) return "All day";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function formatDateHeader(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  } catch {
    return iso;
  }
}

function groupByDate(events: CalEvent[]): Map<string, CalEvent[]> {
  const map = new Map<string, CalEvent[]>();
  for (const ev of events) {
    const key = ev.start.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return map;
}

export function CalendarWindow() {
  const [period, setPeriod] = useState<Period>("today");
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
  const [sourceFilter, setSourceFilter] = useState<Source | "all">("all");

  const { data: googleStatus } = trpc.sentinel.calendarStatus.useQuery();
  const { data: outlookStatus } = trpc.sentinel.outlookStatus.useQuery();
  const { data: appleStatus } = trpc.sentinel.appleCalendarStatus.useQuery();

  const { data: allEvents, isLoading, error } = trpc.sentinel.allCalendarEvents.useQuery(
    { period },
    { refetchInterval: 60_000 }
  );

  const connectedProviders = useMemo(() => {
    const p: Source[] = [];
    if (googleStatus?.connected) p.push("google");
    if (outlookStatus?.connected) p.push("outlook");
    if (appleStatus?.connected) p.push("apple");
    return p;
  }, [googleStatus, outlookStatus, appleStatus]);

  const filteredEvents = useMemo(() => {
    if (!allEvents) return [];
    return sourceFilter === "all"
      ? allEvents
      : allEvents.filter((e) => e.source === sourceFilter);
  }, [allEvents, sourceFilter]);

  const grouped = useMemo(() => groupByDate(filteredEvents as CalEvent[]), [filteredEvents]);

  const accent = "#00ccee";
  const border = "rgba(0,200,255,0.2)";

  const noneConnected = connectedProviders.length === 0;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "rgba(10, 25, 47, 0.95)",
        color: "#e0e0e0",
        fontFamily: "monospace",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${border}`,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ color: accent, fontSize: "14px", letterSpacing: "0.1em", margin: 0 }}>
            📅 CALENDAR
          </h2>
          <div style={{ fontSize: "10px", color: "rgba(0,200,255,0.4)", marginTop: "2px" }}>
            {connectedProviders.length === 0
              ? "No calendars connected"
              : connectedProviders.map((p) => SOURCE_ICONS[p] + " " + SOURCE_LABELS[p]).join(" · ")}
          </div>
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          {(["today", "week"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: "3px 10px",
                backgroundColor: period === p ? "rgba(0,200,255,0.15)" : "transparent",
                border: `1px solid ${period === p ? "rgba(0,200,255,0.5)" : border}`,
                borderRadius: "10px",
                color: period === p ? accent : "rgba(0,200,255,0.5)",
                cursor: "pointer",
                fontSize: "11px",
                transition: "all 0.15s",
              }}
            >
              {p === "today" ? "Today" : "This Week"}
            </button>
          ))}
        </div>
      </div>

      {/* Source filter */}
      {connectedProviders.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: "4px",
            padding: "8px 16px",
            borderBottom: `1px solid ${border}`,
            flexShrink: 0,
            overflowX: "auto",
          }}
        >
          {(["all", ...connectedProviders] as (Source | "all")[]).map((src) => (
            <button
              key={src}
              onClick={() => setSourceFilter(src)}
              style={{
                padding: "2px 8px",
                backgroundColor: sourceFilter === src ? "rgba(0,200,255,0.12)" : "transparent",
                border: `1px solid ${sourceFilter === src ? "rgba(0,200,255,0.4)" : border}`,
                borderRadius: "10px",
                color: sourceFilter === src ? accent : src === "all" ? "rgba(0,200,255,0.5)" : SOURCE_COLORS[src as Source],
                cursor: "pointer",
                fontSize: "10px",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
            >
              {src === "all" ? "All" : SOURCE_ICONS[src as Source] + " " + SOURCE_LABELS[src as Source]}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
        {noneConnected ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: "12px",
              color: "rgba(0,200,255,0.4)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "32px" }}>📅</div>
            <div style={{ fontSize: "13px" }}>No calendars connected</div>
            <div style={{ fontSize: "11px", maxWidth: "240px", lineHeight: "1.5" }}>
              Connect Google Calendar, Outlook, or Apple Calendar via the Integrations window to see
              your events here.
            </div>
          </div>
        ) : isLoading ? (
          <div style={{ color: "rgba(0,200,255,0.4)", fontSize: "12px", paddingTop: "20px", textAlign: "center" }}>
            Loading events…
          </div>
        ) : error ? (
          <div style={{ color: "#ff6666", fontSize: "12px", paddingTop: "20px" }}>
            Failed to load events: {error.message}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ color: "rgba(0,200,255,0.4)", fontSize: "12px", paddingTop: "20px", textAlign: "center" }}>
            No events {period === "today" ? "today" : "this week"}.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {Array.from(grouped.entries()).map(([dateKey, events]) => (
              <div key={dateKey}>
                {period === "week" && (
                  <div
                    style={{
                      fontSize: "11px",
                      color: accent,
                      letterSpacing: "0.08em",
                      marginBottom: "6px",
                      paddingBottom: "4px",
                      borderBottom: `1px solid ${border}`,
                    }}
                  >
                    {formatDateHeader(dateKey + "T12:00:00")}
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {events.map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() => setSelectedEvent(selectedEvent?.id === ev.id ? null : ev)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        padding: "10px 12px",
                        backgroundColor: selectedEvent?.id === ev.id ? "rgba(0,200,255,0.1)" : "rgba(0,100,150,0.08)",
                        border: `1px solid ${selectedEvent?.id === ev.id ? "rgba(0,200,255,0.35)" : border}`,
                        borderLeft: `3px solid ${SOURCE_COLORS[ev.source]}`,
                        borderRadius: "6px",
                        cursor: "pointer",
                        textAlign: "left",
                        width: "100%",
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#e0e0e0",
                            fontWeight: "bold",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {ev.title}
                        </div>
                        <div style={{ fontSize: "10px", color: "rgba(0,200,255,0.5)", marginTop: "2px" }}>
                          {formatTime(ev.start, ev.isAllDay)}
                          {!ev.isAllDay && ` – ${formatTime(ev.end, false)}`}
                          {ev.location && ` · 📍 ${ev.location}`}
                        </div>
                        {selectedEvent?.id === ev.id && ev.description && (
                          <div
                            style={{
                              fontSize: "10px",
                              color: "rgba(0,200,255,0.45)",
                              marginTop: "6px",
                              lineHeight: "1.4",
                              whiteSpace: "pre-wrap",
                              maxHeight: "80px",
                              overflow: "auto",
                            }}
                          >
                            {ev.description.slice(0, 300)}
                            {ev.description.length > 300 ? "…" : ""}
                          </div>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: "10px",
                          color: SOURCE_COLORS[ev.source],
                          opacity: 0.7,
                          flexShrink: 0,
                          marginTop: "1px",
                        }}
                      >
                        {SOURCE_ICONS[ev.source]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
