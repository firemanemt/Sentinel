/**
 * Spotify integration for SENTINEL
 * Per-user token model: tokens are loaded from DB on each request.
 * No global singleton — fully multi-tenant.
 */

import { ENV } from "./_core/env";
import { loadSpotifyTokens, saveSpotifyTokens, deleteSpotifyTokens } from "./db";

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "streaming",
  "playlist-read-private",
  "user-library-read",
  "user-top-read",
].join(" ");

export function getSpotifyAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: ENV.spotifyClientId || "",
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES,
    show_dialog: "false",
  });
  return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

export async function exchangeSpotifyCode(
  code: string,
  redirectUri: string,
  userId: number
): Promise<{ accessToken: string; refreshToken: string; expiryDate: number }> {
  const clientId = ENV.spotifyClientId || "";
  const clientSecret = ENV.spotifyClientSecret || "";
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify token exchange failed: ${err}`);
  }

  const data = await res.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const tokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiryDate: Date.now() + data.expires_in * 1000,
  };

  // Persist to DB in the format used by loadSpotifyTokens
  await saveSpotifyTokens(userId, {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.expiryDate,
  });

  return tokens;
}

/** Check if a user has Spotify connected (token exists in DB). */
export async function isSpotifyConnectedForUser(userId: number): Promise<boolean> {
  const tokens = await loadSpotifyTokens(userId);
  return tokens !== null && !!tokens.access_token;
}

/** Disconnect a user's Spotify (delete tokens from DB). */
export async function disconnectSpotify(userId: number): Promise<void> {
  await deleteSpotifyTokens(userId);
}

// ── Legacy singleton API (kept for backward compat with procedures not yet migrated) ──
// These use userId=0 (owner) as the fallback.
let _legacyTokens: { accessToken: string; refreshToken: string; expiryDate: number } | null = null;

export function setSpotifyTokens(tokens: { accessToken: string; refreshToken: string; expiryDate: number }) {
  _legacyTokens = tokens;
}

export function getSpotifyTokens() {
  return _legacyTokens;
}

export function isSpotifyConnected(): boolean {
  return _legacyTokens !== null;
}

async function refreshSpotifyTokenForUser(userId: number, current: { access_token: string; refresh_token?: string; expiry_date?: number }): Promise<{ access_token: string; refresh_token?: string; expiry_date?: number }> {
  if (!current.refresh_token) throw new Error("No refresh token available");

  const clientId = ENV.spotifyClientId || "";
  const clientSecret = ENV.spotifyClientSecret || "";
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: current.refresh_token,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify token refresh failed: ${err}`);
  }

  const data = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const updated = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? current.refresh_token,
    expiry_date: Date.now() + data.expires_in * 1000,
  };

  await saveSpotifyTokens(userId, updated);
  return updated;
}

async function spotifyRequestForUser<T>(userId: number, path: string, options: RequestInit = {}): Promise<T> {
  let tokens = await loadSpotifyTokens(userId);
  if (!tokens) throw new Error("Spotify not connected");

  // Refresh if within 60 seconds of expiry
  if (tokens.expiry_date && Date.now() > tokens.expiry_date - 60_000) {
    tokens = await refreshSpotifyTokenForUser(userId, tokens);
  }

  const res = await fetch(`${SPOTIFY_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (res.status === 204) return {} as T;
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify API error ${res.status}: ${err}`);
  }

  return res.json() as Promise<T>;
}

// ── Per-user Playback Controls ────────────────────────────────────────────────

export async function getCurrentTrack(userId?: number): Promise<string> {
  try {
    const uid = userId ?? 0;
    const data = await spotifyRequestForUser<{
      is_playing: boolean;
      item?: { name: string; artists: { name: string }[] };
    }>(uid, "/me/player/currently-playing");

    if (!data.item) return "Nothing is currently playing.";
    const artists = data.item.artists.map((a) => a.name).join(", ");
    const status = data.is_playing ? "Currently playing" : "Paused";
    return `${status}: "${data.item.name}" by ${artists}.`;
  } catch {
    return "Unable to retrieve current track.";
  }
}

export async function getCurrentTrackData(userId?: number): Promise<{
  name: string;
  artist: string;
  album: string;
  albumArt: string | null;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
} | null> {
  try {
    const uid = userId ?? 0;
    const data = await spotifyRequestForUser<{
      is_playing: boolean;
      progress_ms: number;
      item?: {
        name: string;
        duration_ms: number;
        artists: { name: string }[];
        album: { name: string; images: { url: string; width: number }[] };
      };
    }>(uid, "/me/player/currently-playing");

    if (!data.item) return null;
    const albumImages = data.item.album.images ?? [];
    const thumb = albumImages.sort((a, b) => a.width - b.width).find((img) => img.width >= 64);
    return {
      name: data.item.name,
      artist: data.item.artists.map((a) => a.name).join(", "),
      album: data.item.album.name,
      albumArt: thumb?.url ?? albumImages[0]?.url ?? null,
      isPlaying: data.is_playing,
      progressMs: data.progress_ms ?? 0,
      durationMs: data.item.duration_ms,
    };
  } catch {
    return null;
  }
}

export async function playMusic(query?: string, userId?: number): Promise<string> {
  const uid = userId ?? 0;
  try {
    let deviceId: string | undefined;
    try {
      const devicesData = await spotifyRequestForUser<{ devices: { id: string; is_active: boolean; type: string }[] }>(uid, "/me/player/devices");
      const activeDevice = devicesData.devices?.find((d) => d.is_active);
      const anyDevice = devicesData.devices?.[0];
      deviceId = activeDevice?.id ?? anyDevice?.id;

      if (!activeDevice && anyDevice?.id) {
        await spotifyRequestForUser(uid, "/me/player", {
          method: "PUT",
          body: JSON.stringify({ device_ids: [anyDevice.id], play: false }),
        });
        await new Promise((r) => setTimeout(r, 400));
      }
    } catch {
      // ignore device fetch errors
    }

    if (query) {
      const searchData = await spotifyRequestForUser<{
        tracks?: { items: { uri: string; name: string; artists: { name: string }[] }[] };
      }>(uid, `/search?q=${encodeURIComponent(query)}&type=track&limit=1`);

      const track = searchData.tracks?.items?.[0];
      if (!track) return `I couldn't find anything matching "${query}" on Spotify.`;

      const playBody: Record<string, unknown> = { uris: [track.uri] };
      if (deviceId) playBody.device_id = deviceId;

      await spotifyRequestForUser(uid, "/me/player/play", {
        method: "PUT",
        body: JSON.stringify(playBody),
      });

      const artists = track.artists.map((a) => a.name).join(", ");
      return `Now playing "${track.name}" by ${artists} on Spotify.`;
    } else {
      const resumeBody = deviceId ? JSON.stringify({ device_id: deviceId }) : undefined;
      await spotifyRequestForUser(uid, "/me/player/play", { method: "PUT", body: resumeBody });
      return "Resuming playback on Spotify.";
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("404")) return "No active Spotify device found. Please open Spotify on a device first, then try again.";
    if (msg.includes("403")) return "Spotify Premium is required for playback control.";
    return `Unable to play music: ${msg}`;
  }
}

export async function pauseMusic(userId?: number): Promise<string> {
  try {
    await spotifyRequestForUser(userId ?? 0, "/me/player/pause", { method: "PUT" });
    return "Playback paused.";
  } catch {
    return "Unable to pause playback.";
  }
}

export async function skipTrack(userId?: number): Promise<string> {
  try {
    await spotifyRequestForUser(userId ?? 0, "/me/player/next", { method: "POST" });
    return "Skipping to the next track.";
  } catch {
    return "Unable to skip track.";
  }
}

export async function previousTrack(userId?: number): Promise<string> {
  try {
    await spotifyRequestForUser(userId ?? 0, "/me/player/previous", { method: "POST" });
    return "Going back to the previous track.";
  } catch {
    return "Unable to go to previous track.";
  }
}

export async function setVolume(percent: number, userId?: number): Promise<string> {
  const vol = Math.max(0, Math.min(100, Math.round(percent)));
  try {
    await spotifyRequestForUser(userId ?? 0, `/me/player/volume?volume_percent=${vol}`, { method: "PUT" });
    return `Volume set to ${vol}%.`;
  } catch {
    return "Unable to set volume.";
  }
}

export async function searchSpotify(query: string, type: "track" | "artist" | "playlist" = "track", userId?: number): Promise<string> {
  try {
    const data = await spotifyRequestForUser<{
      tracks?: { items: { name: string; artists: { name: string }[] }[] };
      artists?: { items: { name: string; genres: string[] }[] };
      playlists?: { items: { name: string; owner: { display_name: string } }[] };
    }>(userId ?? 0, `/search?q=${encodeURIComponent(query)}&type=${type}&limit=5`);

    if (type === "track" && data.tracks?.items?.length) {
      const results = data.tracks.items
        .map((t, i) => `${i + 1}. "${t.name}" by ${t.artists.map((a) => a.name).join(", ")}`)
        .join("; ");
      return `Found these tracks: ${results}`;
    }
    if (type === "artist" && data.artists?.items?.length) {
      const results = data.artists.items.map((a) => a.name).join(", ");
      return `Found these artists: ${results}`;
    }
    if (type === "playlist" && data.playlists?.items?.length) {
      const results = data.playlists.items
        .map((p) => `"${p.name}" by ${p.owner.display_name}`)
        .join("; ");
      return `Found these playlists: ${results}`;
    }
    return `No ${type} results found for "${query}".`;
  } catch (e: unknown) {
    return `Search failed: ${e instanceof Error ? e.message : String(e)}`;
  }
}
