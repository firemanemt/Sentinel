/**
 * Integration module unit tests
 * Tests the connection state management and helper utilities
 * for GitHub, Slack, Discord bot, and Home Assistant.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── GitHub ────────────────────────────────────────────────────────────────────
describe("GitHub integration", () => {
  let github: typeof import("./github");

  beforeEach(async () => {
    vi.resetModules();
    github = await import("./github");
    github.setGithubToken(""); // reset to disconnected
  });

  it("reports disconnected when token is empty", () => {
    expect(github.isGithubConnected()).toBe(false);
  });

  it("reports connected after setting a token", () => {
    github.setGithubToken("ghp_testtoken123");
    expect(github.isGithubConnected()).toBe(true);
  });

  it("reports disconnected after clearing the token", () => {
    github.setGithubToken("ghp_testtoken123");
    github.setGithubToken("");
    expect(github.isGithubConnected()).toBe(false);
  });

  it("reports disconnected for whitespace-only token", () => {
    github.setGithubToken("   ");
    expect(github.isGithubConnected()).toBe(false);
  });
});

// ── Slack ─────────────────────────────────────────────────────────────────────
describe("Slack integration", () => {
  let slack: typeof import("./slack");

  beforeEach(async () => {
    vi.resetModules();
    slack = await import("./slack");
    slack.setSlackToken("");
  });

  it("reports disconnected when token is empty", () => {
    expect(slack.isSlackConnected()).toBe(false);
  });

  it("reports connected after setting a bot token", () => {
    slack.setSlackToken("xoxb-test-token");
    expect(slack.isSlackConnected()).toBe(true);
  });

  it("reports disconnected after clearing the token", () => {
    slack.setSlackToken("xoxb-test-token");
    slack.setSlackToken("");
    expect(slack.isSlackConnected()).toBe(false);
  });
});

// ── Discord Bot ───────────────────────────────────────────────────────────────
describe("Discord bot integration", () => {
  let discord: typeof import("./discordBot");

  beforeEach(async () => {
    vi.resetModules();
    discord = await import("./discordBot");
    discord.setDiscordBotToken("");
  });

  it("reports disconnected when token is empty", () => {
    expect(discord.isDiscordConnected()).toBe(false);
  });

  it("reports connected after setting a bot token", () => {
    discord.setDiscordBotToken("Bot.test.token");
    expect(discord.isDiscordConnected()).toBe(true);
  });

  it("reports disconnected after clearing the token", () => {
    discord.setDiscordBotToken("Bot.test.token");
    discord.setDiscordBotToken("");
    expect(discord.isDiscordConnected()).toBe(false);
  });
});

// ── Home Assistant ────────────────────────────────────────────────────────────
describe("Home Assistant integration", () => {
  let ha: typeof import("./homeAssistant");

  beforeEach(async () => {
    vi.resetModules();
    ha = await import("./homeAssistant");
    ha.setHomeAssistantConfig("", "");
  });

  it("reports disconnected when url and token are empty", () => {
    expect(ha.isHomeAssistantConnected()).toBe(false);
  });

  it("reports disconnected when only url is set", () => {
    ha.setHomeAssistantConfig("http://homeassistant.local:8123", "");
    expect(ha.isHomeAssistantConnected()).toBe(false);
  });

  it("reports disconnected when only token is set", () => {
    ha.setHomeAssistantConfig("", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(ha.isHomeAssistantConnected()).toBe(false);
  });

  it("reports connected when both url and token are set", () => {
    ha.setHomeAssistantConfig("http://homeassistant.local:8123", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(ha.isHomeAssistantConnected()).toBe(true);
  });

  it("strips trailing slash from url", () => {
    ha.setHomeAssistantConfig("http://homeassistant.local:8123/", "token");
    expect(ha.getHomeAssistantUrl()).toBe("http://homeassistant.local:8123");
  });

  it("reports disconnected after clearing config", () => {
    ha.setHomeAssistantConfig("http://homeassistant.local:8123", "token");
    ha.setHomeAssistantConfig("", "");
    expect(ha.isHomeAssistantConnected()).toBe(false);
  });

  it("groupStatesByDomain groups entities correctly", () => {
    const states = [
      { entity_id: "light.living_room", state: "on", attributes: {}, last_changed: "", last_updated: "" },
      { entity_id: "light.bedroom", state: "off", attributes: {}, last_changed: "", last_updated: "" },
      { entity_id: "switch.fan", state: "on", attributes: {}, last_changed: "", last_updated: "" },
      { entity_id: "sensor.temperature", state: "72", attributes: {}, last_changed: "", last_updated: "" },
    ];
    const groups = ha.groupStatesByDomain(states);
    expect(Object.keys(groups).sort()).toEqual(["light", "sensor", "switch"]);
    expect(groups.light).toHaveLength(2);
    expect(groups.switch).toHaveLength(1);
    expect(groups.sensor).toHaveLength(1);
  });

  it("getFriendlyName uses friendly_name attribute when available", () => {
    const state = {
      entity_id: "light.living_room",
      state: "on",
      attributes: { friendly_name: "Living Room Light" },
      last_changed: "",
      last_updated: "",
    };
    expect(ha.getFriendlyName(state)).toBe("Living Room Light");
  });

  it("getFriendlyName falls back to entity_id when no friendly_name", () => {
    const state = {
      entity_id: "light.living_room",
      state: "on",
      attributes: {},
      last_changed: "",
      last_updated: "",
    };
    expect(ha.getFriendlyName(state)).toBe("living room");
  });
});
