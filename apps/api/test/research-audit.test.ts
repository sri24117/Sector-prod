import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { pool, rawDb, schema, scopedDb } from "@sector/db";
import { buildApp } from "../src/app.js";
import { siteHost } from "../src/lib/site-verification.js";
import { presentAudit } from "../src/routes/research-audits.js";

// Research audit foundation (docs/superpowers/plans/2026-10-13-research-audit-foundation.md):
// plan and ownership gate, limits, release visibility, tenancy.
let app: FastifyInstance;
const queued: { auditId: string; organizationId: string }[] = [];
let failQueue = false;

async function signup(name: string, email: string, websiteUrl: string) {
  const res = await app.inject({ method: "POST", url: "/auth/signup", payload: { organizationName: name, name: "Owner", email, password: "long-enough-password", websiteUrl, orgType: "ngo" } });
  expect(res.statusCode).toBe(201);
  const c = res.cookies.find((x) => x.name === "sector_session")!;
  return { cookie: `${c.name}=${c.value}`, orgId: res.json().organizationId as string, url: websiteUrl };
}
const call = (cookie: string, method: "GET" | "POST", url: string) => app.inject({ method, url, headers: { cookie } });
async function makeEligible(o: { orgId: string; url: string }) {
  await rawDb.update(schema.organizations).set({ plan: "pilot" }).where(eq(schema.organizations.id, o.orgId));
  const db = scopedDb(o.orgId);
  await db.siteVerification.ensure(siteHost(o.url));
  await db.siteVerification.markVerified("meta");
}
async function release(auditId: string) {
  await rawDb.update(schema.researchAudits).set({ status: "released", releasedAt: new Date(), seoScore: 80, aioScore: 60, uiuxScore: 70, brandScore: 50, overallScore: 65, summary: { headline: "ok" } }).where(eq(schema.researchAudits.id, auditId));
}

beforeAll(async () => {
  app = await buildApp({
    reportQueue: { add: async () => {} },
    researchQueue: { add: async (job) => { if (failQueue) throw new Error("redis down"); queued.push(job); } },
  });
  await app.ready();
});
afterAll(async () => {
  await pool.query("TRUNCATE organizations, users, memberships, organization_profiles, sessions, security_event_log, site_verifications, funnel_events, reference_sources CASCADE");
  await app.close(); await pool.end();
});

describe("research audit API", () => {
  let A: Awaited<ReturnType<typeof signup>>; let B: Awaited<ReturnType<typeof signup>>;
  let auditId: string;

  it("refuses a free-plan organization", async () => {
    A = await signup("Asha NGO", "a@asha.org", "https://asha.example.org/");
    B = await signup("Other NGO", "b@other.org", "https://other.example.org/");
    const res = await call(A.cookie, "POST", "/research-audits");
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("plan_required");
  });

  it("refuses a paid organization whose website is not verified", async () => {
    await rawDb.update(schema.organizations).set({ plan: "pilot" }).where(eq(schema.organizations.id, A.orgId));
    const res = await call(A.cookie, "POST", "/research-audits");
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("site_not_verified");
  });

  it("queues an audit for an eligible organization and allows only one at a time", async () => {
    await makeEligible(A);
    const res = await call(A.cookie, "POST", "/research-audits");
    expect(res.statusCode).toBe(202);
    auditId = res.json().id;
    expect(queued).toEqual([{ auditId, organizationId: A.orgId }]);
    const again = await call(A.cookie, "POST", "/research-audits");
    expect(again.statusCode).toBe(409);
    expect(again.json().error).toBe("research_in_progress");
  });

  it("hides scores and findings until the audit is released", async () => {
    await scopedDb(A.orgId).researchAudits.addFindings(auditId, [{ pillar: "seo", layer: "rules", checkId: "title", result: "fail", points: 10, fix: "Add a title" }]);
    await scopedDb(A.orgId).researchAudits.update(auditId, { status: "in_review", seoScore: 80, overallScore: 65, summary: { headline: "secret draft" } });
    const one = (await call(A.cookie, "GET", `/research-audits/${auditId}`)).json();
    expect(one.audit.status).toBe("in_review");
    expect(one.audit.overallScore).toBeNull();
    expect(one.audit.seoScore).toBeNull();
    expect(one.audit.summary).toBeNull();
    expect(one.findings).toBeNull();
    const list = (await call(A.cookie, "GET", "/research-audits")).json();
    expect(list.audits[0].overallScore).toBeNull();
    expect(JSON.stringify(list)).not.toContain("secret draft");
  });

  it("shows scores, summary and cited findings after release", async () => {
    await release(auditId);
    const one = (await call(A.cookie, "GET", `/research-audits/${auditId}`)).json();
    expect(one.audit.status).toBe("released");
    expect(one.audit.overallScore).toBe(65);
    expect(one.audit.summary).toEqual({ headline: "ok" });
    expect(one.findings).toHaveLength(1);
    expect(one.findings[0].fix).toBe("Add a title");
  });

  it("returns 404 for another organization's audit and for unknown ids", async () => {
    expect((await call(B.cookie, "GET", `/research-audits/${auditId}`)).statusCode).toBe(404);
    expect((await call(B.cookie, "GET", `/research-audits/${crypto.randomUUID()}`)).statusCode).toBe(404);
    expect((await call(B.cookie, "GET", "/research-audits")).json().audits).toEqual([]);
  });

  it("requires a signed-in user", async () => {
    expect((await app.inject({ method: "GET", url: "/research-audits" })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/research-audits" })).statusCode).toBe(401);
  });

  it("stops at 3 audits a day", async () => {
    // A already has 1 released audit today; add 2 more finished ones, then the 4th attempt is refused.
    for (let i = 0; i < 2; i++) await scopedDb(A.orgId).researchAudits.create({ siteUrl: A.url, createdBy: "u" }).then((r) => release(r.id));
    const res = await call(A.cookie, "POST", "/research-audits");
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe("daily_limit");
  });

  it("marks the audit failed and answers 503 when the queue is down", async () => {
    await makeEligible(B);
    failQueue = true;
    const res = await call(B.cookie, "POST", "/research-audits");
    failQueue = false;
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe("queue_unavailable");
    const [row] = await scopedDb(B.orgId).researchAudits.list();
    expect(row!.status).toBe("failed");
  });
});

describe("presentAudit", () => {
  const base = { id: "a", organizationId: "o", siteUrl: "https://x.org/", platform: "wix", status: "released", error: "boom", seoScore: 1, aioScore: 2, uiuxScore: 3, brandScore: 4, overallScore: null, layerWeights: { rules: 50 }, pillarWeights: { seo: 25 }, summary: { s: 1 }, createdBy: "u", createdAt: new Date("2026-10-13"), releasedAt: new Date("2026-10-14") };
  it("keeps a released audit with no overall score as null, not 0", () => {
    expect(presentAudit(base as never).overallScore).toBeNull();
  });
  it("never exposes internal fields", () => {
    const shown = presentAudit(base as never) as Record<string, unknown>;
    expect(shown).not.toHaveProperty("error");
    expect(shown).not.toHaveProperty("createdBy");
    expect(shown).not.toHaveProperty("organizationId");
  });
  it("hides everything but status for an unreleased audit, even a failed one", () => {
    const shown = presentAudit({ ...base, status: "failed", releasedAt: null } as never);
    expect(shown.status).toBe("failed");
    expect(shown.seoScore).toBeNull();
    expect(shown.summary).toBeNull();
  });
});
