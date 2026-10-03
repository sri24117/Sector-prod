import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { pool, rawDb, schema } from "@sector/db";
import type { GoogleAdsGateway } from "@sector/ad-grants";
import { buildApp } from "../src/app.js";

let app: FastifyInstance;
const gateway: GoogleAdsGateway = { async fetchSnapshot() { return { accountCreatedAt: "2023-01-01", ctrLast30d: 0.031, ctrPrev30d: 0.09, conversionActions: [{ name: "D", category: "PURCHASE", conversionsLast30d: 4 }], campaigns: [{ name: "C", biddingStrategy: "TARGET_CPA", adGroupCount: 2 }], keywords: [], uniqueSitelinkCount: 3 }; } };
const call = (cookie: string, method: "GET" | "POST", url: string, payload?: unknown) => app.inject({ method, url, headers: { cookie }, payload: payload as never });
async function signup(name: string, email: string, fcraSelfDeclared: boolean) {
  const r = await app.inject({ method: "POST", url: "/auth/signup", payload: { organizationName: name, name: "O", email, password: "long-enough-password", fcraSelfDeclared } });
  const c = r.cookies.find((x) => x.name === "sector_session")!;
  return { cookie: `${c.name}=${c.value}`, orgId: r.json().organizationId as string, userId: r.json().userId as string };
}
beforeAll(async () => { app = await buildApp({ adsGateway: gateway }); await app.ready(); });
afterAll(async () => { await pool.query("TRUNCATE organizations, users, memberships, organization_profiles, sessions, security_event_log CASCADE"); await app.close(); await pool.end(); });

describe("Slice 4: Ad Grants routes", () => {
  it("FCRA gate: an org that only SELF-declared FCRA is refused on every route, with a neutral message", async () => {
    const S = await signup("Self NGO", "self@x.org", true);
    for (const [m, u, body] of [["POST", "/ad-grants/account", { googleCustomerId: "123-456-7890" }], ["POST", "/ad-grants/compliance/run", undefined], ["GET", "/ad-grants/alerts", undefined]] as const) {
      const r = await call(S.cookie, m, u, body);
      expect(r.statusCode, u).toBe(403); expect(r.json().error).toBe("not_available");
      expect(r.json().message).not.toMatch(/grant of|\$10,000|eligible|unlock/i); // no teasing
    }
    expect((await rawDb.select().from(schema.adGrantAccounts).where(eq(schema.adGrantAccounts.organizationId, S.orgId)))).toHaveLength(0);
    expect((await rawDb.select().from(schema.securityEventLog).where(eq(schema.securityEventLog.action, "ad_grants_fcra_gate_denied"))).length).toBeGreaterThan(0);
  });

  let A: Awaited<ReturnType<typeof signup>>; let B: Awaited<ReturnType<typeof signup>>;
  it("ops-confirmed org: links account, runs the check, gets alerts citing rule + metric", async () => {
    A = await signup("Confirmed NGO", "conf@x.org", true); B = await signup("Other NGO", "other@x.org", true);
    await rawDb.update(schema.organizationProfiles).set({ fcraConfirmedAt: new Date() }).where(eq(schema.organizationProfiles.organizationId, A.orgId));
    await rawDb.update(schema.organizationProfiles).set({ fcraConfirmedAt: new Date() }).where(eq(schema.organizationProfiles.organizationId, B.orgId));
    expect((await call(A.cookie, "POST", "/ad-grants/account", { googleCustomerId: "not-an-id" })).statusCode).toBe(400);
    const link = await call(A.cookie, "POST", "/ad-grants/account", { googleCustomerId: "123-456-7890" });
    expect(link.statusCode).toBe(201); expect(link.json().googleCustomerId).toBe("1234567890");
    const run = await call(A.cookie, "POST", "/ad-grants/compliance/run");
    expect(run.statusCode).toBe(200);
    const ctr = run.json().alerts.find((a: { ruleId: string }) => a.ruleId === "ctr_5pct");
    expect(ctr).toMatchObject({ metricValue: "3.1%", threshold: "5.0%" });
  });
  it("CROSS-TENANT: another confirmed org sees none of these alerts, and has no account to run against", async () => {
    expect((await call(B.cookie, "GET", "/ad-grants/alerts")).json()).toHaveLength(0);
    expect((await call(B.cookie, "POST", "/ad-grants/compliance/run")).statusCode).toBe(409);
  });
  it("ROLE: viewers can read alerts but cannot trigger a run", async () => {
    await rawDb.update(schema.memberships).set({ role: "viewer" }).where(eq(schema.memberships.userId, A.userId));
    expect((await call(A.cookie, "GET", "/ad-grants/alerts")).statusCode).toBe(200);
    expect((await call(A.cookie, "POST", "/ad-grants/compliance/run")).statusCode).toBe(403);
  });
  it("production default (no API access yet) fails honestly with 501, never fake data", async () => {
    const real = await buildApp(); await real.ready();
    await rawDb.update(schema.memberships).set({ role: "owner" }).where(eq(schema.memberships.userId, A.userId));
    const r = await real.inject({ method: "POST", url: "/ad-grants/compliance/run", headers: { cookie: A.cookie } });
    expect(r.statusCode).toBe(501); await real.close();
  });
});
