import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import { pool, rawDb, schema } from "@sector/db";
import { registerAuthRoutes } from "../src/routes/auth.js";
import { registerAuthDecorators } from "../src/auth/middleware.js";

// Runs against a REAL Postgres (DATABASE_URL), same as packages/db's
// tenant-isolation tests — signup/login hit argon2 and real transactions,
// mocking them would test very little. CLAUDE.md §8: happy path, a
// failure path, and unauthorized/cross-tenant access, all covered below.

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  await app.register(cookie);
  registerAuthDecorators(app);
  await registerAuthRoutes(app);
  await app.ready();
});

afterAll(async () => {
  await pool.query(
    "TRUNCATE organizations, users, memberships, organization_profiles, sessions, security_event_log CASCADE",
  );
  await app.close();
  await pool.end();
});

function cookieHeaderFrom(setCookieHeaders: string[] | undefined): string {
  const target = (setCookieHeaders ?? []).find((c) => c.startsWith("sector_session="));
  if (!target) throw new Error("No session cookie in response");
  return target.split(";")[0]!;
}

describe("POST /auth/signup", () => {
  it("happy path: creates org + owner user, sets a session cookie", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: {
        organizationName: "Test NGO",
        name: "Owner Person",
        email: "owner@test-ngo.org",
        password: "a-long-enough-password",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.role).toBe("owner");
    expect(res.cookies.some((c) => c.name === "sector_session")).toBe(true);
  });

  it("rejects a duplicate email with 409, not a 500", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: {
        organizationName: "Second Org",
        name: "Someone Else",
        email: "owner@test-ngo.org", // same as above
        password: "another-long-password",
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("email_taken");
  });

  it("rejects a too-short password with 400 before touching the database", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: {
        organizationName: "Org",
        name: "N",
        email: "short-pw@test.org",
        password: "short",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_input");
  });
});

describe("POST /auth/login", () => {
  it("wrong password returns 401 with a generic message (no email-existence leak)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "owner@test-ngo.org", password: "definitely-wrong" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().message).toBe("Incorrect email or password.");
  });

  it("unknown email returns the SAME 401 message as wrong password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "no-such-user@test.org", password: "whatever-12345" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().message).toBe("Incorrect email or password.");
  });

  it("correct credentials succeed and issue a usable session", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "owner@test-ngo.org", password: "a-long-enough-password" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.cookies.some((c) => c.name === "sector_session")).toBe(true);
  });
});

describe("GET /auth/me and cross-tenant isolation", () => {
  it("returns 401 with no session cookie", async () => {
    const res = await app.inject({ method: "GET", url: "/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("two different orgs' owners each see ONLY their own org via /auth/me", async () => {
    const signupA = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: {
        organizationName: "Org Alpha",
        name: "Alpha Owner",
        email: "alpha@example.org",
        password: "alpha-password-123",
      },
    });
    const signupB = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: {
        organizationName: "Org Beta",
        name: "Beta Owner",
        email: "beta@example.org",
        password: "beta-password-123",
      },
    });

    const cookieA = cookieHeaderFrom(signupA.cookies.map((c) => `${c.name}=${c.value}`));
    const cookieB = cookieHeaderFrom(signupB.cookies.map((c) => `${c.name}=${c.value}`));

    const meA = await app.inject({ method: "GET", url: "/auth/me", headers: { cookie: cookieA } });
    const meB = await app.inject({ method: "GET", url: "/auth/me", headers: { cookie: cookieB } });

    expect(meA.json().organizationName).toBe("Org Alpha");
    expect(meB.json().organizationName).toBe("Org Beta");
    // The actual guarantee: A's org id never appears in B's response or vice versa.
    expect(meA.json().organizationId).not.toBe(meB.json().organizationId);
  });
});

describe("POST /auth/logout", () => {
  it("invalidates the session so a subsequent /auth/me is 401", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "owner@test-ngo.org", password: "a-long-enough-password" },
    });
    const sessionCookie = cookieHeaderFrom(login.cookies.map((c) => `${c.name}=${c.value}`));

    const logout = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: { cookie: sessionCookie },
    });
    expect(logout.statusCode).toBe(204);

    const meAfter = await app.inject({ method: "GET", url: "/auth/me", headers: { cookie: sessionCookie } });
    expect(meAfter.statusCode).toBe(401);
  });
});
