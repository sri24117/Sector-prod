import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { pool } from "@sector/db";

// Roadmap §2 at the API boundary: private targets refused on every entry point,
// fail-closed DNS, rate limit on the public audit, and a concurrency cap.
vi.mock("@sector/crawler", () => ({ runAudit: vi.fn() }));
const { runAudit } = await import("@sector/crawler");
const { buildApp } = await import("../src/app.js");

let app: FastifyInstance;
let cookie: string;
const prevAllow = process.env.ALLOW_PRIVATE_TARGETS;

beforeAll(async () => {
  app = await buildApp(); await app.ready();
  const res = await app.inject({ method: "POST", url: "/auth/signup", payload: { organizationName: "SSRF NGO", name: "S", email: "s@ssrf-ngo.org", password: "long-enough-password" } });
  const c = res.cookies.find((x) => x.name === "sector_session")!;
  cookie = `${c.name}=${c.value}`;
  process.env.ALLOW_PRIVATE_TARGETS = "0"; // production behaviour for this file
});
afterEach(() => { vi.mocked(runAudit).mockReset(); delete process.env.AUDIT_CONCURRENCY; });
afterAll(async () => {
  process.env.ALLOW_PRIVATE_TARGETS = prevAllow;
  await pool.query("TRUNCATE organizations, users, memberships, organization_profiles, sessions, security_event_log, funnel_events CASCADE");
  await app.close(); await pool.end();
});

const BYPASSES = [
  "http://[::ffff:169.254.169.254]/latest/meta-data", "http://[::ffff:a9fe:a9fe]/", "http://[::ffff:172.16.0.1]/",
  "http://[::]/", "http://2130706433/", "http://127.1/", "http://localhost/", "http://metadata.google.internal/",
];

// Each case gets its own client address so the per-client rate limit does not interfere.
let n = 0;
const fresh = () => ({ "x-forwarded-for": `203.0.113.${++n}` });

describe("SSRF at the API boundary", () => {
  it.each(BYPASSES)("public /audit refuses %s without crawling", async (url) => {
    const res = await app.inject({ method: "POST", url: "/audit", payload: { url }, remoteAddress: `198.51.100.${++n}` });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("url_not_allowed");
    expect(runAudit).not.toHaveBeenCalled();
  });

  it.each(BYPASSES.slice(0, 4))("WordPress connect refuses %s", async (siteUrl) => {
    const res = await app.inject({ method: "POST", url: "/connections/wordpress", headers: { cookie, ...fresh() }, payload: { siteUrl, username: "admin", applicationPassword: "x" } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("url_not_allowed");
  });

  it("an address that does not resolve is refused (fail closed) with a plain message", async () => {
    const res = await app.inject({ method: "POST", url: "/audit", payload: { url: "https://no-such-site-sector-test.invalid" }, remoteAddress: "198.51.100.200" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("site_not_found");
    expect(runAudit).not.toHaveBeenCalled();
  });
});

describe("public /audit limits", () => {
  it("rate-limits a single client after 10 requests in 10 minutes", async () => {
    const remoteAddress = "198.51.100.250";
    for (let i = 0; i < 10; i++) await app.inject({ method: "POST", url: "/audit", payload: {}, remoteAddress });
    const res = await app.inject({ method: "POST", url: "/audit", payload: {}, remoteAddress });
    expect(res.statusCode).toBe(429);
  });

  it("answers busy instead of queueing when every audit slot is taken", async () => {
    process.env.AUDIT_CONCURRENCY = "1";
    let release!: () => void;
    vi.mocked(runAudit).mockImplementationOnce(() => new Promise((r) => { release = () => r({ url: "https://example.org/", score: 1, runAt: new Date().toISOString(), checks: [] }); }));
    const first = app.inject({ method: "POST", url: "/audit", payload: { url: "https://example.org" }, remoteAddress: "198.51.100.251" });
    await vi.waitFor(() => expect(runAudit).toHaveBeenCalledTimes(1));
    const second = await app.inject({ method: "POST", url: "/audit", payload: { url: "https://example.org" }, remoteAddress: "198.51.100.252" });
    expect(second.statusCode).toBe(503);
    expect(second.json().error).toBe("busy");
    release();
    expect((await first).statusCode).toBe(200);
  });
});
