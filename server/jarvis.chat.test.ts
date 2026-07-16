import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    id: "test-id",
    created: Date.now(),
    model: "gpt-5",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "Good day, sir. How may I assist you?",
        },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
  }),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createAuthContext(): TrpcContext {
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
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("sentinel.chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a reply for a simple message", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.sentinel.chat({
      message: "Hello SENTINEL",
      history: [],
    });

    expect(result).toHaveProperty("reply");
    expect(typeof result.reply).toBe("string");
    expect(result.reply.length).toBeGreaterThan(0);
  });

  it("accepts conversation history", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.sentinel.chat({
      message: "What did I just say?",
      history: [
        { role: "user", content: "Hello SENTINEL" },
        { role: "assistant", content: "Good day, sir." },
      ],
    });

    expect(result).toHaveProperty("reply");
    expect(typeof result.reply).toBe("string");
  });

  it("rejects empty messages", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.sentinel.chat({ message: "", history: [] })
    ).rejects.toThrow();
  });

  it("rejects messages that are too long", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.sentinel.chat({ message: "x".repeat(2001), history: [] })
    ).rejects.toThrow();
  });

  it("falls back gracefully when LLM returns null content", async () => {
    const { invokeLLM } = await import("./_core/llm");
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      id: "test-id",
      created: Date.now(),
      model: "gpt-5",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: null as unknown as string },
          finish_reason: "stop",
        },
      ],
    });

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.sentinel.chat({
      message: "Are you there?",
      history: [],
    });

    expect(result.reply).toContain("momentary lapse");
  });
});
