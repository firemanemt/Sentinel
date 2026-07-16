/**
 * GitHub integration for SENTINEL
 * Per-user token model: token is loaded from DB on each request.
 * No global singleton — fully multi-tenant.
 */

import { ENV } from "./_core/env";
import { getIntegrationToken, upsertIntegrationToken, deleteIntegrationToken } from "./db";

const GITHUB_API = "https://api.github.com";
const SERVICE = "github";

// ── Legacy singleton (kept for backward compat with isGithubConnected checks) ──
let _legacyToken: string = ENV.githubToken;

export function setGithubToken(token: string) {
  _legacyToken = token;
}

export function getGithubToken(): string {
  return _legacyToken;
}

export function isGithubConnected(): boolean {
  return _legacyToken.trim().length > 0;
}

/** Check if a specific user has GitHub connected. */
export async function isGithubConnectedForUser(userId: number): Promise<boolean> {
  const row = await getIntegrationToken(userId, SERVICE);
  return row !== null && row.token.trim().length > 0;
}

/** Save a GitHub PAT for a user. */
export async function saveGithubToken(userId: number, token: string): Promise<void> {
  await upsertIntegrationToken(userId, SERVICE, token);
  if (userId === 0) _legacyToken = token; // keep legacy in sync for owner
}

/** Disconnect GitHub for a user. */
export async function disconnectGithub(userId: number): Promise<void> {
  await deleteIntegrationToken(userId, SERVICE);
  if (userId === 0) _legacyToken = "";
}

async function getTokenForUser(userId: number): Promise<string> {
  // Try per-user DB token first
  const row = await getIntegrationToken(userId, SERVICE);
  if (row?.token?.trim()) return row.token;
  // Fall back to env var (owner default)
  if (ENV.githubToken.trim()) return ENV.githubToken;
  throw new Error("GitHub not connected — please provide a Personal Access Token.");
}

async function githubRequest<T>(userId: number, path: string, options: RequestInit = {}): Promise<T> {
  const token = await getTokenForUser(userId);

  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${err}`);
  }

  return res.json() as Promise<T>;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  updated_at: string;
  default_branch: string;
}

export interface GithubPR {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed";
  user: { login: string; avatar_url: string };
  created_at: string;
  updated_at: string;
  draft: boolean;
  body: string | null;
  head: { ref: string };
  base: { ref: string };
}

export interface GithubIssue {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed";
  user: { login: string; avatar_url: string };
  created_at: string;
  updated_at: string;
  labels: { name: string; color: string }[];
  body: string | null;
  comments: number;
  pull_request?: object;
}

export interface GithubNotification {
  id: string;
  reason: string;
  unread: boolean;
  updated_at: string;
  subject: { title: string; type: string; url: string };
  repository: { full_name: string; html_url: string };
}

export interface GithubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  public_repos: number;
  followers: number;
  following: number;
}

// ── API Methods ───────────────────────────────────────────────────────────────

export async function getAuthenticatedUser(userId = 0): Promise<GithubUser> {
  return githubRequest<GithubUser>(userId, "/user");
}

export async function getRepos(userId = 0, perPage = 20): Promise<GithubRepo[]> {
  return githubRequest<GithubRepo[]>(userId, `/user/repos?sort=updated&per_page=${perPage}&affiliation=owner,collaborator`);
}

export async function getPullRequests(userId = 0, owner: string, repo: string, state: "open" | "closed" | "all" = "open"): Promise<GithubPR[]> {
  return githubRequest<GithubPR[]>(userId, `/repos/${owner}/${repo}/pulls?state=${state}&per_page=20`);
}

export async function getIssues(userId = 0, owner: string, repo: string, state: "open" | "closed" | "all" = "open"): Promise<GithubIssue[]> {
  const all = await githubRequest<GithubIssue[]>(userId, `/repos/${owner}/${repo}/issues?state=${state}&per_page=20`);
  return all.filter((i) => !i.pull_request);
}

export async function getNotifications(userId = 0, all = false): Promise<GithubNotification[]> {
  return githubRequest<GithubNotification[]>(userId, `/notifications?all=${all}&per_page=20`);
}

export async function markNotificationRead(userId = 0, id: string): Promise<void> {
  await githubRequest<void>(userId, `/notifications/threads/${id}`, { method: "PATCH" });
}

export async function searchRepos(userId = 0, query: string): Promise<GithubRepo[]> {
  const data = await githubRequest<{ items: GithubRepo[] }>(userId, `/search/repositories?q=${encodeURIComponent(query)}&sort=updated&per_page=10`);
  return data.items;
}
