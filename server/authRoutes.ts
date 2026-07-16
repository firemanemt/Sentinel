import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { registerUser, loginUser } from "./auth";
import { getSessionCookieOptions } from "./_core/cookies";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export function registerAuthRoutes(app: Router | import("express").Express) {
  const router = Router();

  /**
   * POST /api/auth/register
   * Body: { email, password, name? }
   * Returns: { user, sessionToken }
   */
  router.post("/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name } = z
        .object({
          email: z.string().email(),
          password: z.string().min(8),
          name: z.string().max(100).optional(),
        })
        .parse(req.body);

      const { user, sessionToken } = await registerUser({ email, password, name });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed";
      res.status(400).json({ error: message });
    }
  });

  /**
   * POST /api/auth/login
   * Body: { email, password }
   * Returns: { user, sessionToken }
   */
  router.post("/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = z
        .object({
          email: z.string().email(),
          password: z.string().min(1),
        })
        .parse(req.body);

      const { user, sessionToken } = await loginUser({ email, password });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      res.status(401).json({ error: message });
    }
  });

  app.use("/api/auth", router);
}
