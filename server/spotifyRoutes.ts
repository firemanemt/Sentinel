/**
 * Express routes for Spotify OAuth flow
 * Per-user model: tokens are stored keyed by userId.
 */
import type { Express, Request } from "express";
import {
  getSpotifyAuthUrl,
  exchangeSpotifyCode,
  disconnectSpotify,
} from "./spotify";
import { sdk } from "./_core/sdk";

// Stable production redirect URI
function getSpotifyRedirectUri(req: Request): string {
  if (process.env.NODE_ENV === "production") {
    return "https://sentinel2.manus.space/api/spotify/callback";
  }
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${protocol}://${host}/api/spotify/callback`;
}

// Helper: get userId from session cookie (returns 0 if unauthenticated — owner fallback)
async function getUserIdFromRequest(req: Request): Promise<number> {
  try {
    const user = await sdk.authenticateRequest(req);
    return user?.id ?? 0;
  } catch {
    return 0;
  }
}

export function registerSpotifyRoutes(app: Express) {
  // Start OAuth flow — embed userId in state so callback can save to correct user
  app.get("/api/spotify/connect", async (req, res) => {
    const userId = await getUserIdFromRequest(req);
    const redirectUri = getSpotifyRedirectUri(req);
    const state = Buffer.from(JSON.stringify({ userId })).toString("base64url");
    const authUrl = getSpotifyAuthUrl(redirectUri) + `&state=${encodeURIComponent(state)}`;
    res.redirect(authUrl);
  });

  // OAuth callback
  app.get("/api/spotify/callback", async (req, res) => {
    const { code, error, state } = req.query;
    if (error || !code) return res.redirect("/?spotify_error=access_denied");

    // Decode userId from state
    let userId = 0;
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state as string, "base64url").toString());
        if (typeof decoded.userId === "number") userId = decoded.userId;
      } catch {
        // fall back to userId=0
      }
    }

    try {
      const redirectUri = getSpotifyRedirectUri(req);
      await exchangeSpotifyCode(code as string, redirectUri, userId);
      console.log(`[Spotify] OAuth completed and tokens saved for userId=${userId}.`);
      res.redirect("/?spotify_connected=true");
    } catch (err) {
      console.error("[Spotify] OAuth callback error:", err);
      res.redirect("/?spotify_error=callback_failed");
    }
  });

  // Disconnect
  app.post("/api/spotify/disconnect", async (req, res) => {
    const userId = await getUserIdFromRequest(req);
    await disconnectSpotify(userId);
    res.json({ success: true });
  });

  // Status
  app.get("/api/spotify/status", async (req, res) => {
    const userId = await getUserIdFromRequest(req);
    const { isSpotifyConnectedForUser } = await import("./spotify");
    res.json({ connected: await isSpotifyConnectedForUser(userId) });
  });
}
