/**
 * Express routes for Google Calendar OAuth flow
 * Per-user model: tokens are stored keyed by userId from the session.
 */
import type { Express, Request, Response } from "express";
import {
  getAuthUrl,
  exchangeCodeForTokens,
  disconnectCalendar,
  getRedirectUri,
} from "./googleCalendar";
import { sdk } from "./_core/sdk";

export function registerCalendarRoutes(app: Express): void {
  // Start OAuth flow — redirect user to Google
  app.get("/api/calendar/connect", async (req: Request, res: Response) => {
    // Require authenticated user
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      res.status(401).send("Unauthorized. Please sign in first.");
      return;
    }
    if (!user) {
      res.status(401).send("Unauthorized. Please sign in first.");
      return;
    }

    const redirectUri = getRedirectUri({
      protocol: req.protocol,
      headers: req.headers as Record<string, string | string[] | undefined>,
    });
    // Embed userId in state param so the callback knows which user to save tokens for
    const state = Buffer.from(JSON.stringify({ userId: user.id })).toString("base64url");
    const url = getAuthUrl(redirectUri) + `&state=${encodeURIComponent(state)}`;
    res.redirect(url);
  });

  // OAuth callback — exchange code for tokens and save per-user
  app.get("/api/calendar/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const stateParam = req.query.state as string | undefined;

    if (!code) {
      res.status(400).send("Missing authorization code.");
      return;
    }

    // Decode userId from state
    let userId = 0;
    if (stateParam) {
      try {
        const decoded = JSON.parse(Buffer.from(stateParam, "base64url").toString());
        if (typeof decoded.userId === "number") userId = decoded.userId;
      } catch {
        // fall back to userId=0 (owner) if state is malformed
      }
    }

    try {
      const redirectUri = getRedirectUri({
        protocol: req.protocol,
        headers: req.headers as Record<string, string | string[] | undefined>,
      });
      await exchangeCodeForTokens(code, redirectUri, userId);
      res.redirect("/?calendar=connected");
    } catch (err) {
      console.error("[Calendar] OAuth callback error:", err);
      res.redirect("/?calendar=error");
    }
  });

  // Status endpoint (per-user)
  app.get("/api/calendar/status", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) { res.json({ connected: false }); return; }
      const { isCalendarConnected } = await import("./googleCalendar");
      res.json({ connected: await isCalendarConnected(user.id) });
    } catch {
      res.json({ connected: false });
    }
  });

  // Disconnect (per-user)
  app.post("/api/calendar/disconnect", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const userId = user?.id ?? 0;
      await disconnectCalendar(userId);
    } catch (e) {
      console.warn("[Calendar] Could not clear DB tokens:", e);
    }
    res.json({ success: true });
  });
}
