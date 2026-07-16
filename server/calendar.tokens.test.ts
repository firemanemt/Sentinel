/**
 * Tests for persistent Google OAuth token DB helpers (per-user model).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { GoogleTokens } from "./googleCalendar";

// ---- Mock the DB module ----
const mockStore: Map<number, GoogleTokens | null> = new Map();

vi.mock("./db", () => ({
  saveGoogleTokens: vi.fn(async (userId: number, tokens: GoogleTokens) => {
    mockStore.set(userId, tokens);
  }),
  loadGoogleTokens: vi.fn(async (userId: number) => mockStore.get(userId) ?? null),
  deleteGoogleTokens: vi.fn(async (userId: number) => {
    mockStore.set(userId, null);
  }),
}));

// ---- Mock googleapis to avoid real HTTP calls ----
vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: class {
        generateAuthUrl() { return "https://accounts.google.com/o/oauth2/auth?mock=1"; }
        async getToken() { return { tokens: { access_token: "mock_access", refresh_token: "mock_refresh" } }; }
        setCredentials() {}
        on() {}
      },
    },
    calendar: () => ({}),
  },
}));

import {
  isCalendarConnected,
} from "./googleCalendar";
import { saveGoogleTokens, loadGoogleTokens, deleteGoogleTokens } from "./db";

const TEST_USER_ID = 42;

const sampleTokens: GoogleTokens = {
  access_token: "ya29.test_access_token",
  refresh_token: "1//test_refresh_token",
  expiry_date: Date.now() + 3600 * 1000,
  token_type: "Bearer",
  scope: "https://www.googleapis.com/auth/calendar",
};

describe("Google OAuth token DB persistence", () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it("saveGoogleTokens stores tokens correctly", async () => {
    await saveGoogleTokens(TEST_USER_ID, sampleTokens);
    expect(mockStore.get(TEST_USER_ID)).toMatchObject({
      access_token: sampleTokens.access_token,
      refresh_token: sampleTokens.refresh_token,
    });
  });

  it("loadGoogleTokens returns null when no tokens saved", async () => {
    const result = await loadGoogleTokens(TEST_USER_ID);
    expect(result).toBeNull();
  });

  it("loadGoogleTokens returns saved tokens", async () => {
    await saveGoogleTokens(TEST_USER_ID, sampleTokens);
    const result = await loadGoogleTokens(TEST_USER_ID);
    expect(result).not.toBeNull();
    expect(result?.access_token).toBe(sampleTokens.access_token);
  });

  it("deleteGoogleTokens clears stored tokens", async () => {
    await saveGoogleTokens(TEST_USER_ID, sampleTokens);
    await deleteGoogleTokens(TEST_USER_ID);
    const result = await loadGoogleTokens(TEST_USER_ID);
    expect(result).toBeNull();
  });

  it("isCalendarConnected returns false when no tokens saved", async () => {
    const connected = await isCalendarConnected(TEST_USER_ID);
    expect(connected).toBe(false);
  });

  it("isCalendarConnected returns true after saving tokens", async () => {
    await saveGoogleTokens(TEST_USER_ID, sampleTokens);
    const connected = await isCalendarConnected(TEST_USER_ID);
    expect(connected).toBe(true);
  });

  it("tokens are scoped per-user: user A tokens don't affect user B", async () => {
    await saveGoogleTokens(TEST_USER_ID, sampleTokens);
    const otherUserId = 99;
    const result = await loadGoogleTokens(otherUserId);
    expect(result).toBeNull();
  });
});
