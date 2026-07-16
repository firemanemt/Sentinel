/**
 * Simple Routing API integration
 * https://api.simplerouting.io/api/docs/
 *
 * OSRM-based turn-by-turn directions for North America & Europe.
 * Endpoint: GET https://api.simplerouting.io/osrm/{path}
 * Auth: Bearer token
 */

import { ENV } from "./_core/env";

const BASE_URL = "https://api.simplerouting.io";

function headers() {
  return {
    Authorization: `Bearer ${ENV.simpleRoutingApiKey}`,
    "Content-Type": "application/json",
  };
}

export function isSimpleRoutingConfigured(): boolean {
  return !!ENV.simpleRoutingApiKey;
}

export interface RouteStep {
  maneuver: {
    type: string;
    modifier?: string;
    instruction?: string;
    location: [number, number]; // [lon, lat]
    bearing_before: number;
    bearing_after: number;
  };
  name: string;
  distance: number; // meters
  duration: number; // seconds
  geometry?: {
    type: string;
    coordinates: [number, number][];
  };
}

export interface RouteLeg {
  distance: number;
  duration: number;
  steps: RouteStep[];
  summary: string;
}

export interface Route {
  distance: number;   // total meters
  duration: number;   // total seconds
  geometry: {
    type: string;
    coordinates: [number, number][]; // [lon, lat] pairs
  };
  legs: RouteLeg[];
  weight: number;
  weight_name: string;
}

export interface DirectionsResult {
  code: string;
  routes: Route[];
  waypoints: Array<{
    name: string;
    location: [number, number];
    distance: number;
    hint: string;
  }>;
}

/**
 * Get turn-by-turn directions between two or more waypoints.
 * @param waypoints Array of {lat, lng} objects
 * @param profile  "driving" | "walking" | "cycling"
 */
export async function getDirections(
  waypoints: Array<{ lat: number; lng: number }>,
  profile: "driving" | "walking" | "cycling" = "driving"
): Promise<DirectionsResult> {
  if (!isSimpleRoutingConfigured()) {
    throw new Error("Simple Routing API key not configured");
  }
  if (waypoints.length < 2) {
    throw new Error("At least 2 waypoints required");
  }

  // OSRM uses lon,lat order
  const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
  const path = `route/v1/${profile}/${coords}`;
  const params = new URLSearchParams({
    overview: "full",
    steps: "true",
    geometries: "geojson",
    annotations: "false",
  });

  const url = `${BASE_URL}/osrm/${path}?${params}`;
  const res = await fetch(url, { headers: headers() });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Simple Routing API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<DirectionsResult>;
}

/**
 * Geocode an address using Nominatim (free, no key required).
 * Returns top result or null.
 */
export async function geocodeAddress(
  query: string
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "en", "User-Agent": "SENTINEL/1.0" },
  });
  if (!res.ok) return null;
  const results = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;
  if (!results.length) return null;
  return {
    lat: parseFloat(results[0].lat),
    lng: parseFloat(results[0].lon),
    displayName: results[0].display_name,
  };
}

/**
 * Format duration in seconds to a human-readable string.
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

/**
 * Format distance in meters to a human-readable string.
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

/**
 * Build a human-readable instruction from an OSRM step.
 */
export function buildInstruction(step: RouteStep): string {
  const { type, modifier } = step.maneuver;
  const road = step.name || "the road";

  const modStr = modifier ? ` ${modifier}` : "";

  switch (type) {
    case "depart":
      return `Head ${modifier || "forward"} on ${road}`;
    case "arrive":
      return `Arrive at destination`;
    case "turn":
      return `Turn${modStr} onto ${road}`;
    case "new name":
      return `Continue onto ${road}`;
    case "merge":
      return `Merge${modStr} onto ${road}`;
    case "ramp":
      return `Take the ramp${modStr}`;
    case "fork":
      return `Keep${modStr} at the fork onto ${road}`;
    case "end of road":
      return `Turn${modStr} at the end of the road onto ${road}`;
    case "continue":
      return `Continue${modStr} on ${road}`;
    case "roundabout":
    case "rotary":
      return `Enter the roundabout and exit onto ${road}`;
    case "roundabout turn":
      return `At the roundabout, turn${modStr}`;
    case "notification":
      return `Note: ${road}`;
    case "use lane":
      return `Use the ${modifier} lane`;
    default:
      return `Continue on ${road}`;
  }
}
