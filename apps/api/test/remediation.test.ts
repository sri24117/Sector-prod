import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { pool, rawDb, schema } from "@sector/db";
import { buildApp } from "../src/app.js";
import { startMockWordPress, type MockWp } from "./helpers/mock-wordpress.js";

// Slice 3 exit criterion: a real fix applied to a (mock) WordPress site is verifiably live and
// before/after score is recorded. Plus the negative cases CLAUDE.md §8 demands: cross-tenant, role, bad creds, SSRF.
let app: FastifyInstance; let wp: MockWp; let signupAddress = 0;
const APP_PASSWORD = "abcd efgh ijkl mnop";

async function signup(name: string, email: string, websiteUrl?: string) {
  const res = await app.inject({ method: "POST", url: "/auth/signup", remoteAddress: `192.0.2.${++signupAddress}`, payload: { acceptTerms: true, organizationName: name, name: "Owner", email, password: "long-enough-password", websiteUrl } });
  expect(res.statusCode).toBe(201);
  const c = res.cookies.find((x) => x.name === "sector_session")!;
  await rawDb.update(schema.organizations).set({ plan: "starter" }).where(eq(schema.organizations.id, res.json().organizationId)); // live fixes are Starter and above
  return { cookie: `${c.name}=${c.value}`, orgId: res.json().organizationId as string, userId: res.json().userId as string };
}
const clientAddresses = new Map<string, string>();
const call = (cookie: string, method: "GET" | "POST", url: string, payload?: unknown) => {
  if (!clientAddresses.has(cookie)) clientAddresses.set(cookie, `198.51.100.${clientAddresses.size + 1}`);
  return app.inject({ method, url, remoteAddress: clientAddresses.get(cookie), headers: { cookie }, payload: payload as never });
};

beforeAll(async () => {
  app = await buildApp(); await app.ready();
  wp = await startMockWordPress({ username: "admin", appPassword: APP_PASSWORD });
});
afterAll(async () => {
  await pool.query("TRUNCATE organizations, users, memberships, organization_profiles, sessions, security_event_log CASCADE");
  await wp.close(); await app.close(); await pool.end();
});

describe("Slice 3 remediation (WordPress)", () => {
  let A: Awaited<ReturnType<typeof signup>>; let B: Awaited<ReturnType<typeof signup>>;
  let auditId: string; let schemaFindingId: string; let robotsFindingId: string;

  it("connects WordPress, storing credentials ENCRYPTED and never returning them", async () => {
    A = await signup("Hope NGO", "a@hope.org", wp.url); B = await signup("Other NGO", "b@other.org");
    const res = await call(A.cookie, "POST", "/connections/wordpress", { siteUrl: wp.url, username: "admin", applicationPassword: APP_PASSWORD });
    expect(res.statusCode).toBe(201);
    expect(JSON.stringify(res.json())).not.toContain(APP_PASSWORD);
    const [row] = await rawDb.select().from(schema.platformConnections).where(eq(schema.platformConnections.organizationId, A.orgId));
    expect(row!.credentialsEncrypted).not.toContain(APP_PASSWORD);
    expect(row!.credentialsEncrypted).not.toContain("admin");
  });

  it("rejects wrong credentials and a site without the companion plugin", async () => {
    const bad = await call(A.cookie, "POST", "/connections/wordpress", { siteUrl: wp.url, username: "admin", applicationPassword: "wrong" });
    expect(bad.statusCode).toBe(400);
    const noPlugin = await startMockWordPress({ username: "admin", appPassword: APP_PASSWORD, pluginInstalled: false });
    const res = await call(A.cookie, "POST", "/connections/wordpress", { siteUrl: noPlugin.url, username: "admin", applicationPassword: APP_PASSWORD });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/companion plugin/i);
    await noPlugin.close();
  });

  it("names the address to use when the site redirects, without sending credentials there", async () => {
    // e.g. apex -> www. Following it would forward the Basic-auth header to another host.
    const { createServer } = await import("node:http");
    let authSeen = false;
    const redirector = createServer((req, res) => { if (req.headers.authorization) authSeen = true; res.writeHead(301, { location: `${wp.url}${req.url}` }).end(); });
    await new Promise<void>((r) => redirector.listen(0, "127.0.0.1", r));
    const port = (redirector.address() as { port: number }).port;
    const res = await call(A.cookie, "POST", "/connections/wordpress", { siteUrl: `http://127.0.0.1:${port}`, username: "admin", applicationPassword: APP_PASSWORD });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain(`redirects to ${wp.url}/`);
    expect(authSeen).toBe(true); // first request carries auth to the address the user gave — and only there
    await new Promise<void>((r) => redirector.close(() => r()));
  });

  it("refuses a plain-http site address, so the Application Password is never sent unencrypted", async () => {
    for (const siteUrl of ["http://ngo.example.org", "http://10.0.0.5"]) {
      const res = await call(B.cookie, "POST", "/connections/wordpress", { siteUrl, username: "admin", applicationPassword: APP_PASSWORD });
      expect(res.statusCode, siteUrl).toBe(400);
      expect(res.json().error).toBe("https_required");
      expect(res.json().message).toMatch(/https:\/\//);
    }
    expect((await call(B.cookie, "GET", "/connections/wordpress")).statusCode).toBe(404); // nothing stored
  });

  it("runs and persists an audit with findings; the site starts without schema", async () => {
    const res = await call(A.cookie, "POST", "/audits", { url: wp.url });
    expect(res.statusCode).toBe(201);
    const body = res.json(); auditId = body.id;
    const schemaF = body.findings.find((f: { checkId: string }) => f.checkId === "schema");
    expect(schemaF.passed).toBe(false); schemaFindingId = schemaF.id;
    robotsFindingId = body.findings.find((f: { checkId: string; passed: boolean }) => f.checkId === "llms_txt")!.id;
  });

  it("applies the schema fix, verifies it live on re-crawl, and records before/after in the RemediationLog", async () => {
    const proposal = (await call(A.cookie, "GET", `/findings/${schemaFindingId}/proposal`)).json();
    const res = await call(A.cookie, "POST", `/findings/${schemaFindingId}/remediate`, { approvalToken: proposal.approvalToken });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.mode).toBe("applied"); expect(body.status).toBe("verified");
    expect(body.afterScore).toBeGreaterThan(body.beforeScore);
    expect((wp.state.jsonLd as { "@type": string; name: string })).toMatchObject({ "@type": "NGO", name: "Hope NGO" });
    const logs = (await call(A.cookie, "GET", "/remediations")).json();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ platform: "wordpress", status: "verified", beforeScore: body.beforeScore, afterScore: body.afterScore });
  });

  it("issues an honest manual package (no fake auto-fix) for checks with no live mechanism", async () => {
    const res = await call(A.cookie, "POST", `/findings/${robotsFindingId}/remediate`);
    expect(res.json().mode).toBe("manual");
    expect(res.json().package.steps.length).toBeGreaterThan(0);
  });

  it("refuses remediating a check that already passes", async () => {
    const audits = (await call(A.cookie, "GET", "/audits")).json();
    const latest = (await call(A.cookie, "GET", `/audits/${audits[0].id}`)).json();
    const passing = latest.findings.find((f: { passed: boolean }) => f.passed);
    expect((await call(A.cookie, "POST", `/findings/${passing.id}/remediate`)).statusCode).toBe(409);
  });

  it("CROSS-TENANT: org B cannot read, remediate, or see org A's audits/findings/remediations", async () => {
    expect((await call(B.cookie, "GET", `/audits/${auditId}`)).statusCode).toBe(404);
    const stolen = await call(B.cookie, "POST", `/findings/${schemaFindingId}/remediate`);
    expect(stolen.statusCode).toBe(404);
    expect((await call(B.cookie, "GET", "/audits")).json()).toHaveLength(0);
    expect((await call(B.cookie, "GET", "/remediations")).json()).toHaveLength(0);
    expect((await call(B.cookie, "GET", "/connections/wordpress")).statusCode).toBe(404);
    const denied = await rawDb.select().from(schema.securityEventLog).where(eq(schema.securityEventLog.action, "finding_not_found_or_foreign"));
    expect(denied.length).toBeGreaterThan(0); // probing is logged
  });

  it("ROLE: a viewer can read but not run audits or remediate", async () => {
    await rawDb.update(schema.memberships).set({ role: "viewer" }).where(eq(schema.memberships.userId, A.userId));
    expect((await call(A.cookie, "GET", "/audits")).statusCode).toBe(200);
    expect((await call(A.cookie, "POST", "/audits", { url: wp.url })).statusCode).toBe(403);
    expect((await call(A.cookie, "POST", `/findings/${schemaFindingId}/remediate`)).statusCode).toBe(403);
    await rawDb.update(schema.memberships).set({ role: "owner" }).where(eq(schema.memberships.userId, A.userId));
  });

  it("requires authentication", async () => {
    expect((await app.inject({ method: "POST", url: "/audits", payload: { url: wp.url } })).statusCode).toBe(401);
  });

  it("SSRF: refuses loopback/private targets when private targets are not allowed", async () => {
    const prev = process.env.ALLOW_PRIVATE_TARGETS; process.env.ALLOW_PRIVATE_TARGETS = "0";
    try {
      // In-app audits only target the org's own website, so the SSRF guard is exercised by
      // pointing that website at private addresses.
      for (const target of ["http://127.0.0.1:1", "http://169.254.169.254/latest/meta-data", "http://10.0.0.5", "http://localhost"]) {
        await rawDb.update(schema.organizationProfiles).set({ websiteUrl: target }).where(eq(schema.organizationProfiles.organizationId, A.orgId));
        const r = await call(A.cookie, "POST", "/audits", {});
        expect(r.statusCode, target).toBe(400); expect(r.json().error).toBe("url_not_allowed");
      }
      await rawDb.update(schema.organizationProfiles).set({ websiteUrl: wp.url }).where(eq(schema.organizationProfiles.organizationId, A.orgId));
    } finally { process.env.ALLOW_PRIVATE_TARGETS = prev; }
  });
});

describe("Starter remediation guardrails", () => {
  async function setupFix(tag: string, options = {}) {
    const mock = await startMockWordPress({ username: "admin", appPassword: APP_PASSWORD, ...options });
    const org = await signup(tag, `${tag}@example.org`, mock.url);
    await call(org.cookie, "POST", "/connections/wordpress", { siteUrl: mock.url, username: "admin", applicationPassword: APP_PASSWORD });
    const audit = (await call(org.cookie, "POST", "/audits", {})).json();
    const finding = audit.findings.find((f: { checkId: string }) => f.checkId === "schema");
    const p = (await call(org.cookie, "GET", `/findings/${finding.id}/proposal`)).json();
    return { mock, org, finding, p };
  }
  it("targets the connected WordPress subdirectory instead of silently using the domain root", async () => {
    const x = await setupFix("subdirectory", { pathPrefix: "/ngo" });
    try {
      expect(x.p.siteUrl).toContain("/ngo");
      const r = await call(x.org.cookie, "POST", `/findings/${x.finding.id}/remediate`, { approvalToken: x.p.approvalToken });
      expect(r.statusCode).toBe(200); expect(r.json().status).toBe("verified"); expect(x.mock.state.schemaPosts).toBe(1);
    } finally { await x.mock.close(); }
  });
  it("blocks writes if the organization's website changes after review", async () => {
    const x = await setupFix("target-change");
    try {
      await rawDb.update(schema.organizationProfiles).set({ websiteUrl: "https://different.example.org" }).where(eq(schema.organizationProfiles.organizationId, x.org.orgId));
      const r = await call(x.org.cookie, "POST", `/findings/${x.finding.id}/remediate`, { approvalToken: x.p.approvalToken });
      expect(r.statusCode).toBe(409); expect(r.json().error).toBe("site_mismatch"); expect(x.mock.state.schemaPosts).toBe(0);
    } finally { await x.mock.close(); }
  });
  it("requires explicit current review and rejects a stale schema snapshot", async () => {
    const x = await setupFix("stale-change");
    try {
      expect((await call(x.org.cookie, "POST", `/findings/${x.finding.id}/remediate`)).json().error).toBe("review_required");
      x.mock.state.jsonLd = { "@type": "NGO", name: "Changed by site owner" };
      expect((await call(x.org.cookie, "POST", `/findings/${x.finding.id}/remediate`, { approvalToken: x.p.approvalToken })).json().error).toBe("review_required");
      expect(x.mock.state.schemaPosts).toBe(0);
    } finally { await x.mock.close(); }
  });
  it("keeps a successful write as applied_unverified when the crawl fails", async () => {
    const x = await setupFix("verification-fails");
    try {
      x.mock.state.failAfterWrite = true;
      const r = await call(x.org.cookie, "POST", `/findings/${x.finding.id}/remediate`, { approvalToken: x.p.approvalToken });
      expect(r.statusCode).toBe(200); expect(r.json().status).toBe("applied_unverified");
      expect(r.body).not.toContain("Nothing was changed"); expect(x.mock.state.schemaPosts).toBe(1);
      const logs = (await call(x.org.cookie, "GET", "/remediations")).json();
      expect(logs[0].status).toBe("applied_unverified");
    } finally { await x.mock.close(); }
  });
  it("prevents duplicate application and restores the previous plugin value", async () => {
    const x = await setupFix("restore-change");
    try {
      const r = await call(x.org.cookie, "POST", `/findings/${x.finding.id}/remediate`, { approvalToken: x.p.approvalToken });
      expect(r.statusCode).toBe(200); expect(x.mock.state.schemaPosts).toBe(1);
      const retry = await call(x.org.cookie, "POST", `/findings/${x.finding.id}/remediate`, { approvalToken: x.p.approvalToken });
      expect(retry.statusCode).toBe(409); expect(x.mock.state.schemaPosts).toBe(1);
      const restored = await call(x.org.cookie, "POST", `/remediations/${r.json().remediationLogId}/restore`, { confirm: true });
      expect(restored.statusCode).toBe(200); expect(restored.json().status).toBe("restored"); expect(x.mock.state.jsonLd).toBe(null);
    } finally { await x.mock.close(); }
  });
});
