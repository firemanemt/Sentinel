import type { Express } from "express";

/**
 * OAuth callback route.
 * For standalone Sentinel, user authentication is handled via email/password
 * in /api/auth/login and /api/auth/register. This route is kept for
 * backward compatibility and redirects to the login page.
 */
export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", (_req, res) => {
    // Redirect to login page — standalone auth replaces Manus OAuth
    res.redirect(302, "/login");
  });
}
