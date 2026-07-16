/**
 * Slack integration for SENTINEL
 * Per-user token model: token is loaded from DB on each request.
 * No global singleton — fully multi-tenant.
 */

import { ENV } from "./_core/env";
import { getIntegrationToken, upsertIntegrationToken, deleteIntegrationToken } from "./db";

const SLACK_API = "https://slack.com/api";
const SERVICE = "slack";

// ── Legacy singleton (kept for backward compat) ──
let _legacyToken: string = ENV.slackBotToken;

export function setSlackToken(token: string) {
  _legacyToken = token;
}

export function getSlackToken(): string {
  return _legacyToken;
}

export function isSlackConnected(): boolean {
  return _legacyToken.trim().length > 0;
}

/** Check if a specific user has Slack connected. */
export async function isSlackConnectedForUser(userId: number): Promise<boolean> {
  const row = await getIntegrationToken(userId, SERVICE);
  return row !== null && row.token.trim().length > 0;
}

/** Save a Slack bot token for a user. */
export async function saveSlackToken(userId: number, token: string): Promise<void> {
  await upsertIntegrationToken(userId, SERVICE, token);
  if (userId === 0) _legacyToken = token;
}

/** Disconnect Slack for a user. */
export async function disconnectSlack(userId: number): Promise<void> {
  await deleteIntegrationToken(userId, SERVICE);
  if (userId === 0) _legacyToken = "";
}

async function getTokenForUser(userId: number): Promise<string> {
  const row = await getIntegrationToken(userId, SERVICE);
  if (row?.token?.trim()) return row.token;
  if (ENV.slackBotToken.trim()) return ENV.slackBotToken;
  throw new Error("Slack not connected — please provide a Bot Token.");
}

async function slackRequest<T>(userId: number, method: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
  const token = await getTokenForUser(userId);
  const url = new URL(`${SLACK_API}/${method}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) throw new Error(`Slack HTTP error ${res.status}`);
  const data = await res.json() as { ok: boolean; error?: string } & T;
  if (!data.ok) throw new Error(`Slack API error: ${data.error ?? "unknown"}`);
  return data;
}

async function slackPost<T>(userId: number, method: string, body: Record<string, unknown>): Promise<T> {
  const token = await getTokenForUser(userId);

  const res = await fetch(`${SLACK_API}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Slack HTTP error ${res.status}`);
  const data = await res.json() as { ok: boolean; error?: string } & T;
  if (!data.ok) throw new Error(`Slack API error: ${data.error ?? "unknown"}`);
  return data;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_private: boolean;
  is_member: boolean;
  num_members: number;
  topic: { value: string };
  purpose: { value: string };
}

export interface SlackMessage {
  ts: string;
  type: string;
  text: string;
  user?: string;
  username?: string;
  bot_id?: string;
  reactions?: { name: string; count: number }[];
  files?: { name: string; mimetype: string; url_private: string }[];
}

export interface SlackUser {
  id: string;
  name: string;
  real_name: string;
  profile: {
    display_name: string;
    image_48: string;
    email?: string;
  };
}

export interface SlackWorkspace {
  id: string;
  name: string;
  domain: string;
  icon: { image_68: string };
}

// ── API Methods ───────────────────────────────────────────────────────────────

export async function getWorkspaceInfo(userId = 0): Promise<SlackWorkspace> {
  const data = await slackRequest<{ team: SlackWorkspace }>(userId, "team.info");
  return data.team;
}

export async function getChannels(userId = 0, excludeArchived = true): Promise<SlackChannel[]> {
  const data = await slackRequest<{ channels: SlackChannel[] }>(userId, "conversations.list", {
    exclude_archived: excludeArchived,
    types: "public_channel,private_channel",
    limit: 100,
  });
  return data.channels ?? [];
}

export async function getMessages(userId = 0, channelId: string, limit = 20): Promise<SlackMessage[]> {
  const data = await slackRequest<{ messages: SlackMessage[] }>(userId, "conversations.history", {
    channel: channelId,
    limit,
  });
  return data.messages ?? [];
}

export async function sendMessage(userId = 0, channelId: string, text: string): Promise<{ ts: string }> {
  const data = await slackPost<{ ts: string }>(userId, "chat.postMessage", {
    channel: channelId,
    text,
  });
  return { ts: data.ts };
}

export async function getUserInfo(userId = 0, slackUserId: string): Promise<SlackUser> {
  const data = await slackRequest<{ user: SlackUser }>(userId, "users.info", { user: slackUserId });
  return data.user;
}

export async function getUnreadMentions(userId = 0, channelId: string): Promise<number> {
  try {
    const data = await slackRequest<{ channel: { unread_count_display: number } }>(
      userId, "conversations.info", { channel: channelId }
    );
    return data.channel?.unread_count_display ?? 0;
  } catch {
    return 0;
  }
}
