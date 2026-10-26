import { describe, it, expect, afterEach } from "vitest";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { setSessionCookie } from "../src/auth/session.js";
import { buildApp } from "../src/app.js";

// Cookie Secure and HSTS follow APP_URL's scheme (lib/https.ts), never NODE_ENV.
// session-cookie.test.ts covers the https case with NODE_ENV=development.

const saved = process.env.APP_URL;
afterEach(() => { if (saved === undefined) delete process.env.APP_URL; else process.env.APP_URL = saved; });

async function sessionSetCookie(): Promise<string> {
  const app = Fastify();
  await app.register(cookie);
  app.get("/login", async (_req, reply) => { setSessionCookie(reply, "t0ken"); return reply.send({ ok: true }); });
  const res = await app.inject({ method: "GET", url: "/login" });
  await app.close();
  return [res.headers["set-cookie"]].flat().find((c) => c?.startsWith("sector_session="))!;
}

async function hsts(): Promise<string | undefined> {
  const app = await buildApp();
  const res = await app.inject({ method: "GET", url: "/no-such-route" });
  await app.close();
  return res.headers["strict-transport-security"] as string | undefined;
}

describe("https deployment flags", () => {
  it("local dev over plain http (APP_URL=http://localhost) gets a non-Secure cookie, so login still works", async () => {
    process.env.APP_URL = "http://localhost:3000";
    expect(await sessionSetCookie()).not.toMatch(/;\s*Secure/i);
  });

  it("fails safe: an unset APP_URL gives a Secure cookie", async () => {
    delete process.env.APP_URL;
    expect(await sessionSetCookie()).toMatch(/;\s*Secure/i);
  });

  it("the API sends HSTS when served over https", async () => {
    process.env.APP_URL = "https://jyutrix.io";
    expect(await hsts()).toMatch(/max-age=31536000/);
  });

  it("the API sends no HSTS over plain-http local dev", async () => {
    process.env.APP_URL = "http://localhost:3000";
    expect(await hsts()).toBeUndefined();
  });
});
