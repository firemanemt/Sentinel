/**
 * Express routes for Microsoft Outlook Calendar OAuth flow
 */
import type { Express, Request, Response } from "express";
import {
  getMicrosoftAuthUrl,
  exchangeMicrosoftCode,
  isOutlookConnected,
  getOutlookRedirectUri,
  saveOutlookTokens,
} from "./outlookCalendar";
import { saveMicrosoftTokens, deleteMicrosoftTokens } from "./db";

export function registerOutlookCalendarRoutes(app: Express): void {
  // Start OAuth flow — redirect user to Microsoft
  app.get("/api/outlook/connect", (req: Request, res: Response) => {
    const redirectUri = getOutlookRedirectUri({
      protocol: req.protocol,
      headers: req.headers as Record<string, string | string[] | undefined>,
    });
    const url = getMicrosoftAuthUrl(redirectUri);
    res.redirect(url);
  });

  // OAuth callback — exchange code for tokens
  app.get("/api/outlook/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string;
    if (!code) {
      res.status(400).send("Missing authorization code.");
      return;
    }
    try {
      const redirectUri = getOutlookRedirectUri({
        protocol: req.protocol,
        headers: req.headers as Record<string, string | string[] | undefined>,
      });
      const tokens = await exchangeMicrosoftCode(code, redirectUri);
      await saveMicrosoftTokens(0, tokens);
      res.redirect("/?outlook=connected");
    } catch (err) {
      console.error("[Outlook] OAuth callback error:", err);
      res.redirect("/?outlook=error");
    }
  });

  // Status endpoint
  app.get("/api/outlook/status", (_req: Request, res: Response) => {
    res.json({ connected: isOutlookConnected() });
  });

  // Disconnect
  app.post("/api/outlook/disconnect", async (_req: Request, res: Response) => {
    saveOutlookTokens(null);
    try {
      await deleteMicrosoftTokens(0);
    } catch (e) {
      console.warn("[Outlook] Could not clear DB tokens:", e);
    }
    res.json({ success: true });
  });
}
