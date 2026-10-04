import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";
import { pool, rawDb, schema, scopedDb } from "@sector/db";
import { buildApp } from "../src/app.js";

// Full report (docs/superpowers/specs/2026-10-04-full-report-design.md): plan gating,
// website ownership verification, own-website-only audits, report tenancy and serving.
let app: FastifyInstance;
let site: Server; let siteUrl: string; let metaToken = "";
const queued: { reportId: string; organizationId: string }[] = [];

async function signup(name: string, email: string, websiteUrl?: string) {
  const res = await app.inject({ method: "POST", url: "/auth/signup", payload: { organizationName: name, name: "Owner", email, password: "long-enough-password", websiteUrl, orgType: "ngo" } });
  expect(res.statusCode).toBe(201);
  const c = res.cookies.find((x) => x.name === "sector_session")!;
  return { cookie: `${c.name}=${c.value}`, orgId: res.json().organizationId as string, userId: res.json().userId as string };
}
const call = (cookie: string, method: "GET" | "POST" | "PATCH", url: string, payload?: unknown) => app.inject({ method, url, headers: { cookie }, payload: payload as never });

beforeAll(async () => {
  site = createServer((_q, r) => { r.writeHead(200, { "content-type": "text/html" }); r.end(`<html><head><title>NGO</title>${metaToken ? `<meta name="sector-site-verification" content="${metaToken}">` : ""}</head><body><h1>NGO</h1></body></html>`); });
  await new Promise<void>((r) => site.listen(0, "127.0.0.1", r));
  siteUrl = `http://127.0.0.1:${(site.address() as AddressInfo).port}/`;
  app = await buildApp({ reportQueue: { add: async (job) => { queued.push(job); } } });
  await app.ready();
});
afterAll(async () => {
  await pool.query("TRUNCATE organizations, users, memberships, organization_profiles, sessions, security_event_log, reports, site_verifications, funnel_events CASCADE");
  await new Promise<void>((r) => site.close(() => r()));
  await app.close(); await pool.end();
});

describe("full report", () => {
  let A: Awaited<ReturnType<typeof signup>>; let B: Awaited<ReturnType<typeof signup>>;

  it("signup stores the organization type and every org starts on the free plan", async () => {
    A = await signup("Asha NGO", "a@asha.org", siteUrl);
    B = await signup("Other NGO", "b@other.org", "https://other-ngo.example.org");
    const [org] = await rawDb.select().from(schema.organizations).where(eq(schema.organizations.id, A.orgId));
    const [profile] = await rawDb.select().from(schema.organizationProfiles).where(eq(schema.organizationProfiles.organizationId, A.orgId));
    expect(org!.plan).toBe("free");
    expect(profile!.orgType).toBe("ngo");
    const me = (await call(A.cookie, "GET", "/auth/me")).json();
    expect(me.plan).toBe("free");
    expect(me.websiteUrl).toBe(siteUrl);
  });

  it("in-app audits only run on the organization's own website", async () => {
    const res = await call(A.cookie, "POST", "/audits", { url: "https://google.com" });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("own_site_only");
  });

  it("a free-plan organization cannot create a full report", async () => {
    const res = await call(A.cookie, "POST", "/reports");
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("plan_required");
    expect(queued).toHaveLength(0);
  });

  it("a paid organization must verify its website first", async () => {
    await rawDb.update(schema.organizations).set({ plan: "paid" }).where(eq(schema.organizations.id, A.orgId));
    const res = await call(A.cookie, "POST", "/reports");
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("site_not_verified");
  });

  it("verification gives a token and fails until the meta tag is on the homepage", async () => {
    const info = await call(A.cookie, "GET", "/site-verification");
    expect(info.statusCode).toBe(200);
    expect(info.json()).toMatchObject({ host: "127.0.0.1", verified: false });
    expect(info.json().metaTag).toContain(info.json().token);
    const fail = await call(A.cookie, "POST", "/site-verification/check");
    expect(fail.statusCode).toBe(400);
    expect(fail.json().error).toBe("not_verified");
    metaToken = info.json().token;
    const ok = await call(A.cookie, "POST", "/site-verification/check");
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ verified: true, method: "meta" });
  });

  it("a wrong token on the page does not verify", async () => {
    metaToken = "not-the-right-token";
    await call(B.cookie, "GET", "/site-verification");
    const res = await call(B.cookie, "POST", "/site-verification/check");
    expect(res.statusCode).toBe(400);
  });

  it("a verified paid organization can create a report, which is queued with its own organization id", async () => {
    const res = await call(A.cookie, "POST", "/reports");
    expect(res.statusCode).toBe(202);
    expect(queued.at(-1)).toEqual({ reportId: res.json().id, organizationId: A.orgId });
    const again = await call(A.cookie, "POST", "/reports");
    expect(again.statusCode).toBe(409); // one in progress at a time
    expect(again.json().error).toBe("report_in_progress");
  });

  it("finished reports are served only to their own organization, with a strict CSP", async () => {
    const [r] = await rawDb.select().from(schema.reports).where(eq(schema.reports.organizationId, A.orgId));
    await scopedDb(A.orgId).reports.update(r!.id, { status: "done", html: "<html><body><h1>Report</h1></body></html>", pdf: Buffer.from("%PDF-1.4 test"), finishedAt: new Date() });
    const html = await call(A.cookie, "GET", `/reports/${r!.id}/html`);
    expect(html.statusCode).toBe(200);
    expect(html.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(html.headers["content-security-policy"]).toContain("sandbox");
    expect(html.body).toContain("<h1>Report</h1>");
    const pdf = await call(A.cookie, "GET", `/reports/${r!.id}/pdf`);
    expect(pdf.statusCode).toBe(200);
    expect(pdf.headers["content-type"]).toContain("application/pdf");
    expect(pdf.headers["content-disposition"]).toContain("attachment");
    expect((await call(B.cookie, "GET", `/reports/${r!.id}/html`)).statusCode).toBe(404);
    expect((await call(B.cookie, "GET", `/reports/${r!.id}/pdf`)).statusCode).toBe(404);
    expect((await call(B.cookie, "GET", "/reports")).json()).toHaveLength(0);
    expect((await call(A.cookie, "GET", "/reports")).json()).toHaveLength(1);
  });

  it("changing the website resets verification", async () => {
    const res = await call(A.cookie, "PATCH", "/organization/profile", { websiteUrl: "https://new-site.example.org" });
    expect(res.statusCode).toBe(200);
    const info = await call(A.cookie, "GET", "/site-verification");
    expect(info.json()).toMatchObject({ host: "new-site.example.org", verified: false });
  });

  it("a WordPress connection for the same host verifies the site", async () => {
    await rawDb.insert(schema.platformConnections).values({ organizationId: A.orgId, provider: "wordpress", siteUrl: "https://new-site.example.org/", credentialsEncrypted: "x" });
    const res = await call(A.cookie, "POST", "/site-verification/check");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ verified: true, method: "wordpress" });
  });
});
