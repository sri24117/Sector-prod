import { randomBytes, createHash } from "node:crypto";
import type { FastifyReply } from "fastify";

// Server-side sessions per ADR-0005 (chosen over short-lived JWTs — no
// token-refresh flow to build, no client-side JWT storage/XSS surface).
// The raw token lives ONLY in the httpOnly cookie on the client; the
// database stores just its SHA-256 hash (packages/db `sessions` table),
// same principle as a password hash — a DB read alone can never produce a
// valid session token.

export const SESSION_COOKIE_NAME = "sector_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(): Date {
  return new Date(Date.now() + SESSION_TTL_MS);
}

export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // web and api are same-site (shared registrable domain / localhost) — see auth route comments
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
}
