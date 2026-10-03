import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { pool, rawDb, schema } from "@sector/db";
import { buildApp } from "../src/app.js";
import { createResetToken } from "../src/auth/password-reset.js";

// Pilot password reset: ops generates the link (scripts/reset-link.ts), the user
// sets a new password with it. Covers happy path, single use, expiry, garbage
// tokens, session revocation, and no account enumeration on the request step.
let app: FastifyInstance;
let userId: string;
const EMAIL = "reset@hope.org";

beforeAll(async () => {
  app = await buildApp(); await app.ready();
  const res = await app.inject({ method: "POST", url: "/auth/signup", payload: { organizationName: "Reset NGO", name: "R", email: EMAIL, password: "original-password-1" } });
  expect(res.statusCode).toBe(201);
  userId = res.json().userId;
});
afterAll(async () => {
  await pool.query("TRUNCATE organizations, users, memberships, organization_profiles, sessions, security_event_log, password_reset_tokens, funnel_events CASCADE");
  await app.close(); await pool.end();
});

const login = (password: string) => app.inject({ method: "POST", url: "/auth/login", payload: { email: EMAIL, password } });
const confirm = (token: string, password: string) => app.inject({ method: "POST", url: "/auth/password-reset/confirm", payload: { token, password } });

describe("password reset", () => {
  it("request step answers identically for known and unknown emails", async () => {
    const known = await app.inject({ method: "POST", url: "/auth/password-reset/request", payload: { email: EMAIL } });
    const unknown = await app.inject({ method: "POST", url: "/auth/password-reset/request", payload: { email: "nobody@nowhere.org" } });
    expect(known.statusCode).toBe(202);
    expect(unknown.statusCode).toBe(202);
    expect(known.json()).toEqual(unknown.json());
  });

  it("a valid token sets the new password, signs out every session, and works only once", async () => {
    const before = await login("original-password-1");
    expect(before.statusCode).toBe(200);
    const token = await createResetToken(userId);

    expect((await confirm(token, "brand-new-password-2")).statusCode).toBe(200);
    expect((await login("original-password-1")).statusCode).toBe(401);
    expect((await login("brand-new-password-2")).statusCode).toBe(200);
    const sessions = await rawDb.select().from(schema.sessions).where(eq(schema.sessions.userId, userId));
    expect(sessions).toHaveLength(1); // only the login just made; the earlier one was revoked

    const reused = await confirm(token, "third-password-333");
    expect(reused.statusCode).toBe(400);
    expect((await login("third-password-333")).statusCode).toBe(401);
  });

  it("rejects an expired token, a garbage token and a too-short password", async () => {
    const expired = await createResetToken(userId, new Date(Date.now() - 1000));
    expect((await confirm(expired, "another-password-4")).statusCode).toBe(400);
    expect((await confirm("not-a-real-token", "another-password-4")).statusCode).toBe(400);
    const fresh = await createResetToken(userId);
    expect((await confirm(fresh, "short")).statusCode).toBe(400);
  });

  it("issuing a new link invalidates older unused links", async () => {
    const first = await createResetToken(userId);
    const second = await createResetToken(userId);
    expect((await confirm(first, "fifth-password-55")).statusCode).toBe(400);
    expect((await confirm(second, "fifth-password-55")).statusCode).toBe(200);
  });
});
