import { AXIOS_TIMEOUT_MS, COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import { getUserFromSession } from "../auth";

class SDKServer {
  /**
   * Authenticate a request using the local JWT session cookie.
   * This replaces the Manus OAuth flow with standalone JWT verification.
   */
  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    // 1. Prefer the session cookie (email/password login).
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    let sessionToken = cookies.get(COOKIE_NAME);

    // 2. Fallback to the Authorization header (for API clients or SPA token mirror).
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }

    const user = await getUserFromSession(sessionToken);
    if (!user) {
      throw ForbiddenError("Invalid or missing session");
    }

    return user as AuthenticatedUser;
  }
}

/** Result of `sdk.authenticateRequest`. */
export type AuthenticatedUser = User & {
  taskUid?: string;
  isCron?: boolean;
};

export const sdk = new SDKServer();
