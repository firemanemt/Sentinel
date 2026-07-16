import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMorningConfig, saveMorningConfig, ALL_SECTIONS } from "./morningRoutine";

// Mock getDb to avoid real DB calls in tests
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null), // null = DB unavailable → returns defaults
}));

describe("morningRoutine", () => {
  describe("ALL_SECTIONS", () => {
    it("has 10 sections defined", () => {
      expect(ALL_SECTIONS).toHaveLength(10);
    });

    it("each section has id, label, description", () => {
      for (const s of ALL_SECTIONS) {
        expect(s.id).toBeTruthy();
        expect(s.label).toBeTruthy();
        expect(s.description).toBeTruthy();
      }
    });

    it("includes expected section IDs", () => {
      const ids = ALL_SECTIONS.map((s) => s.id);
      expect(ids).toContain("weather");
      expect(ids).toContain("alerts");
      expect(ids).toContain("calendar");
      expect(ids).toContain("email");
      expect(ids).toContain("reminders");
      expect(ids).toContain("spotify");
      expect(ids).toContain("stocks");
      expect(ids).toContain("news");
    });
  });

  describe("getMorningConfig", () => {
    it("returns default config when DB is unavailable", async () => {
      const config = await getMorningConfig();
      expect(config.wakeTime).toBe("07:00");
      expect(config.customGreeting).toBe("Good morning, sir");
      expect(config.readAloud).toBe(true);
      expect(Array.isArray(config.sections)).toBe(true);
      expect(config.sections.length).toBeGreaterThan(0);
    });

    it("default sections include weather and calendar", async () => {
      const config = await getMorningConfig();
      expect(config.sections).toContain("weather");
      expect(config.sections).toContain("calendar");
    });

    it("default weatherLocation is null", async () => {
      const config = await getMorningConfig();
      expect(config.weatherLocation).toBeNull();
    });
  });

  describe("saveMorningConfig", () => {
    it("throws when DB is unavailable", async () => {
      await expect(saveMorningConfig({ wakeTime: "08:00" })).rejects.toThrow("Database unavailable");
    });
  });
});
