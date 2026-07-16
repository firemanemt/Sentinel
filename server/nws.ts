/**
 * National Weather Service (NWS) API integration
 * https://www.weather.gov/documentation/services-web-api
 *
 * Free, no API key required. US only.
 * Provides: active alerts, watches, warnings, advisories.
 */

const NWS_BASE = "https://api.weather.gov";
const USER_AGENT = "(sentinel-assistant, contact@sentinel.app)";

export interface NwsAlert {
  id: string;
  event: string;
  headline: string;
  description: string;
  instruction: string | null;
  severity: string;
  urgency: string;
  certainty: string;
  onset: string | null;
  expires: string | null;
  areaDesc: string;
  senderName: string;
}

export interface NwsPointInfo {
  gridId: string;
  gridX: number;
  gridY: number;
  forecastZone: string;
  county: string;
  timeZone: string;
  city: string;
  state: string;
}

/**
 * Get NWS point metadata for a lat/lon.
 * Required to resolve the grid for forecasts.
 * Returns null if outside US coverage.
 */
export async function getNwsPoint(lat: number, lon: number): Promise<NwsPointInfo | null> {
  try {
    const res = await fetch(
      `${NWS_BASE}/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
      { headers: { "User-Agent": USER_AGENT, Accept: "application/geo+json" } }
    );
    if (!res.ok) return null;
    const data = await res.json() as any;
    const props = data.properties;
    return {
      gridId: props.gridId,
      gridX: props.gridX,
      gridY: props.gridY,
      forecastZone: props.forecastZone,
      county: props.county,
      timeZone: props.timeZone,
      city: props.relativeLocation?.properties?.city ?? "",
      state: props.relativeLocation?.properties?.state ?? "",
    };
  } catch {
    return null;
  }
}

/**
 * Get active NWS alerts for a lat/lon.
 * Returns empty array outside US or on error.
 */
export async function getNwsAlerts(lat: number, lon: number): Promise<NwsAlert[]> {
  try {
    const res = await fetch(
      `${NWS_BASE}/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`,
      { headers: { "User-Agent": USER_AGENT, Accept: "application/geo+json" } }
    );
    if (!res.ok) return [];
    const data = await res.json() as any;
    const features = data.features ?? [];

    return features.map((f: any) => {
      const p = f.properties;
      return {
        id: p.id,
        event: p.event,
        headline: p.headline ?? p.event,
        description: p.description ?? "",
        instruction: p.instruction ?? null,
        severity: p.severity,
        urgency: p.urgency,
        certainty: p.certainty,
        onset: p.onset ?? null,
        expires: p.expires ?? null,
        areaDesc: p.areaDesc ?? "",
        senderName: p.senderName ?? "NWS",
      } as NwsAlert;
    });
  } catch {
    return [];
  }
}

/**
 * Severity color for HUD display.
 */
export function alertSeverityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case "extreme": return "#ff0000";
    case "severe": return "#ff6600";
    case "moderate": return "#ffcc00";
    case "minor": return "#00d4ff";
    default: return "#888888";
  }
}

/**
 * Alert type icon.
 */
export function alertIcon(event: string): string {
  const e = event.toLowerCase();
  if (e.includes("tornado")) return "🌪";
  if (e.includes("hurricane") || e.includes("typhoon")) return "🌀";
  if (e.includes("flood")) return "🌊";
  if (e.includes("thunder") || e.includes("lightning")) return "⛈";
  if (e.includes("snow") || e.includes("blizzard") || e.includes("ice")) return "❄️";
  if (e.includes("wind")) return "💨";
  if (e.includes("fog")) return "🌫";
  if (e.includes("heat")) return "🌡";
  if (e.includes("fire")) return "🔥";
  if (e.includes("freeze") || e.includes("frost")) return "🥶";
  return "⚠️";
}
