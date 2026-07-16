/**
 * Tests for weather server modules (openMeteo.ts, nws.ts)
 */
import { describe, it, expect } from "vitest";
import { wmoDescription, wmoEmoji, aqiLabel, aqiColor } from "./openMeteo";
import { alertSeverityColor, alertIcon } from "./nws";

describe("openMeteo helpers", () => {
  describe("wmoDescription", () => {
    it("returns Clear sky for code 0", () => {
      expect(wmoDescription(0)).toBe("Clear sky");
    });
    it("returns Thunderstorm for code 95", () => {
      expect(wmoDescription(95)).toBe("Thunderstorm");
    });
    it("returns fallback for unknown code", () => {
      expect(wmoDescription(999)).toBe("Code 999");
    });
    it("returns Heavy rain for code 65", () => {
      expect(wmoDescription(65)).toBe("Heavy rain");
    });
  });

  describe("wmoEmoji", () => {
    it("returns sun for code 0", () => {
      expect(wmoEmoji(0)).toBe("☀️");
    });
    it("returns clouds for code 3", () => {
      expect(wmoEmoji(3)).toBe("☁️");
    });
    it("returns thunderstorm for code 95", () => {
      expect(wmoEmoji(95)).toBe("⛈");
    });
    it("returns snow for code 73", () => {
      expect(wmoEmoji(73)).toBe("❄️");
    });
  });

  describe("aqiLabel", () => {
    it("labels 0-50 as Good", () => {
      expect(aqiLabel(0)).toBe("Good");
      expect(aqiLabel(50)).toBe("Good");
    });
    it("labels 51-100 as Moderate", () => {
      expect(aqiLabel(51)).toBe("Moderate");
      expect(aqiLabel(100)).toBe("Moderate");
    });
    it("labels 101-150 as Unhealthy for Sensitive", () => {
      expect(aqiLabel(101)).toBe("Unhealthy for Sensitive");
    });
    it("labels 201-300 as Very Unhealthy", () => {
      expect(aqiLabel(250)).toBe("Very Unhealthy");
    });
    it("labels 301+ as Hazardous", () => {
      expect(aqiLabel(400)).toBe("Hazardous");
    });
  });

  describe("aqiColor", () => {
    it("returns green for good AQI", () => {
      expect(aqiColor(25)).toBe("#00e400");
    });
    it("returns yellow for moderate AQI", () => {
      expect(aqiColor(75)).toBe("#ffff00");
    });
    it("returns dark red for hazardous AQI", () => {
      expect(aqiColor(400)).toBe("#7e0023");
    });
  });
});

describe("nws helpers", () => {
  describe("alertSeverityColor", () => {
    it("returns red for extreme", () => {
      expect(alertSeverityColor("Extreme")).toBe("#ff0000");
    });
    it("returns orange for severe", () => {
      expect(alertSeverityColor("Severe")).toBe("#ff6600");
    });
    it("returns yellow for moderate", () => {
      expect(alertSeverityColor("Moderate")).toBe("#ffcc00");
    });
    it("returns blue for minor", () => {
      expect(alertSeverityColor("Minor")).toBe("#00d4ff");
    });
    it("returns grey for unknown", () => {
      expect(alertSeverityColor("Unknown")).toBe("#888888");
    });
  });

  describe("alertIcon", () => {
    it("returns tornado icon for tornado event", () => {
      expect(alertIcon("Tornado Warning")).toBe("🌪");
    });
    it("returns flood icon for flood event", () => {
      expect(alertIcon("Flash Flood Watch")).toBe("🌊");
    });
    it("returns snow icon for blizzard", () => {
      expect(alertIcon("Blizzard Warning")).toBe("❄️");
    });
    it("returns fire icon for fire event", () => {
      expect(alertIcon("Red Flag Warning")).toBe("⚠️");
    });
    it("returns heat icon for heat event", () => {
      expect(alertIcon("Excessive Heat Warning")).toBe("🌡");
    });
    it("returns default warning for unknown event", () => {
      expect(alertIcon("Special Weather Statement")).toBe("⚠️");
    });
  });
});
