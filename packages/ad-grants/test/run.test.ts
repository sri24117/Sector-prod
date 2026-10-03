import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool, rawDb, schema, scopedDb } from "@sector/db";
import { eq } from "drizzle-orm";
import { runComplianceCheck, FcraNotConfirmedError, NoAdGrantAccountError, type GoogleAdsGateway, type ComplianceSnapshot } from "../src/index.js";

const bad: ComplianceSnapshot = { accountCreatedAt: "2023-01-01", ctrLast30d: 0.02, ctrPrev30d: 0.02, conversionActions: [], campaigns: [{ name: "C", biddingStrategy: "MANUAL_CPC", adGroupCount: 1 }], keywords: [], uniqueSitelinkCount: 0 };
const ok: ComplianceSnapshot = { accountCreatedAt: "2023-01-01", ctrLast30d: 0.09, ctrPrev30d: 0.09, conversionActions: [{ name: "D", category: "PURCHASE", conversionsLast30d: 5 }], campaigns: [{ name: "C", biddingStrategy: "TARGET_CPA", adGroupCount: 2 }], keywords: [], uniqueSitelinkCount: 3 };
let current = bad; let calls = 0;
const gateway: GoogleAdsGateway = { async fetchSnapshot() { calls++; return current; } };
let A: string, B: string;

async function mkOrg(name: string, opts: { selfDeclared: boolean; confirmed: boolean }) {
  const [o] = await rawDb.insert(schema.organizations).values({ name }).returning();
  await rawDb.insert(schema.organizationProfiles).values({ organizationId: o!.id, fcraSelfDeclared: opts.selfDeclared, fcraConfirmedAt: opts.confirmed ? new Date() : null });
  await scopedDb(o!.id).adGrantAccount.upsert("123-456-7890");
  return o!.id;
}
beforeAll(async () => { A = await mkOrg("A", { selfDeclared: true, confirmed: true }); B = await mkOrg("B", { selfDeclared: true, confirmed: false }); });
afterAll(async () => { await pool.query("TRUNCATE organizations CASCADE"); await pool.end(); });

describe("runComplianceCheck", () => {
  it("FCRA GATE: self-declared but NOT confirmed => refused, gateway never called, nothing written", async () => {
    calls = 0;
    await expect(runComplianceCheck(B, gateway)).rejects.toBeInstanceOf(FcraNotConfirmedError);
    expect(calls).toBe(0);
    expect(await rawDb.select().from(schema.complianceAlerts).where(eq(schema.complianceAlerts.organizationId, B))).toHaveLength(0);
  });
  it("confirmed org: stores alerts that each cite rule, metric value and threshold", async () => {
    current = bad;
    const { alertCount } = await runComplianceCheck(A, gateway);
    expect(alertCount).toBeGreaterThan(0);
    const alerts = await scopedDb(A).complianceAlerts.listOpen();
    expect(alerts.length).toBe(alertCount);
    for (const a of alerts) { expect(a.ruleId).toBeTruthy(); expect(a.metricValue).toBeTruthy(); expect(a.threshold).toBeTruthy(); expect(a.message).toBeTruthy(); }
    expect(alerts.find((a) => a.ruleId === "ctr_5pct")!.metricValue).toBe("2.0%");
  });
  it("CROSS-TENANT: org B sees none of org A's alerts", async () => {
    expect(await scopedDb(B).complianceAlerts.listOpen()).toHaveLength(0);
  });
  it("re-running after the account is fixed resolves the open alerts", async () => {
    current = ok; await runComplianceCheck(A, gateway);
    expect(await scopedDb(A).complianceAlerts.listOpen()).toHaveLength(0);
    expect((await rawDb.select().from(schema.complianceAlerts).where(eq(schema.complianceAlerts.organizationId, A))).every((a) => a.resolvedAt)).toBe(true);
  });
  it("refuses when no Ad Grants account is linked", async () => {
    const [o] = await rawDb.insert(schema.organizations).values({ name: "NoAcct" }).returning();
    await rawDb.insert(schema.organizationProfiles).values({ organizationId: o!.id, fcraConfirmedAt: new Date() });
    await expect(runComplianceCheck(o!.id, gateway)).rejects.toBeInstanceOf(NoAdGrantAccountError);
  });
});

import { runAllComplianceChecks } from "../src/index.js";
describe("runAllComplianceChecks (scheduled job)", () => {
  it("only checks FCRA-confirmed orgs with a linked account; one org's failure doesn't block others", async () => {
    calls = 0; current = bad;
    const flaky: GoogleAdsGateway = { async fetchSnapshot(id) { calls++; if (calls === 1) throw new Error("boom"); return current; } };
    const [o2] = await rawDb.insert(schema.organizations).values({ name: "C2" }).returning();
    await rawDb.insert(schema.organizationProfiles).values({ organizationId: o2!.id, fcraConfirmedAt: new Date() });
    await scopedDb(o2!.id).adGrantAccount.upsert("999-999-9999");
    const res = await runAllComplianceChecks(flaky);
    expect(res.checked + res.failed.length).toBe(2);       // A and C2 eligible; B (unconfirmed) never touched
    expect(res.failed).toHaveLength(1);
    expect(res.checked).toBe(1);
    expect(JSON.stringify(res)).not.toContain(B);
  });
});
