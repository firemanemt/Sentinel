import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** OAuth identifier (openId) returned from OAuth callbacks. Unique per user. Nullable for email-only auth. */
  openId: varchar("openId", { length: 64 }).unique(),
  /** Email address — required for all users. Unique. */
  email: varchar("email", { length: 320 }).notNull().unique(),
  /** Hashed password. Null for OAuth-only users. */
  password: text("password"),
  name: text("name"),
  loginMethod: varchar("loginMethod", { length: 64 }).default("email"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 64 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 64 }),
  subscriptionStatus: varchar("subscriptionStatus", { length: 32 }).default("free"), // 'free' | 'pro' | 'canceled'
  subscriptionPeriodEnd: timestamp("subscriptionPeriodEnd"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Conversation history for SENTINEL persistent memory
export const conversationMessages = mysqlTable("conversation_messages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Foreign key to users.id
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  toolsUsed: text("toolsUsed"), // JSON array of tool names
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type InsertConversationMessage = typeof conversationMessages.$inferInsert;

// Google OAuth tokens for persistent Calendar connection
export const googleOAuthTokens = mysqlTable("google_oauth_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(), // Foreign key to users.id — one token per user
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  expiryDate: text("expiryDate"), // stored as string (ms timestamp)
  tokenType: varchar("tokenType", { length: 32 }),
  scope: text("scope"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GoogleOAuthToken = typeof googleOAuthTokens.$inferSelect;
export type InsertGoogleOAuthToken = typeof googleOAuthTokens.$inferInsert;

// Spotify OAuth tokens for persistent music control
export const spotifyOAuthTokens = mysqlTable("spotify_oauth_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(), // Foreign key to users.id — one token per user
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  expiryDate: text("expiryDate"), // ms timestamp as string
  tokenType: varchar("tokenType", { length: 32 }),
  scope: text("scope"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SpotifyOAuthToken = typeof spotifyOAuthTokens.$inferSelect;
export type InsertSpotifyOAuthToken = typeof spotifyOAuthTokens.$inferInsert;

// Reminders for SENTINEL spoken alerts
export const reminders = mysqlTable("reminders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Foreign key to users.id
  text: text("text").notNull(),
  dueAt: timestamp("dueAt").notNull(),
  fired: int("fired").default(0).notNull(), // 0 = pending, 1 = fired
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Reminder = typeof reminders.$inferSelect;
export type InsertReminder = typeof reminders.$inferInsert;

// Persistent user preferences for SENTINEL
export const userPreferences = mysqlTable("user_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(), // Foreign key to users.id — one preferences row per user
  homeZipCode: varchar("homeZipCode", { length: 20 }),
  preferredVoiceKey: varchar("preferredVoiceKey", { length: 64 }),
  preferredLayout: varchar("preferredLayout", { length: 32 }),
  speechRate: text("speechRate"), // stored as string to avoid float precision issues
  reverbIntensity: text("reverbIntensity"),
  extraData: text("extraData"), // JSON blob for future extensibility (facts stored here)
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = typeof userPreferences.$inferInsert;

// Discord lost pet cases — monitored from #case-alerts channel
export const discordLostPetCases = mysqlTable("discord_lost_pet_cases", {
  id: int("id").autoincrement().primaryKey(),
  caseId: varchar("caseId", { length: 64 }).notNull().unique(), // e.g. "Case ID: 2622"
  messageId: varchar("messageId", { length: 64 }).notNull().unique(), // Discord message ID
  petType: varchar("petType", { length: 128 }), // "Lab mix", "Calico cat", etc.
  description: text("description"), // Full description of the pet
  lastSeen: text("lastSeen"), // Location and time
  ownerName: varchar("ownerName", { length: 256 }),
  ownerEmail: varchar("ownerEmail", { length: 320 }),
  ownerPhone: varchar("ownerPhone", { length: 32 }),
  location: text("location"), // Address
  status: varchar("status", { length: 64 }).default("unassigned"), // "unassigned", "claimed", "found", etc.
  postedAt: timestamp("postedAt"), // When the case was posted to Discord
  fetchedAt: timestamp("fetchedAt").defaultNow().notNull(), // When SENTINEL fetched it
  rawEmbed: text("rawEmbed"), // JSON blob of the full Discord embed for reference
});

export type DiscordLostPetCase = typeof discordLostPetCases.$inferSelect;
export type InsertDiscordLostPetCase = typeof discordLostPetCases.$inferInsert;

// Generic integration token/config storage (GitHub PAT, Discord bot token, Slack bot token, Home Assistant)
export const integrationTokens = mysqlTable("integration_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Foreign key to users.id
  /** Integration identifier, e.g. 'github', 'discord', 'slack', 'home_assistant' */
  service: varchar("service", { length: 64 }).notNull(),
  /** Primary token or API key (PAT, bot token, long-lived token) */
  token: text("token").notNull(),
  /** Optional secondary value — e.g. Home Assistant base URL */
  extra: text("extra"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IntegrationToken = typeof integrationTokens.$inferSelect;
export type InsertIntegrationToken = typeof integrationTokens.$inferInsert;

// Customizable morning routine configuration for SENTINEL briefing
export const morningRoutineConfig = mysqlTable("morning_routine_config", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(), // Foreign key to users.id — one config per user
  /** JSON array of enabled section IDs, e.g. ["weather","alerts","calendar","email","reminders","stocks","news"] */
  sections: text("sections").notNull().default('["weather","alerts","calendar","email","reminders"]'),
  /** Preferred wake time in HH:MM format, e.g. "07:00" */
  wakeTime: varchar("wakeTime", { length: 8 }).default("07:00"),
  /** Spotify search query to play during briefing, e.g. "Highway to Hell AC/DC" */
  musicQuery: text("musicQuery").default("Highway to Hell AC/DC"),
  /** Custom greeting prefix SENTINEL uses, e.g. "Good morning, boss" */
  customGreeting: text("customGreeting").default("Good morning, sir"),
  /** Whether to read the briefing aloud via ElevenLabs TTS */
  readAloud: int("readAloud").default(1).notNull(),
  /** Location override for weather (defaults to homeZipCode from userPreferences) */
  weatherLocation: text("weatherLocation"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MorningRoutineConfig = typeof morningRoutineConfig.$inferSelect;
export type InsertMorningRoutineConfig = typeof morningRoutineConfig.$inferInsert;

// Microsoft OAuth tokens for Outlook Calendar
export const microsoftOAuthTokens = mysqlTable("microsoft_oauth_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(), // Foreign key to users.id — one token per user
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  expiryDate: text("expiryDate"), // ms timestamp as string
  tokenType: varchar("tokenType", { length: 32 }),
  scope: text("scope"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MicrosoftOAuthToken = typeof microsoftOAuthTokens.$inferSelect;
export type InsertMicrosoftOAuthToken = typeof microsoftOAuthTokens.$inferInsert;

// Apple CalDAV credentials (App-Specific Password + iCloud URL)
export const appleCalDavCredentials = mysqlTable("apple_caldav_credentials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(), // Foreign key to users.id — one config per user
  appleId: varchar("appleId", { length: 320 }).notNull(), // Apple ID email
  appPassword: text("appPassword").notNull(), // App-specific password
  serverUrl: text("serverUrl"), // CalDAV server URL (default: caldav.icloud.com)
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppleCalDavCredential = typeof appleCalDavCredentials.$inferSelect;
export type InsertAppleCalDavCredential = typeof appleCalDavCredentials.$inferInsert;
