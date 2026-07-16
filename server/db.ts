import { desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { and, eq, gte, lte } from "drizzle-orm";
import {
  conversationMessages,
  googleOAuthTokens,
  microsoftOAuthTokens,
  appleCalDavCredentials,
  InsertConversationMessage,
  InsertReminder,
  InsertUser,
  reminders,
  users,
  userPreferences,
  discordLostPetCases,
  integrationTokens,
  spotifyOAuthTokens,
  morningRoutineConfig,
} from "../drizzle/schema";
import type { UserPreferences } from "../drizzle/schema";
import { ENV } from './_core/env';
import type { GoogleTokens } from './googleCalendar';
import type { MicrosoftTokens } from './outlookCalendar';
import type { AppleCalDavConfig } from './appleCalendar';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ---- User helpers ----

export async function upsertUser(user: InsertUser): Promise<void> {
  // Require either email or openId
  if (!user.email && !user.openId) throw new Error("User email or openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = {};
    if (user.email) values.email = user.email;
    if (user.openId) values.openId = user.openId;
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "openId", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      values[field] = (value ?? null) as InsertUser[TextField];
      updateSet[field] = value ?? null;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.email === ENV.adminEmail) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get user: database not available"); return undefined; }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ---- Conversation history helpers ----

export async function saveMessage(msg: InsertConversationMessage): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(conversationMessages).values(msg);
}

export async function getSessionMessages(userId: number, sessionId: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(conversationMessages)
    .where(and(eq(conversationMessages.userId, userId), eq(conversationMessages.sessionId, sessionId)))
    .orderBy(desc(conversationMessages.createdAt))
    .limit(limit);
  return rows.reverse();
}

export async function clearSessionMessages(userId: number, sessionId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(conversationMessages).where(and(eq(conversationMessages.userId, userId), eq(conversationMessages.sessionId, sessionId)));
}

export async function getRecentSessions(userId: number, limit = 5): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .selectDistinct({ sessionId: conversationMessages.sessionId })
    .from(conversationMessages)
    .where(eq(conversationMessages.userId, userId))
    .orderBy(desc(conversationMessages.createdAt))
    .limit(limit);
  return rows.map(r => r.sessionId);
}

// ---- Google OAuth token persistence ----

export async function saveGoogleTokens(userId: number, tokens: GoogleTokens): Promise<void> {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot save Google tokens: database not available"); return; }
  try {
    await db.insert(googleOAuthTokens).values({
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiryDate: tokens.expiry_date != null ? String(tokens.expiry_date) : null,
      tokenType: tokens.token_type ?? null,
      scope: tokens.scope ?? null,
    }).onDuplicateKeyUpdate({
      set: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiryDate: tokens.expiry_date != null ? String(tokens.expiry_date) : null,
        tokenType: tokens.token_type ?? null,
        scope: tokens.scope ?? null,
      },
    });
    console.log("[Database] Google Calendar tokens saved to DB");
  } catch (error) { console.error("[Database] Failed to save Google tokens:", error); }
}

export async function loadGoogleTokens(userId: number): Promise<GoogleTokens | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db.select().from(googleOAuthTokens).where(eq(googleOAuthTokens.userId, userId)).limit(1);
    if (rows.length === 0 || !rows[0]) return null;
    const row = rows[0];
    return {
      access_token: row.accessToken,
      refresh_token: row.refreshToken ?? undefined,
      expiry_date: row.expiryDate ? Number(row.expiryDate) : undefined,
      token_type: row.tokenType ?? undefined,
      scope: row.scope ?? undefined,
    };
  } catch (error) { console.error("[Database] Failed to load Google tokens:", error); return null; }
}

export async function deleteGoogleTokens(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.delete(googleOAuthTokens).where(eq(googleOAuthTokens.userId, userId));
    console.log("[Database] Google Calendar tokens deleted from DB");
  } catch (error) { console.error("[Database] Failed to delete Google tokens:", error); }
}

// ---- Spotify OAuth token persistence ----

export async function saveSpotifyTokens(userId: number, tokens: { access_token: string; refresh_token?: string; expiry_date?: number; token_type?: string; scope?: string }): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(spotifyOAuthTokens).values({
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiryDate: tokens.expiry_date != null ? String(tokens.expiry_date) : null,
      tokenType: tokens.token_type ?? null,
      scope: tokens.scope ?? null,
    }).onDuplicateKeyUpdate({
      set: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiryDate: tokens.expiry_date != null ? String(tokens.expiry_date) : null,
        tokenType: tokens.token_type ?? null,
        scope: tokens.scope ?? null,
      },
    });
  } catch (error) { console.error("[Database] Failed to save Spotify tokens:", error); }
}

export async function loadSpotifyTokens(userId: number): Promise<{ access_token: string; refresh_token?: string; expiry_date?: number; token_type?: string; scope?: string } | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db.select().from(spotifyOAuthTokens).where(eq(spotifyOAuthTokens.userId, userId)).limit(1);
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      access_token: row.accessToken,
      refresh_token: row.refreshToken ?? undefined,
      expiry_date: row.expiryDate ? Number(row.expiryDate) : undefined,
      token_type: row.tokenType ?? undefined,
      scope: row.scope ?? undefined,
    };
  } catch (error) { console.error("[Database] Failed to load Spotify tokens:", error); return null; }
}

export async function deleteSpotifyTokens(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.delete(spotifyOAuthTokens).where(eq(spotifyOAuthTokens.userId, userId));
  } catch (error) { console.error("[Database] Failed to delete Spotify tokens:", error); }
}

// ---- Microsoft OAuth token persistence ----

export async function saveMicrosoftTokens(userId: number, tokens: MicrosoftTokens): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(microsoftOAuthTokens).values({
      userId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? null,
      expiryDate: tokens.expiryDate ?? null,
      tokenType: tokens.tokenType ?? null,
      scope: tokens.scope ?? null,
    }).onDuplicateKeyUpdate({
      set: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? null,
        expiryDate: tokens.expiryDate ?? null,
        tokenType: tokens.tokenType ?? null,
        scope: tokens.scope ?? null,
      },
    });
    console.log("[Database] Microsoft Calendar tokens saved to DB");
  } catch (error) { console.error("[Database] Failed to save Microsoft tokens:", error); }
}

export async function loadMicrosoftTokens(userId: number): Promise<MicrosoftTokens | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db.select().from(microsoftOAuthTokens).where(eq(microsoftOAuthTokens.userId, userId)).limit(1);
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      accessToken: row.accessToken,
      refreshToken: row.refreshToken ?? undefined,
      expiryDate: row.expiryDate ?? undefined,
      tokenType: row.tokenType ?? undefined,
      scope: row.scope ?? undefined,
    };
  } catch (error) { console.error("[Database] Failed to load Microsoft tokens:", error); return null; }
}

export async function deleteMicrosoftTokens(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.delete(microsoftOAuthTokens).where(eq(microsoftOAuthTokens.userId, userId));
    console.log("[Database] Microsoft Calendar tokens deleted from DB");
  } catch (error) { console.error("[Database] Failed to delete Microsoft tokens:", error); }
}

// ---- Apple CalDAV credential persistence ----

export async function saveAppleCalDavConfig(userId: number, config: AppleCalDavConfig): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(appleCalDavCredentials).values({
      userId,
      appleId: config.appleId,
      appPassword: config.appPassword,
      serverUrl: config.serverUrl ?? null,
    }).onDuplicateKeyUpdate({
      set: {
        appleId: config.appleId,
        appPassword: config.appPassword,
        serverUrl: config.serverUrl ?? null,
      },
    });
    console.log("[Database] Apple CalDAV credentials saved to DB");
  } catch (error) { console.error("[Database] Failed to save Apple CalDAV credentials:", error); }
}

export async function loadAppleCalDavConfig(userId: number): Promise<AppleCalDavConfig | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db.select().from(appleCalDavCredentials).where(eq(appleCalDavCredentials.userId, userId)).limit(1);
    if (!rows[0]) return null;
    const row = rows[0];
    return { appleId: row.appleId, appPassword: row.appPassword, serverUrl: row.serverUrl ?? undefined };
  } catch (error) { console.error("[Database] Failed to load Apple CalDAV credentials:", error); return null; }
}

export async function deleteAppleCalDavConfig(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.delete(appleCalDavCredentials).where(eq(appleCalDavCredentials.userId, userId));
    console.log("[Database] Apple CalDAV credentials deleted from DB");
  } catch (error) { console.error("[Database] Failed to delete Apple CalDAV credentials:", error); }
}

// ---- Reminder helpers ----

export async function createReminder(userId: number, reminder: Omit<InsertReminder, 'userId'>): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(reminders).values({ ...reminder, userId });
  return (result as unknown as { insertId: number }).insertId;
}

export async function getPendingReminders(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db.select().from(reminders).where(and(eq(reminders.userId, userId), eq(reminders.fired, 0), lte(reminders.dueAt, now)));
}

export async function markReminderFired(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(reminders).set({ fired: 1 }).where(eq(reminders.id, id));
}

export async function getUpcomingReminders(userId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db.select().from(reminders)
    .where(and(eq(reminders.userId, userId), eq(reminders.fired, 0), gte(reminders.dueAt, now)))
    .orderBy(reminders.dueAt)
    .limit(limit);
}

export async function deleteReminder(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(reminders).where(eq(reminders.id, id));
}

export async function snoozeReminder(id: number, minutes: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const [existing] = await db.select().from(reminders).where(eq(reminders.id, id)).limit(1);
  if (!existing) throw new Error(`Reminder ${id} not found`);
  const newDueAt = new Date(existing.dueAt.getTime() + minutes * 60 * 1000);
  await db.update(reminders).set({ dueAt: newDueAt, fired: 0 }).where(eq(reminders.id, id));
}

// ── User Preferences ─────────────────────────────────────────────────────────

export async function loadUserPreferences(userId: number): Promise<Partial<UserPreferences>> {
  const db = await getDb();
  if (!db) return {};
  try {
    const rows = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
    return rows[0] ?? {};
  } catch (error) { console.error("[Database] Failed to load user preferences:", error); return {}; }
}

export async function saveUserPreferences(userId: number, prefs: {
  homeZipCode?: string | null;
  preferredVoiceKey?: string | null;
  preferredLayout?: string | null;
  speechRate?: string | null;
  reverbIntensity?: string | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(userPreferences).values({ userId, ...prefs }).onDuplicateKeyUpdate({ set: prefs });
  } catch (error) { console.error("[Database] Failed to save user preferences:", error); }
}

// ── Memory / Facts ─────────────────────────────────────────────────────────

export interface SentinelFact {
  key: string;
  value: string;
  updatedAt: number;
}

export async function loadFacts(userId: number): Promise<SentinelFact[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
    const row = rows[0];
    if (!row?.extraData) return [];
    const parsed = JSON.parse(row.extraData) as { facts?: SentinelFact[] };
    return parsed.facts ?? [];
  } catch { return []; }
}

export async function saveFact(userId: number, key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    const existing = await loadFacts(userId);
    const now = Date.now();
    const idx = existing.findIndex(f => f.key === key);
    if (idx >= 0) { existing[idx] = { key, value, updatedAt: now }; }
    else { existing.push({ key, value, updatedAt: now }); }
    existing.sort((a, b) => b.updatedAt - a.updatedAt);
    const trimmed = existing.slice(0, 50);
    const extraData = JSON.stringify({ facts: trimmed });
    await db.insert(userPreferences).values({ userId, extraData }).onDuplicateKeyUpdate({ set: { extraData } });
  } catch (error) { console.error("[Database] Failed to save fact:", error); }
}

export async function deleteFact(userId: number, factKey: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    const existing = await loadFacts(userId);
    const filtered = existing.filter(f => f.key !== factKey);
    const extraData = JSON.stringify({ facts: filtered });
    await db.insert(userPreferences).values({ userId, extraData }).onDuplicateKeyUpdate({ set: { extraData } });
  } catch (error) { console.error("[Database] Failed to delete fact:", error); }
}

// ── Morning Routine Config ─────────────────────────────────────────────────

export async function loadMorningConfig(userId: number) {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db.select().from(morningRoutineConfig).where(eq(morningRoutineConfig.userId, userId)).limit(1);
    return rows[0] ?? null;
  } catch (error) { console.error("[Database] Failed to load morning config:", error); return null; }
}

export async function saveMorningConfig(userId: number, config: {
  sections?: string;
  wakeTime?: string;
  musicQuery?: string;
  customGreeting?: string;
  readAloud?: number;
  weatherLocation?: string | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(morningRoutineConfig).values({ userId, ...config }).onDuplicateKeyUpdate({ set: config });
  } catch (error) { console.error("[Database] Failed to save morning config:", error); }
}

// ── Integration Tokens (GitHub, Discord, Slack, Home Assistant) ────────────

export async function upsertIntegrationToken(userId: number, service: string, token: string, extra?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(integrationTokens).values({ userId, service, token, extra: extra ?? null })
      .onDuplicateKeyUpdate({ set: { token, extra: extra ?? null } });
  } catch (error) { console.error(`[Database] Failed to upsert integration token for ${service}:`, error); }
}

export async function getIntegrationToken(userId: number, service: string): Promise<{ token: string; extra?: string | null } | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db.select().from(integrationTokens)
      .where(and(eq(integrationTokens.userId, userId), eq(integrationTokens.service, service)))
      .limit(1);
    if (!rows[0]) return null;
    return { token: rows[0].token, extra: rows[0].extra };
  } catch (error) { console.error(`[Database] Failed to get integration token for ${service}:`, error); return null; }
}

export async function deleteIntegrationToken(userId: number, service: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.delete(integrationTokens).where(and(eq(integrationTokens.userId, userId), eq(integrationTokens.service, service)));
  } catch (error) { console.error(`[Database] Failed to delete integration token for ${service}:`, error); }
}

// ── Discord Lost Pet Cases (shared, not user-scoped) ──────────────────────

export async function upsertDiscordLostPetCase(data: typeof discordLostPetCases.$inferInsert): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(discordLostPetCases).values(data).onDuplicateKeyUpdate({ set: data });
  } catch (error) { console.error("[Database] Failed to upsert discord lost pet case:", error); }
}

export async function getDiscordLostPetCases(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(discordLostPetCases).orderBy(desc(discordLostPetCases.fetchedAt)).limit(limit);
}

export async function searchLostPetCases(query: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const all = await db.select().from(discordLostPetCases).orderBy(desc(discordLostPetCases.fetchedAt)).limit(200);
  const q = query.toLowerCase();
  const filtered = all.filter(c =>
    (c.petType && c.petType.toLowerCase().includes(q)) ||
    (c.location && c.location.toLowerCase().includes(q)) ||
    (c.ownerName && c.ownerName.toLowerCase().includes(q)) ||
    (c.description && c.description.toLowerCase().includes(q))
  );
  return filtered.slice(0, limit);
}
