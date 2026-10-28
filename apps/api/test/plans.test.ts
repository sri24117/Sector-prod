import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { pool, rawDb, schema, scopedDb } from "@sector/db";
import type { LlmProvider } from "@sector/ai";
import { buildApp } from "../src/app.js";

// Plan tiers (docs/product/product.md "Pricing and plans"): each gated area is open to its plan,
// locked (403 plan_required) below it, and never leaks across organizations.
let app: FastifyInstance;
let failNext = false;
const fake: LlmProvider = { async complete() { if (failNext) { failNext = false; throw new Error("provider down"); } return { text: "A short draft.", model: "fake-model" }; } };
const call = (cookie: string, method: "GET" | "POST" | "PUT", url: string, payload?: unknown) => app.inject({ method, url, headers: { cookie }, payload: payload as never });
let n = 0;
async function org(plan: string) {
  n += 1;
  const r = await app.inject({ method: "POST", url: "/auth/signup", payload: { acceptTerms: true, organizationName: `Org ${n}`, name: "O", email: `o${n}@plans.test`, password: "long-enough-password" }, remoteAddress: `198.51.100.${n}` }); // own client address: signup is rate limited per client
  expect(r.statusCode).toBe(201);
  const c = r.cookies.find((x) => x.name === "sector_session")!;
  const orgId = r.json().organizationId as string;
  await rawDb.update(schema.organizations).set({ plan }).where(eq(schema.organizations.id, orgId));
  return { cookie: `${c.name}=${c.value}`, orgId };
}
const gen = (cookie: string) => call(cookie, "POST", "/content/generate", { kind: "social_post", topic: "Monthly update", facts: ["We ran a health camp"] });
const locked = (r: { statusCode: number; json: () => { error: string; message: string } }, plan: RegExp) => {
  expect(r.statusCode).toBe(403); expect(r.json().error).toBe("plan_required"); expect(r.json().message).toMatch(plan);
};

beforeAll(async () => { app = await buildApp({ llmProvider: fake, reportQueue: { add: async () => undefined } }); await app.ready(); });
afterAll(async () => { await pool.query("TRUNCATE organizations, users, memberships, organization_profiles, sessions, security_event_log, reports, site_verifications, funnel_events CASCADE"); await app.close(); await pool.end(); });

describe("full report", () => {
  it("is locked on free; every paid tier and the legacy names pass the plan gate", async () => {
    locked(await call((await org("free")).cookie, "POST", "/reports"), /Starter/);
    for (const plan of ["starter", "growth", "pro", "pilot", "paid"]) {
      const r = await call((await org(plan)).cookie, "POST", "/reports");
      expect(r.json().error, plan).toBe("site_not_verified"); // past the plan gate, stopped by the next rule
    }
  });
  it("an unknown stored plan gets no paid access", async () => { locked(await call((await org("enterprise")).cookie, "POST", "/reports"), /Starter/); });
  it("needs a session", async () => { expect((await app.inject({ method: "POST", url: "/reports" })).statusCode).toBe(401); });
});

describe("live WordPress fixes", () => {
  async function finding(orgId: string, checkId: string) {
    const { findings } = await scopedDb(orgId).audits.create({ url: "https://x.example.org/", score: 50, runAt: new Date(), checks: [{ checkId, weight: 10, passed: false, detail: "missing" }] });
    return findings[0]!.id;
  }
  it("connect and the schema fix are locked on free, but manual fix packages stay open", async () => {
    const free = await org("free");
    locked(await call(free.cookie, "POST", "/connections/wordpress", { siteUrl: "https://x.example.org", username: "a", applicationPassword: "b" }), /Starter/);
    locked(await call(free.cookie, "POST", `/findings/${await finding(free.orgId, "schema")}/remediate`), /Starter/);
    const manual = await call(free.cookie, "POST", `/findings/${await finding(free.orgId, "robots")}/remediate`);
    expect(manual.statusCode).toBe(200); expect(manual.json().mode).toBe("manual");
  });
  it("starter passes the plan gate (stops at the next rule)", async () => {
    const s = await org("starter");
    expect((await call(s.cookie, "POST", `/findings/${await finding(s.orgId, "schema")}/remediate`)).json().error).toBe("no_connection");
    expect((await call(s.cookie, "POST", "/connections/wordpress", { siteUrl: "not a url", username: "a", applicationPassword: "b" })).json().error).toBe("url_not_allowed");
  });
  it("CROSS-TENANT: another organization's finding is not found, even for a paid org", async () => {
    const a = await org("starter"); const b = await org("starter");
    expect((await call(b.cookie, "POST", `/findings/${await finding(a.orgId, "schema")}/remediate`)).statusCode).toBe(404);
  });
});

describe("brand kit, consent records and content", () => {
  it("is locked on free for every route", async () => {
    const f = await org("free");
    for (const [m, u, body] of [["GET", "/brand-kit"], ["PUT", "/brand-kit", { voice: "Warm and plain language." }], ["GET", "/consents"], ["POST", "/consents", { subjectName: "Asha Devi", scope: "story", evidenceNote: "signed form" }], ["GET", "/content"]] as const) {
      locked(await call(f.cookie, m, u, body), /Starter/);
    }
    locked(await gen(f.cookie), /Starter/);
  });
  it("is open on starter, growth, pro and legacy pilot", async () => {
    for (const plan of ["starter", "growth", "pro", "pilot"]) expect((await call((await org(plan)).cookie, "GET", "/content")).statusCode, plan).toBe(200);
  });
  it("needs a session", async () => { expect((await app.inject({ method: "GET", url: "/content" })).statusCode).toBe(401); });
});

describe("content allowance", () => {
  const seed = async (orgId: string, count: number, createdAt?: Date) => {
    for (let i = 0; i < count; i++) {
      const a = await scopedDb(orgId).contentAssets.create({ kind: "social_post", title: "t", body: "b", status: "draft", createdBy: "u" });
      if (createdAt) await rawDb.update(schema.contentAssets).set({ createdAt }).where(eq(schema.contentAssets.id, a.id));
    }
  };

  it("starter gets 15 a month; the 16th is refused with a clear message", async () => {
    const s = await org("starter");
    await seed(s.orgId, 14);
    expect((await gen(s.cookie)).statusCode).toBe(201); // the 15th
    const r = await gen(s.cookie);
    expect(r.statusCode).toBe(429); expect(r.json().error).toBe("content_allowance_reached"); expect(r.json().message).toContain("15");
  });
  it("legacy pilot gets the same allowance as starter", async () => {
    const p = await org("pilot"); await seed(p.orgId, 15);
    expect((await gen(p.cookie)).statusCode).toBe(429);
  });
  it("a failed generation is not counted", async () => {
    const s = await org("starter"); await seed(s.orgId, 14);
    failNext = true;
    expect((await gen(s.cookie)).statusCode).toBe(502);
    expect((await gen(s.cookie)).statusCode).toBe(201);
  });
  it("last month's content and other organizations' content are not counted", async () => {
    const s = await org("starter"); const other = await org("starter");
    await seed(s.orgId, 20, new Date(Date.now() - 62 * 86_400_000));
    await seed(other.orgId, 15);
    expect((await gen(s.cookie)).statusCode).toBe(201);
  });
  it("growth and pro have no cap yet", async () => {
    for (const plan of ["growth", "pro"]) { const o = await org(plan); await seed(o.orgId, 16); expect((await gen(o.cookie)).statusCode, plan).toBe(201); }
  });
});

describe("Ad Grants", () => {
  const routes = [["POST", "/ad-grants/account", { googleCustomerId: "123-456-7890" }], ["POST", "/ad-grants/compliance/run"], ["GET", "/ad-grants/alerts"]] as const;
  it("is locked below pro, on every route", async () => {
    for (const plan of ["free", "starter", "growth", "paid"]) {
      const o = await org(plan);
      for (const [m, u, body] of routes) locked(await call(o.cookie, m, u, body), /Pro/);
    }
  });
  it("pro passes the plan gate and is then still subject to the ops-confirmed FCRA gate", async () => {
    const p = await org("pro");
    for (const [m, u, body] of routes) { const r = await call(p.cookie, m, u, body); expect(r.statusCode, u).toBe(403); expect(r.json().error, u).toBe("not_available"); }
    await rawDb.update(schema.organizationProfiles).set({ fcraConfirmedAt: new Date() }).where(eq(schema.organizationProfiles.organizationId, p.orgId));
    expect((await call(p.cookie, "GET", "/ad-grants/alerts")).statusCode).toBe(200);
  });
  it("needs a session", async () => { expect((await app.inject({ method: "GET", url: "/ad-grants/alerts" })).statusCode).toBe(401); });
});
