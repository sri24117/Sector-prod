import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { pool, rawDb, schema } from "@sector/db";
import { buildApp } from "../src/app.js";
import { startMockWordPress, type MockWp } from "./helpers/mock-wordpress.js";

// Slice 3 exit criterion: a real fix applied to a (mock) WordPress site is verifiably live and
// before/after score is recorded. Plus the negative cases CLAUDE.md §8 demands: cross-tenant, role, bad creds, SSRF.
let app: FastifyInstance; let wp: MockWp;
const APP_PASSWORD = "abcd efgh ijkl mnop";

async function signup(name: string, email: string) {
  const res = await app.inject({ method: "POST", url: "/auth/signup", payload: { organizationName: name, name: "Owner", email, password: "long-enough-password", websiteUrl: undefined } });
  expect(res.statusCode).toBe(201);
  const c = res.cookies.find((x) => x.name === "sector_session")!;
  return { cookie: `${c.name}=${c.value}`, orgId: res.json().organizationId as string, userId: res.json().userId as string };
}
const call = (cookie: string, method: "GET" | "POST", url: string, payload?: unknown) =>
  app.inject({ method, url, headers: { cookie }, payload: payload as never });

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
    A = await signup("Hope NGO", "a@hope.org"); B = await signup("Other NGO", "b@other.org");
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

  it("runs and persists an audit with findings; the site starts without schema", async () => {
    const res = await call(A.cookie, "POST", "/audits", { url: wp.url });
    expect(res.statusCode).toBe(201);
    const body = res.json(); auditId = body.id;
    const schemaF = body.findings.find((f: { checkId: string }) => f.checkId === "schema");
    expect(schemaF.passed).toBe(false); schemaFindingId = schemaF.id;
    robotsFindingId = body.findings.find((f: { checkId: string; passed: boolean }) => f.checkId === "llms_txt")!.id;
  });

  it("applies the schema fix, verifies it live on re-crawl, and records before/after in the RemediationLog", async () => {
    const res = await call(A.cookie, "POST", `/findings/${schemaFindingId}/remediate`);
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
      for (const target of ["http://127.0.0.1:1", "http://169.254.169.254/latest/meta-data", "http://10.0.0.5", "http://localhost"]) {
        const r = await call(A.cookie, "POST", "/audits", { url: target });
        expect(r.statusCode, target).toBe(400); expect(r.json().error).toBe("url_not_allowed");
      }
    } finally { process.env.ALLOW_PRIVATE_TARGETS = prev; }
  });
});
