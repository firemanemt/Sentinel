/**
 * Discord Bot integration for SENTINEL
 * Per-user token model: token is loaded from DB on each request.
 * No global singleton — fully multi-tenant.
 */

import { ENV } from "./_core/env";
import { getIntegrationToken, upsertIntegrationToken, deleteIntegrationToken } from "./db";

const DISCORD_API = "https://discord.com/api/v10";
const SERVICE = "discord";

// ── Legacy singleton (kept for backward compat) ──
let _legacyToken: string = ENV.discordBotToken;

export function setDiscordBotToken(token: string) {
  _legacyToken = token;
}

export function getDiscordBotToken(): string {
  return _legacyToken;
}

export function isDiscordConnected(): boolean {
  return _legacyToken.trim().length > 0;
}

/** Check if a specific user has Discord connected. */
export async function isDiscordConnectedForUser(userId: number): Promise<boolean> {
  const row = await getIntegrationToken(userId, SERVICE);
  return row !== null && row.token.trim().length > 0;
}

/** Save a Discord bot token for a user. */
export async function saveDiscordToken(userId: number, token: string): Promise<void> {
  await upsertIntegrationToken(userId, SERVICE, token);
  if (userId === 0) _legacyToken = token;
}

/** Disconnect Discord for a user. */
export async function disconnectDiscord(userId: number): Promise<void> {
  await deleteIntegrationToken(userId, SERVICE);
  if (userId === 0) _legacyToken = "";
}

async function getTokenForUser(userId: number): Promise<string> {
  const row = await getIntegrationToken(userId, SERVICE);
  if (row?.token?.trim()) return row.token;
  if (ENV.discordBotToken.trim()) return ENV.discordBotToken;
  throw new Error("Discord bot not connected — please provide a Bot Token.");
}

async function discordRequest<T>(userId: number, path: string, options: RequestInit = {}): Promise<T> {
  const token = await getTokenForUser(userId);

  const res = await fetch(`${DISCORD_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Discord API error ${res.status}: ${err}`);
  }

  return res.json() as Promise<T>;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  member_count?: number;
  approximate_member_count?: number;
}

export interface DiscordChannel {
  id: string;
  type: number;
  name: string;
  topic?: string | null;
  position: number;
  parent_id?: string | null;
  nsfw?: boolean;
}

export interface DiscordMessage {
  id: string;
  content: string;
  timestamp: string;
  edited_timestamp: string | null;
  author: {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    bot?: boolean;
  };
  attachments: { id: string; filename: string; url: string }[];
  embeds: { title?: string; description?: string; url?: string }[];
  reactions?: { count: number; emoji: { name: string } }[];
  pinned: boolean;
}

export interface DiscordBotUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  bot: boolean;
}

// ── API Methods ───────────────────────────────────────────────────────────────

export async function getBotUser(userId = 0): Promise<DiscordBotUser> {
  return discordRequest<DiscordBotUser>(userId, "/users/@me");
}

export async function getGuilds(userId = 0): Promise<DiscordGuild[]> {
  return discordRequest<DiscordGuild[]>(userId, "/users/@me/guilds?with_counts=true");
}

export async function getGuildChannels(userId = 0, guildId: string): Promise<DiscordChannel[]> {
  const channels = await discordRequest<DiscordChannel[]>(userId, `/guilds/${guildId}/channels`);
  return channels
    .filter((c) => c.type === 0 || c.type === 5)
    .sort((a, b) => a.position - b.position);
}

export async function getMessages(userId = 0, channelId: string, limit = 20): Promise<DiscordMessage[]> {
  return discordRequest<DiscordMessage[]>(userId, `/channels/${channelId}/messages?limit=${Math.min(100, limit)}`);
}

export async function sendMessage(userId = 0, channelId: string, content: string): Promise<DiscordMessage> {
  return discordRequest<DiscordMessage>(userId, `/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function getPinnedMessages(userId = 0, channelId: string): Promise<DiscordMessage[]> {
  return discordRequest<DiscordMessage[]>(userId, `/channels/${channelId}/pins`);
}

export function getAvatarUrl(userId: string, avatarHash: string | null): string {
  if (!avatarHash) return `https://cdn.discordapp.com/embed/avatars/${parseInt(userId) % 5}.png`;
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=64`;
}
