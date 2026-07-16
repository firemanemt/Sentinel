import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { registerTtsRoutes } from "./ttsRoutes";

// Mock global fetch for ElevenLabs API calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function buildApp() {
  const app = express();
  app.use(express.json());
  registerTtsRoutes(app);
  return app;
}

describe("POST /api/tts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ELEVENLABS_API_KEY = "test-key-123";
  });

  afterEach(() => {
    delete process.env.ELEVENLABS_API_KEY;
  });

  it("returns 400 when text is missing", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/tts").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/text is required/i);
  });

  it("returns 400 when text is empty string", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/tts").send({ text: "   " });
    expect(res.status).toBe(400);
  });

  it("returns 503 when ELEVENLABS_API_KEY is not set", async () => {
    delete process.env.ELEVENLABS_API_KEY;
    const app = buildApp();
    const res = await request(app).post("/api/tts").send({ text: "Hello" });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not configured/i);
  });

  it("proxies audio from ElevenLabs and returns audio/mpeg", async () => {
    const fakeAudio = Buffer.from("fake-mp3-data");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => fakeAudio.buffer,
    });

    const app = buildApp();
    const res = await request(app)
      .post("/api/tts")
      .send({ text: "Good evening, sir.", voiceId: "daniel" });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/audio\/mpeg/);
    expect(mockFetch).toHaveBeenCalledOnce();

    // Verify it called the correct ElevenLabs voice endpoint
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("onwK4e9ZLuTAKqWW03F9"); // Daniel voice ID
    expect((options.headers as Record<string, string>)["xi-api-key"]).toBe("test-key-123");
  });

  it("returns 502 when ElevenLabs returns an error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    const app = buildApp();
    const res = await request(app).post("/api/tts").send({ text: "Hello SENTINEL" });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/TTS service error/i);
  });

  it("uses default daniel voice when voiceId is not provided", async () => {
    const fakeAudio = Buffer.from("audio");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => fakeAudio.buffer,
    });

    const app = buildApp();
    await request(app).post("/api/tts").send({ text: "Testing default voice" });

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("onwK4e9ZLuTAKqWW03F9"); // Daniel is default
  });
});

describe("GET /api/tts/voices", () => {
  it("returns available voice list", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/tts/voices");
    expect(res.status).toBe(200);
    expect(res.body.voices).toBeInstanceOf(Array);
    expect(res.body.voices.length).toBeGreaterThan(0);
    expect(res.body.default).toBe("daniel");

    const daniel = res.body.voices.find((v: { key: string }) => v.key === "daniel");
    expect(daniel).toBeDefined();
    expect(daniel.id).toBe("onwK4e9ZLuTAKqWW03F9");
  });
});
