import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the DB helpers so tests don't need a real database
vi.mock("./db", () => ({
  saveMessage: vi.fn().mockResolvedValue(undefined),
  getSessionMessages: vi.fn().mockResolvedValue([
    {
      id: 1,
      sessionId: "test-session",
      role: "user",
      content: "Hello SENTINEL",
      toolsUsed: null,
      createdAt: new Date("2026-07-13T00:00:00Z"),
    },
    {
      id: 2,
      sessionId: "test-session",
      role: "assistant",
      content: "Good evening, sir. How may I assist you?",
      toolsUsed: JSON.stringify(["time"]),
      createdAt: new Date("2026-07-13T00:00:01Z"),
    },
  ]),
  clearSessionMessages: vi.fn().mockResolvedValue(undefined),
  getRecentSessions: vi.fn().mockResolvedValue(["test-session"]),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
}));

// Mock googleCalendar
vi.mock("./googleCalendar", () => ({
  isCalendarConnected: vi.fn().mockReturnValue(false),
  getUpcomingEvents: vi.fn().mockResolvedValue([]),
  getTodayEvents: vi.fn().mockResolvedValue([]),
  createEvent: vi.fn().mockResolvedValue({}),
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

describe("sentinel.getHistory", () => {
  it("returns conversation history for a session", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.sentinel.getHistory({ sessionId: "test-session" });

    expect(result).toHaveLength(2);
    expect(result[0]?.role).toBe("user");
    expect(result[0]?.content).toBe("Hello SENTINEL");
    expect(result[1]?.role).toBe("assistant");
    expect(result[1]?.toolsUsed).toEqual(["time"]);
  });

  it("rejects sessionId that is too long", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.sentinel.getHistory({ sessionId: "a".repeat(65) })
    ).rejects.toThrow();
  });
});

describe("sentinel.saveMessage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves a user message successfully", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.sentinel.saveMessage({
      sessionId: "test-session",
      role: "user",
      content: "What time is it?",
      toolsUsed: [],
    });
    expect(result.success).toBe(true);
  });

  it("saves an assistant message with tools", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.sentinel.saveMessage({
      sessionId: "test-session",
      role: "assistant",
      content: "It is currently half past three in the afternoon.",
      toolsUsed: ["time"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.sentinel.saveMessage({ sessionId: "test-session", role: "user", content: "", toolsUsed: [] })
    ).rejects.toThrow();
  });
});

describe("sentinel.clearHistory", () => {
  it("clears history and returns success", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.sentinel.clearHistory({ sessionId: "test-session" });
    expect(result.success).toBe(true);
  });
});

describe("sentinel.calendarStatus", () => {
  it("returns connected: false when calendar is not linked", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.sentinel.calendarStatus();
    expect(result.connected).toBe(false);
  });
});

describe("sentinel.currentTime", () => {
  it("returns current time info with expected fields", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.sentinel.currentTime();

    expect(result).toHaveProperty("iso");
    expect(result).toHaveProperty("date");
    expect(result).toHaveProperty("time");
    expect(result).toHaveProperty("dayOfWeek");
    expect(result).toHaveProperty("timezone");
    expect(result).toHaveProperty("timestamp");
    expect(typeof result.timestamp).toBe("number");
  });
});
