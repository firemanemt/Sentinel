/**
 * Outlook Calendar integration via Microsoft Graph API
 * Uses MSAL for OAuth 2.0 authorization code flow
 */
import { ENV } from "./_core/env";

export interface MicrosoftTokens {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: string;
  tokenType?: string;
  scope?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  isAllDay: boolean;
  source: "google" | "outlook" | "apple";
}

// In-memory token store
let _tokens: MicrosoftTokens | null = null;

export function saveOutlookTokens(tokens: MicrosoftTokens | null): void {
  _tokens = tokens;
}

export function isOutlookConnected(): boolean {
  return _tokens !== null && !!_tokens.accessToken;
}

export function getOutlookTokens(): MicrosoftTokens | null {
  return _tokens;
}

/** Build the Microsoft OAuth authorize URL */
export function getMicrosoftAuthUrl(redirectUri: string): string {
  const clientId = ENV.microsoftClientId;
  const scopes = [
    "Calendars.ReadWrite",
    "offline_access",
    "User.Read",
  ].join(" ");
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopes,
    response_mode: "query",
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

/** Exchange authorization code for tokens */
export async function exchangeMicrosoftCode(
  code: string,
  redirectUri: string
): Promise<MicrosoftTokens> {
  const clientId = ENV.microsoftClientId;
  const clientSecret = ENV.microsoftClientSecret;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Microsoft token exchange failed: ${err}`);
  }

  const data = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  };

  const tokens: MicrosoftTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiryDate: data.expires_in
      ? String(Date.now() + data.expires_in * 1000)
      : undefined,
    tokenType: data.token_type,
    scope: data.scope,
  };

  _tokens = tokens;
  return tokens;
}

/** Refresh the access token using the stored refresh token */
async function refreshAccessToken(): Promise<void> {
  if (!_tokens?.refreshToken) throw new Error("No refresh token available");

  const body = new URLSearchParams({
    client_id: ENV.microsoftClientId,
    client_secret: ENV.microsoftClientSecret,
    refresh_token: _tokens.refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Microsoft token refresh failed: ${err}`);
  }

  const data = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  };

  _tokens = {
    ..._tokens,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? _tokens.refreshToken,
    expiryDate: data.expires_in
      ? String(Date.now() + data.expires_in * 1000)
      : _tokens.expiryDate,
  };

  // Persist refreshed tokens
  try {
    const { saveMicrosoftTokens } = await import("./db");
    await saveMicrosoftTokens(0, _tokens);
  } catch { /* non-fatal */ }
}

/** Get a valid access token, refreshing if needed */
async function getValidAccessToken(): Promise<string> {
  if (!_tokens) throw new Error("Outlook Calendar not connected");

  const expiry = _tokens.expiryDate ? parseInt(_tokens.expiryDate, 10) : 0;
  const isExpired = expiry > 0 && Date.now() > expiry - 60_000; // refresh 1 min early

  if (isExpired) {
    await refreshAccessToken();
  }

  return _tokens!.accessToken;
}

/** Make an authenticated Graph API request */
async function graphRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getValidAccessToken();
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph API error ${res.status}: ${err}`);
  }

  return res.json() as Promise<T>;
}

/** Fetch calendar events for a date range */
export async function getOutlookEvents(
  startDateTime: string,
  endDateTime: string
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    startDateTime,
    endDateTime,
    $select: "id,subject,start,end,location,body,isAllDay",
    $orderby: "start/dateTime",
    $top: "50",
  });

  const data = await graphRequest<{
    value: Array<{
      id: string;
      subject: string;
      start: { dateTime: string; timeZone: string };
      end: { dateTime: string; timeZone: string };
      location?: { displayName: string };
      body?: { content: string };
      isAllDay: boolean;
    }>;
  }>(`/me/calendarView?${params.toString()}`);

  return (data.value ?? []).map((e) => ({
    id: e.id,
    title: e.subject ?? "(No title)",
    start: e.start.dateTime,
    end: e.end.dateTime,
    location: e.location?.displayName,
    description: e.body?.content?.replace(/<[^>]+>/g, "").trim(),
    isAllDay: e.isAllDay,
    source: "outlook" as const,
  }));
}

/** Fetch today's Outlook events */
export async function getOutlookTodayEvents(): Promise<CalendarEvent[]> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return getOutlookEvents(start.toISOString(), end.toISOString());
}

/** Create a new Outlook calendar event */
export async function createOutlookEvent(input: {
  title: string;
  startDateTime: string;
  endDateTime: string;
  location?: string;
  description?: string;
}): Promise<CalendarEvent> {
  const body = {
    subject: input.title,
    start: { dateTime: input.startDateTime, timeZone: "UTC" },
    end: { dateTime: input.endDateTime, timeZone: "UTC" },
    ...(input.location ? { location: { displayName: input.location } } : {}),
    ...(input.description ? { body: { contentType: "text", content: input.description } } : {}),
  };

  const event = await graphRequest<{
    id: string;
    subject: string;
    start: { dateTime: string };
    end: { dateTime: string };
    location?: { displayName: string };
    isAllDay: boolean;
  }>("/me/events", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    id: event.id,
    title: event.subject,
    start: event.start.dateTime,
    end: event.end.dateTime,
    location: event.location?.displayName,
    description: input.description,
    isAllDay: event.isAllDay,
    source: "outlook",
  };
}

/** Build the redirect URI for the current request */
export function getOutlookRedirectUri(req?: {
  protocol: string;
  headers: Record<string, string | string[] | undefined>;
}): string {
  const host = req?.headers["x-forwarded-host"] ?? req?.headers["host"] ?? "";
  const proto = req?.headers["x-forwarded-proto"] ?? req?.protocol ?? "http";
  if (host && host !== "localhost:3000") {
    return `${proto}://${host}/api/outlook/callback`;
  }
  return "http://localhost:3000/api/outlook/callback";
}


