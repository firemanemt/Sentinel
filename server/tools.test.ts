import { describe, expect, it, vi, beforeEach } from "vitest";
import { getWeather, webSearch } from "./tools";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockGeoResponse = {
  results: [{ latitude: 51.5074, longitude: -0.1278, name: "London", country: "United Kingdom" }],
};

const mockWeatherResponse = {
  current: {
    temperature_2m: 18,
    apparent_temperature: 16,
    relative_humidity_2m: 72,
    wind_speed_10m: 15,
    weather_code: 2,
    is_day: 1,
  },
  current_units: {
    temperature_2m: "°F",
    wind_speed_10m: "mph",
  },
};

const mockDDGResponse = {
  AbstractText: "London is the capital city of England and the United Kingdom.",
  AbstractURL: "https://en.wikipedia.org/wiki/London",
  AbstractSource: "Wikipedia",
  Heading: "London",
  Answer: "",
  RelatedTopics: [
    { Text: "London - Capital city of England", FirstURL: "https://en.wikipedia.org/wiki/London" },
  ],
};

function makeFetchMock(data: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(data),
  });
}

describe("getWeather", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns weather data for a valid location", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockGeoResponse) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockWeatherResponse) });

    const result = await getWeather("London");

    expect(result.location).toBe("London, United Kingdom");
    expect(result.temperature).toBe(18);
    expect(result.feelsLike).toBe(16);
    expect(result.humidity).toBe(72);
    expect(result.windSpeed).toBe(15);
    expect(result.description).toBe("partly cloudy");
    expect(result.isDay).toBe(true);
    expect(result.temperatureUnit).toBe("°F");
  });

  it("throws an error when location is not found", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ results: [] }) });

    await expect(getWeather("NonexistentPlace12345")).rejects.toThrow(
      'I was unable to locate "NonexistentPlace12345"'
    );
  });

  it("throws when geocoding API fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) });

    await expect(getWeather("London")).rejects.toThrow();
  });

  it("throws when weather API fails", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockGeoResponse) })
      .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) });

    await expect(getWeather("London")).rejects.toThrow("meteorological data feed");
  });
});

describe("webSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns search results for a valid query", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockDDGResponse) });

    const result = await webSearch("London");

    expect(result.query).toBe("London");
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0]?.snippet).toContain("London");
  });

  it("returns abstract text as the answer when available", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockDDGResponse) });

    const result = await webSearch("London");

    expect(result.answer).toContain("London is the capital");
  });

  it("returns empty results gracefully when API returns no data", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ AbstractText: "", AbstractURL: "", RelatedTopics: [] }),
    });

    const result = await webSearch("obscure query");

    expect(result.query).toBe("obscure query");
    expect(result.results).toHaveLength(0);
    expect(result.answer).toBeUndefined();
  });

  it("throws when search API fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) });

    await expect(webSearch("test")).rejects.toThrow("search data feed");
  });
});

// ---- tRPC endpoint tests ----
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("sentinel.weather tRPC endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns weather data via tRPC for a valid location", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockGeoResponse) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockWeatherResponse) });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.sentinel.weather({ location: "London" });

    expect(result.location).toBe("London, United Kingdom");
    expect(result.temperature).toBe(18);
  });

  it("throws for unknown location via tRPC", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ results: [] }) });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.sentinel.weather({ location: "ZZZUnknown" })).rejects.toThrow();
  });
});

describe("sentinel.search tRPC endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns search results via tRPC", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockDDGResponse) });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.sentinel.search({ query: "London" });

    expect(result.query).toBe("London");
    expect(result.results.length).toBeGreaterThan(0);
  });

  it("throws for API failure via tRPC", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.sentinel.search({ query: "test" })).rejects.toThrow();
  });
});
