/**
 * Home Assistant integration for SENTINEL
 * Per-user model: URL and token are loaded from DB on each request.
 * No global singleton — fully multi-tenant.
 */

import { ENV } from "./_core/env";
import { getIntegrationToken, upsertIntegrationToken, deleteIntegrationToken } from "./db";

const SERVICE = "home_assistant";

// ── Legacy singleton (kept for backward compat) ──
let _legacyUrl: string = ENV.homeAssistantUrl.replace(/\/$/, "");
let _legacyToken: string = ENV.homeAssistantToken;

export function setHomeAssistantConfig(url: string, token: string) {
  _legacyUrl = url.replace(/\/$/, "");
  _legacyToken = token;
}

export function getHomeAssistantUrl(): string {
  return _legacyUrl;
}

export function isHomeAssistantConnected(): boolean {
  return _legacyUrl.trim().length > 0 && _legacyToken.trim().length > 0;
}

/** Check if a specific user has Home Assistant connected. */
export async function isHomeAssistantConnectedForUser(userId: number): Promise<boolean> {
  const row = await getIntegrationToken(userId, SERVICE);
  if (!row?.token?.trim()) return false;
  try {
    const parsed = JSON.parse(row.token) as { url: string; token: string };
    return parsed.url?.trim().length > 0 && parsed.token?.trim().length > 0;
  } catch {
    return false;
  }
}

/** Save Home Assistant config for a user. */
export async function saveHomeAssistantConfig(userId: number, url: string, token: string): Promise<void> {
  const payload = JSON.stringify({ url: url.replace(/\/$/, ""), token });
  await upsertIntegrationToken(userId, SERVICE, payload);
  if (userId === 0) {
    _legacyUrl = url.replace(/\/$/, "");
    _legacyToken = token;
  }
}

/** Disconnect Home Assistant for a user. */
export async function disconnectHomeAssistant(userId: number): Promise<void> {
  await deleteIntegrationToken(userId, SERVICE);
  if (userId === 0) {
    _legacyUrl = "";
    _legacyToken = "";
  }
}

async function getConfigForUser(userId: number): Promise<{ url: string; token: string }> {
  const row = await getIntegrationToken(userId, SERVICE);
  if (row?.token?.trim()) {
    try {
      const parsed = JSON.parse(row.token) as { url: string; token: string };
      if (parsed.url && parsed.token) return parsed;
    } catch {
      // fall through
    }
  }
  // Fall back to env vars
  if (ENV.homeAssistantUrl.trim() && ENV.homeAssistantToken.trim()) {
    return { url: ENV.homeAssistantUrl.replace(/\/$/, ""), token: ENV.homeAssistantToken };
  }
  throw new Error("Home Assistant not connected — please provide the URL and a Long-Lived Access Token.");
}

async function haRequest<T>(userId: number, path: string, options: RequestInit = {}): Promise<T> {
  const { url, token } = await getConfigForUser(userId);

  const res = await fetch(`${url}/api${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Home Assistant API error ${res.status}: ${err}`);
  }

  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface HaState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

export interface HaArea {
  area_id: string;
  name: string;
}

export interface HaDevice {
  id: string;
  name: string;
  area_id: string | null;
  model: string | null;
  manufacturer: string | null;
}

export type HaDomain =
  | "light"
  | "switch"
  | "climate"
  | "sensor"
  | "binary_sensor"
  | "media_player"
  | "cover"
  | "fan"
  | "lock"
  | "alarm_control_panel"
  | "input_boolean"
  | string;

// ── API Methods ───────────────────────────────────────────────────────────────

export async function getApiStatus(userId = 0): Promise<{ message: string }> {
  return haRequest<{ message: string }>(userId, "/");
}

export async function getStates(userId = 0): Promise<HaState[]> {
  return haRequest<HaState[]>(userId, "/states");
}

export async function getState(userId = 0, entityId: string): Promise<HaState> {
  return haRequest<HaState>(userId, `/states/${entityId}`);
}

export async function getStatesByDomain(userId = 0, domain: HaDomain): Promise<HaState[]> {
  const all = await getStates(userId);
  return all.filter((s) => s.entity_id.startsWith(`${domain}.`));
}

export async function callService(
  userId = 0,
  domain: string,
  service: string,
  data: Record<string, unknown> = {}
): Promise<HaState[]> {
  return haRequest<HaState[]>(userId, `/services/${domain}/${service}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function toggleEntity(userId = 0, entityId: string): Promise<HaState[]> {
  const domain = entityId.split(".")[0];
  return callService(userId, domain, "toggle", { entity_id: entityId });
}

export async function turnOn(userId = 0, entityId: string, extra: Record<string, unknown> = {}): Promise<HaState[]> {
  const domain = entityId.split(".")[0];
  return callService(userId, domain, "turn_on", { entity_id: entityId, ...extra });
}

export async function turnOff(userId = 0, entityId: string): Promise<HaState[]> {
  const domain = entityId.split(".")[0];
  return callService(userId, domain, "turn_off", { entity_id: entityId });
}

export async function setLightBrightness(userId = 0, entityId: string, brightness: number): Promise<HaState[]> {
  return callService(userId, "light", "turn_on", {
    entity_id: entityId,
    brightness: Math.round((brightness / 100) * 255),
  });
}

export async function setClimateTemperature(userId = 0, entityId: string, temperature: number): Promise<HaState[]> {
  return callService(userId, "climate", "set_temperature", {
    entity_id: entityId,
    temperature,
  });
}

/** Group states by domain for the UI */
export function groupStatesByDomain(states: HaState[]): Record<string, HaState[]> {
  const groups: Record<string, HaState[]> = {};
  for (const state of states) {
    const domain = state.entity_id.split(".")[0];
    if (!groups[domain]) groups[domain] = [];
    groups[domain].push(state);
  }
  return groups;
}

/** Friendly display name from entity attributes or entity_id */
export function getFriendlyName(state: HaState): string {
  const name = state.attributes.friendly_name;
  if (typeof name === "string") return name;
  return state.entity_id.split(".")[1].replace(/_/g, " ");
}
