/**
 * Apple Calendar integration via CalDAV (iCloud)
 * Uses tsdav to connect to Apple's CalDAV server with an app-specific password
 */
import { createDAVClient } from "tsdav";
import type { CalendarEvent } from "./outlookCalendar";

export interface AppleCalDavConfig {
  appleId: string;       // Apple ID email address
  appPassword: string;   // App-specific password from appleid.apple.com
  serverUrl?: string;    // Default: https://caldav.icloud.com
}

const APPLE_CALDAV_URL = "https://caldav.icloud.com";

// In-memory config store
let _config: AppleCalDavConfig | null = null;

export function saveAppleConfig(config: AppleCalDavConfig | null): void {
  _config = config;
}

export function isAppleConnected(): boolean {
  return _config !== null && !!_config.appleId && !!_config.appPassword;
}

export function getAppleConfig(): AppleCalDavConfig | null {
  return _config;
}

/** Create an authenticated DAV client */
async function createClient(config: AppleCalDavConfig) {
  const serverUrl = config.serverUrl ?? APPLE_CALDAV_URL;
  return createDAVClient({
    serverUrl,
    credentials: {
      username: config.appleId,
      password: config.appPassword,
    },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
}

/** Fetch Apple Calendar events for a date range */
export async function getAppleEvents(
  startDateTime: string,
  endDateTime: string
): Promise<CalendarEvent[]> {
  if (!_config) throw new Error("Apple Calendar not connected");

  const client = await createClient(_config);

  // Discover calendars
  const calendars = await client.fetchCalendars();
  if (!calendars.length) return [];

  const allEvents: CalendarEvent[] = [];

  for (const calendar of calendars) {
    try {
      const objects = await client.fetchCalendarObjects({
        calendar,
        timeRange: {
          start: new Date(startDateTime).toISOString(),
          end: new Date(endDateTime).toISOString(),
        },
      });

      for (const obj of objects) {
        if (!obj.data) continue;
        const icsString = typeof obj.data === "string" ? obj.data : JSON.stringify(obj.data);
        const calName = typeof calendar.displayName === "string" ? calendar.displayName : "iCloud";
        const parsed = parseICalData(icsString, calName);
        allEvents.push(...parsed);
      }
    } catch {
      // Skip calendars that fail (e.g., reminders calendar)
    }
  }

  // Sort by start time
  allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return allEvents;
}

/** Fetch today's Apple Calendar events */
export async function getAppleTodayEvents(): Promise<CalendarEvent[]> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return getAppleEvents(start.toISOString(), end.toISOString());
}

/** Create a new Apple Calendar event */
export async function createAppleEvent(input: {
  title: string;
  startDateTime: string;
  endDateTime: string;
  location?: string;
  description?: string;
}): Promise<CalendarEvent> {
  if (!_config) throw new Error("Apple Calendar not connected");

  const client = await createClient(_config);
  const calendars = await client.fetchCalendars();

  // Use the first writable calendar
  const calendar = calendars[0];
  if (!calendar) throw new Error("No Apple Calendar found");

  const uid = `sentinel-${Date.now()}@sentinel.local`;
  const now = formatICalDate(new Date());
  const start = formatICalDate(new Date(input.startDateTime));
  const end = formatICalDate(new Date(input.endDateTime));

  const icsData = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SENTINEL//SENTINEL Calendar//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeICalText(input.title)}`,
    ...(input.location ? [`LOCATION:${escapeICalText(input.location)}`] : []),
    ...(input.description ? [`DESCRIPTION:${escapeICalText(input.description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  await client.createCalendarObject({
    calendar,
    filename: `${uid}.ics`,
    iCalString: icsData,
  });

  return {
    id: uid,
    title: input.title,
    start: input.startDateTime,
    end: input.endDateTime,
    location: input.location,
    description: input.description,
    isAllDay: false,
    source: "apple",
  };
}

// ── iCal helpers ─────────────────────────────────────────────────────────────

function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeICalText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function parseICalDate(value: string): string {
  // Handle TZID= prefix
  const raw = value.includes(":") ? value.split(":")[1] ?? value : value;
  if (raw.length === 8) {
    // All-day: YYYYMMDD
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00.000Z`;
  }
  // YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS
  const y = raw.slice(0, 4);
  const mo = raw.slice(4, 6);
  const d = raw.slice(6, 8);
  const h = raw.slice(9, 11);
  const mi = raw.slice(11, 13);
  const s = raw.slice(13, 15);
  return `${y}-${mo}-${d}T${h}:${mi}:${s}.000Z`;
}

function parseICalData(icsData: string, calendarName: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const lines = icsData.replace(/\r\n /g, "").replace(/\r\n\t/g, "").split(/\r\n|\n|\r/);

  let inEvent = false;
  let current: Partial<CalendarEvent & { uid: string }> = {};

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = { source: "apple" as const };
      continue;
    }
    if (line === "END:VEVENT") {
      if (current.title && current.start && current.end) {
        events.push({
          id: current.uid ?? `apple-${Date.now()}-${Math.random()}`,
          title: current.title,
          start: current.start,
          end: current.end,
          location: current.location,
          description: current.description,
          isAllDay: current.isAllDay ?? false,
          source: "apple",
        });
      }
      inEvent = false;
      current = {};
      continue;
    }

    if (!inEvent) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const key = line.slice(0, colonIdx).split(";")[0]?.toUpperCase() ?? "";
    const value = line.slice(colonIdx + 1).trim();

    switch (key) {
      case "UID":
        current.uid = value;
        break;
      case "SUMMARY":
        current.title = value.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";");
        break;
      case "DTSTART":
        current.start = parseICalDate(line.slice(colonIdx + 1));
        current.isAllDay = !line.includes("T");
        break;
      case "DTEND":
        current.end = parseICalDate(line.slice(colonIdx + 1));
        break;
      case "LOCATION":
        current.location = value.replace(/\\n/g, "\n").replace(/\\,/g, ",");
        break;
      case "DESCRIPTION":
        current.description = value.replace(/\\n/g, "\n").replace(/\\,/g, ",");
        break;
    }
  }

  void calendarName; // used for context, not stored in event
  return events;
}
