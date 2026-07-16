/**
 * Morning Routine Configuration helpers.
 * Per-user row keyed by userId. Provides get/upsert helpers
 * and a typed config object used by the morning_briefing tool.
 */
import { getDb } from "./db";
import { morningRoutineConfig } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export interface MorningSection {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

export interface MorningConfig {
  sections: string[];          // enabled section IDs
  wakeTime: string;            // "HH:MM"
  musicQuery: string;          // Spotify search query
  customGreeting: string;      // e.g. "Good morning, sir"
  readAloud: boolean;          // whether to TTS the briefing
  weatherLocation: string | null;
}

export const ALL_SECTIONS: Omit<MorningSection, "enabled">[] = [
  { id: "weather",   label: "Weather",    description: "Current conditions, temperature, wind, and UV index" },
  { id: "alerts",    label: "NWS Alerts", description: "Active watches, warnings, and advisories (US only)" },
  { id: "forecast",  label: "Forecast",   description: "7-day weather outlook" },
  { id: "air",       label: "Air Quality",description: "AQI, PM2.5, ozone levels" },
  { id: "calendar",  label: "Calendar",   description: "Today's events and upcoming appointments" },
  { id: "email",     label: "Email",      description: "Unread email count and top subjects" },
  { id: "reminders", label: "Reminders",  description: "Upcoming reminders due today" },
  { id: "stocks",    label: "Stocks",     description: "Key market indices and watchlist quotes" },
  { id: "news",      label: "News",       description: "Top headlines" },
  { id: "spotify",   label: "Music",      description: "Play your wake-up track on Spotify" },
];

const DEFAULT_CONFIG: MorningConfig = {
  sections: ["weather", "alerts", "calendar", "email", "reminders"],
  wakeTime: "07:00",
  musicQuery: "Highway to Hell AC/DC",
  customGreeting: "Good morning, sir",
  readAloud: true,
  weatherLocation: null,
};

export async function getMorningConfig(userId: number): Promise<MorningConfig> {
  try {
    const db = await getDb();
    if (!db) return DEFAULT_CONFIG;
    const rows = await db
      .select()
      .from(morningRoutineConfig)
      .where(eq(morningRoutineConfig.userId, userId))
      .limit(1);

    if (!rows.length) return DEFAULT_CONFIG;

    const row = rows[0];
    let sections: string[] = DEFAULT_CONFIG.sections;
    try {
      const parsed = JSON.parse(row.sections);
      if (Array.isArray(parsed)) sections = parsed as string[];
    } catch { /* keep default */ }

    return {
      sections,
      wakeTime: row.wakeTime ?? DEFAULT_CONFIG.wakeTime,
      musicQuery: row.musicQuery ?? DEFAULT_CONFIG.musicQuery,
      customGreeting: row.customGreeting ?? DEFAULT_CONFIG.customGreeting,
      readAloud: row.readAloud === 1,
      weatherLocation: row.weatherLocation ?? null,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveMorningConfig(userId: number, config: Partial<MorningConfig>): Promise<MorningConfig> {
  const current = await getMorningConfig(userId);
  const merged: MorningConfig = { ...current, ...config };

  const row = {
    userId,
    sections: JSON.stringify(merged.sections),
    wakeTime: merged.wakeTime,
    musicQuery: merged.musicQuery,
    customGreeting: merged.customGreeting,
    readAloud: merged.readAloud ? 1 : 0,
    weatherLocation: merged.weatherLocation,
  };

  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .insert(morningRoutineConfig)
    .values(row)
    .onDuplicateKeyUpdate({ set: row });

  return merged;
}
