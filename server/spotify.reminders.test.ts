import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock DB helpers
vi.mock("./db", () => ({
  saveMessage: vi.fn().mockResolvedValue(undefined),
  getSessionMessages: vi.fn().mockResolvedValue([]),
  clearSessionMessages: vi.fn().mockResolvedValue(undefined),
  getRecentSessions: vi.fn().mockResolvedValue([]),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  createReminder: vi.fn().mockResolvedValue(42),
  getUpcomingReminders: vi.fn().mockResolvedValue([
    {
      id: 1,
      text: "Call Mom",
      dueAt: new Date("2026-07-14T18:00:00Z"),
      fired: false,
      createdAt: new Date("2026-07-13T10:00:00Z"),
    },
    {
      id: 2,
      text: "Team meeting",
      dueAt: new Date("2026-07-14T14:00:00Z"),
      fired: false,
      createdAt: new Date("2026-07-13T09:00:00Z"),
    },
  ]),
  deleteReminder: vi.fn().mockResolvedValue(undefined),
  snoozeReminder: vi.fn().mockResolvedValue(undefined),
}));

// Mock Google Calendar module
vi.mock("./googleCalendar", () => ({
  isCalendarConnected: vi.fn().mockReturnValue(false),
  getUpcomingEvents: vi.fn().mockResolvedValue([]),
  getTodayEvents: vi.fn().mockResolvedValue([]),
  createEvent: vi.fn().mockResolvedValue({}),
  summarizeInbox: vi.fn().mockResolvedValue("You have 3 unread messages."),
  getUnreadCount: vi.fn().mockResolvedValue(5),
}));

// Mock Spotify module
vi.mock("./spotify", () => ({
  isSpotifyConnected: vi.fn().mockReturnValue(false),
  getCurrentTrack: vi.fn().mockResolvedValue({ name: "Test Track", artist: "Test Artist" }),
  playMusic: vi.fn().mockResolvedValue("Playing music"),
  pauseMusic: vi.fn().mockResolvedValue("Paused"),
  skipTrack: vi.fn().mockResolvedValue("Skipped"),
  previousTrack: vi.fn().mockResolvedValue("Previous track"),
  setVolume: vi.fn().mockResolvedValue("Volume set"),
  searchSpotify: vi.fn().mockResolvedValue([]),
}));

function makeCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-open-id",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "test",
      role: "user" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ── Spotify Status ────────────────────────────────────────────────────────────

describe("sentinel.spotifyStatus", () => {
  it("returns connected: false when Spotify is not linked", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.sentinel.spotifyStatus();
    expect(result.connected).toBe(false);
  });

  it("returns connected: true when Spotify is linked", async () => {
    const { isSpotifyConnected } = await import("./spotify");
    vi.mocked(isSpotifyConnected).mockReturnValueOnce(true);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.sentinel.spotifyStatus();
    expect(result.connected).toBe(true);
  });
});

// ── Reminders ────────────────────────────────────────────────────────────────

describe("sentinel.createReminder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a reminder and returns success with id", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.sentinel.createReminder({
      text: "Call Mom",
      dueAt: "2026-07-14T18:00:00.000Z",
    });
    expect(result.success).toBe(true);
    expect(result.id).toBe(42);
  });

  it("rejects an invalid date", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.sentinel.createReminder({ text: "Test", dueAt: "not-a-date" })
    ).rejects.toThrow();
  });

  it("rejects empty reminder text", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.sentinel.createReminder({ text: "", dueAt: "2026-07-14T18:00:00.000Z" })
    ).rejects.toThrow();
  });
});

describe("sentinel.getReminders", () => {
  it("returns upcoming reminders list", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.sentinel.getReminders();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0]?.text).toBe("Call Mom");
    expect(result[1]?.text).toBe("Team meeting");
  });

  it("returns empty array when no reminders", async () => {
    const { getUpcomingReminders } = await import("./db");
    vi.mocked(getUpcomingReminders).mockResolvedValueOnce([]);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.sentinel.getReminders();
    expect(result).toHaveLength(0);
  });
});

describe("sentinel.deleteReminder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes a reminder and returns success", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.sentinel.deleteReminder({ id: 1 });
    expect(result.success).toBe(true);
  });

  it("rejects non-integer id", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      // @ts-expect-error testing invalid input
      caller.sentinel.deleteReminder({ id: "abc" })
    ).rejects.toThrow();
  });
});

// ── Snooze Reminder ───────────────────────────────────────────────────────────

describe("sentinel.snoozeReminder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("snoozes a reminder and returns success", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.sentinel.snoozeReminder({ id: 1, minutes: 10 });
    expect(result.success).toBe(true);
  });

  it("calls snoozeReminder DB helper with correct args", async () => {
    const { snoozeReminder } = await import("./db");
    const caller = appRouter.createCaller(makeCtx());
    await caller.sentinel.snoozeReminder({ id: 7, minutes: 30 });
    expect(vi.mocked(snoozeReminder)).toHaveBeenCalledWith(7, 30);
  });

  it("rejects minutes below 1", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.sentinel.snoozeReminder({ id: 1, minutes: 0 })
    ).rejects.toThrow();
  });

  it("rejects minutes above 1440", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.sentinel.snoozeReminder({ id: 1, minutes: 1441 })
    ).rejects.toThrow();
  });
});

// ── Gmail Unread Count ────────────────────────────────────────────────────────

describe("sentinel.gmailUnreadCount", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns count 0 when calendar is not connected", async () => {
    const { isCalendarConnected } = await import("./googleCalendar");
    vi.mocked(isCalendarConnected).mockReturnValue(false);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.sentinel.gmailUnreadCount();
    expect(result.count).toBe(0);
  });

  it("returns unread count when calendar is connected", async () => {
    const { isCalendarConnected, getUnreadCount } = await import("./googleCalendar");
    vi.mocked(isCalendarConnected).mockReturnValue(true);
    vi.mocked(getUnreadCount).mockResolvedValue(12);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.sentinel.gmailUnreadCount();
    expect(result.count).toBe(12);
  });

  it("returns count 0 on error", async () => {
    const { isCalendarConnected, getUnreadCount } = await import("./googleCalendar");
    vi.mocked(isCalendarConnected).mockReturnValue(true);
    vi.mocked(getUnreadCount).mockRejectedValue(new Error("Gmail API error"));
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.sentinel.gmailUnreadCount();
    expect(result.count).toBe(0);
  });
});

// ── Spotify Widget Mutations ──────────────────────────────────────────────────

describe("sentinel.spotifyPlay / spotifyPause / spotifySkip / spotifyPrevious", () => {
  beforeEach(() => vi.clearAllMocks());

  it("spotifyPlay returns success: false when not connected", async () => {
    const { isSpotifyConnected } = await import("./spotify");
    vi.mocked(isSpotifyConnected).mockReturnValue(false);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.sentinel.spotifyPlay();
    expect(result.success).toBe(false);
  });

  it("spotifyPlay returns success: true when connected", async () => {
    const { isSpotifyConnected, playMusic } = await import("./spotify");
    vi.mocked(isSpotifyConnected).mockReturnValue(true);
    vi.mocked(playMusic).mockResolvedValue("Playing");
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.sentinel.spotifyPlay();
    expect(result.success).toBe(true);
  });

  it("spotifyPause returns success: true when connected", async () => {
    const { isSpotifyConnected, pauseMusic } = await import("./spotify");
    vi.mocked(isSpotifyConnected).mockReturnValue(true);
    vi.mocked(pauseMusic).mockResolvedValue("Paused");
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.sentinel.spotifyPause();
    expect(result.success).toBe(true);
  });

  it("spotifySkip returns success: true when connected", async () => {
    const { isSpotifyConnected, skipTrack } = await import("./spotify");
    vi.mocked(isSpotifyConnected).mockReturnValue(true);
    vi.mocked(skipTrack).mockResolvedValue("Skipped");
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.sentinel.spotifySkip();
    expect(result.success).toBe(true);
  });

  it("spotifyPrevious returns success: true when connected", async () => {
    const { isSpotifyConnected, previousTrack } = await import("./spotify");
    vi.mocked(isSpotifyConnected).mockReturnValue(true);
    vi.mocked(previousTrack).mockResolvedValue("Previous");
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.sentinel.spotifyPrevious();
    expect(result.success).toBe(true);
  });
});
