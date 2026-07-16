/**
 * Integration token persistence helpers.
 * Stores/retrieves tokens for GitHub, Discord, Slack, and Home Assistant
 * in the `integration_tokens` table.
 *
 * NOTE: During Phase A (single-owner mode), userId defaults to 0.
 * When multi-tenant auth is complete, callers should pass ctx.user.id.
 */

import {
  upsertIntegrationToken as dbUpsert,
  getIntegrationToken as dbGet,
  deleteIntegrationToken as dbDelete,
} from "./db";

export type IntegrationService = "github" | "discord" | "slack" | "home_assistant";

/** Save or update a token for an integration. `extra` is optional (e.g. HA base URL). */
export async function upsertIntegrationToken(
  service: IntegrationService,
  token: string,
  extra?: string
): Promise<void> {
  await dbUpsert(0, service, token, extra);
}

/** Retrieve the stored token (and optional extra) for an integration. Returns null if not found. */
export async function getIntegrationToken(
  service: IntegrationService
): Promise<{ token: string; extra: string | null } | null> {
  const result = await dbGet(0, service);
  if (!result) return null;
  return { token: result.token, extra: result.extra ?? null };
}

/** Remove the stored token for an integration (on disconnect). */
export async function deleteIntegrationToken(service: IntegrationService): Promise<void> {
  await dbDelete(0, service);
}

/** Restore all integration tokens from DB into their respective in-memory modules. */
export async function restoreAllIntegrationTokens(): Promise<void> {
  // Import lazily to avoid circular deps at module load time
  const { setGithubToken } = await import("./github");
  const { setDiscordBotToken } = await import("./discordBot");
  const { setSlackToken } = await import("./slack");
  const { setHomeAssistantConfig } = await import("./homeAssistant");

  try {
    const github = await getIntegrationToken("github");
    if (github?.token) {
      setGithubToken(github.token);
      console.log("[Integrations] Restored GitHub token from database.");
    }
  } catch (e) {
    console.warn("[Integrations] Could not restore GitHub token:", e);
  }

  try {
    const discord = await getIntegrationToken("discord");
    if (discord?.token) {
      setDiscordBotToken(discord.token);
      console.log("[Integrations] Restored Discord bot token from database.");
    }
  } catch (e) {
    console.warn("[Integrations] Could not restore Discord token:", e);
  }

  try {
    const slack = await getIntegrationToken("slack");
    if (slack?.token) {
      setSlackToken(slack.token);
      console.log("[Integrations] Restored Slack bot token from database.");
    }
  } catch (e) {
    console.warn("[Integrations] Could not restore Slack token:", e);
  }

  try {
    const ha = await getIntegrationToken("home_assistant");
    if (ha?.token && ha?.extra) {
      setHomeAssistantConfig(ha.extra, ha.token);
      console.log("[Integrations] Restored Home Assistant config from database.");
    }
  } catch (e) {
    console.warn("[Integrations] Could not restore Home Assistant config:", e);
  }
}
