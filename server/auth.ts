import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { users } from "../schema";

// Session token payload
export type SessionPayload = {
  userId: number;
  email: string;
};

const JWT_ALGORITHM = "HS256";
const SESSION_EXPIRY_MS = 1000 * 60 * 60 * 24 * 365; // 1 year

function getSecretKey() {
  const secret = ENV.jwtSecret;
  if (!secret) {
    throw new Error("[Auth] JWT_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Hash a plaintext password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Create a signed JWT session token
 */
export async function createSessionToken(
  userId: number,
  email: string
): Promise<string> {
  const issuedAt = Date.now();
  const expirationSeconds = Math.floor((issuedAt + SESSION_EXPIRY_MS) / 1000);
  const secretKey = getSecretKey();

  return new SignJWT({ userId, email })
    .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .setIssuedAt()
    .sign(secretKey);
}

/**
 * Verify and decode a session token. Returns null if invalid.
 */
export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const secretKey = getSecretKey();
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: [JWT_ALGORITHM],
    });

    const userId = payload.userId as number;
    const email = payload.email as string;

    if (!userId || !email) {
      console.warn("[Auth] Session payload missing required fields");
      return null;
    }

    return { userId, email };
  } catch (error) {
    console.warn("[Auth] Session verification failed:", String(error));
    return null;
  }
}

/**
 * Register a new user with email and password.
 * Returns the user record on success, or throws with a message on failure.
 */
export async function registerUser(input: {
  email: string;
  password: string;
  name?: string;
}) {
  const { email, password, name } = input;

  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if user already exists
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    throw new Error("A user with this email already exists");
  }

  const hashedPassword = await hashPassword(password);

  // Determine if this should be an admin (first user or env-configured admin email)
  const allUsers = await db.select().from(users).limit(1);
  const isAdmin = allUsers.length === 0 || email === ENV.adminEmail;

  const result = await db
    .insert(users)
    .values({
      email,
      password: hashedPassword,
      name: name ?? null,
      loginMethod: "email",
      role: isAdmin ? "admin" : "user",
    });

  const userId = (result as unknown as { insertId: number }).insertId;

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = userRows[0];

  if (!user) {
    throw new Error("Failed to create user");
  }

  const sessionToken = await createSessionToken(user.id, user.email);

  return { user, sessionToken };
}

/**
 * Authenticate a user with email and password.
 * Returns the user record + session token on success, or throws.
 */
export async function loginUser(input: { email: string; password: string }) {
  const { email, password } = input;

  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = userRows[0];

  if (!user) {
    throw new Error("Invalid email or password");
  }

  if (!user.password) {
    throw new Error("This account was created with OAuth. Please use the OAuth sign-in option.");
  }

  const validPassword = await verifyPassword(password, user.password);
  if (!validPassword) {
    throw new Error("Invalid email or password");
  }

  // Update last sign-in
  await db
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, user.id));

  const sessionToken = await createSessionToken(user.id, user.email);

  return { user, sessionToken };
}

/**
 * Look up a user by their session token
 */
export async function getUserFromSession(
  token: string | undefined | null
) {
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const db = await getDb();
  if (!db) return null;

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, payload.userId))
    .limit(1);

  return userRows[0] ?? null;
}
