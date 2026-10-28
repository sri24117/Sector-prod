import { describe, it, expect, afterEach } from "vitest";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { setSessionCookie } from "../src/auth/session.js";

// Phase 0 security review (docs/reviews/2026-10-phase0-security-review.md), finding H1.
// The production containers get NODE_ENV from `env_file: .env`, which overrides the
// image's ENV NODE_ENV=production, and .env.example ships NODE_ENV=development
// (docker-compose.yml already works around this for HOST, not for the cookie).
// A deployment served over https must still mark the session cookie Secure.
// This test fails until Secure stops depending on NODE_ENV alone.

const saved = { NODE_ENV: process.env.NODE_ENV, APP_URL: process.env.APP_URL };
afterEach(() => { process.env.NODE_ENV = saved.NODE_ENV; process.env.APP_URL = saved.APP_URL; });

async function sessionSetCookie(): Promise<string> {
  const app = Fastify();
  await app.register(cookie);
  app.get("/login", async (_req, reply) => { setSessionCookie(reply, "t0ken"); return reply.send({ ok: true }); });
  const res = await app.inject({ method: "GET", url: "/login" });
  await app.close();
  const header = [res.headers["set-cookie"]].flat().find((c) => c?.startsWith("sector_session="));
  if (!header) throw new Error("no session cookie set");
  return header;
}

describe("session cookie flags on an https deployment", () => {
  it("is Secure when the app is served over https, even if .env carries NODE_ENV=development", async () => {
    process.env.NODE_ENV = "development"; // the .env.example value, copied to the server's .env
    process.env.APP_URL = "https://jyutrix.io"; // what the deployment runbook requires in production
    const header = await sessionSetCookie();
    expect(header).toMatch(/;\s*HttpOnly/i);
    expect(header).toMatch(/;\s*Secure/i);
  });
});
