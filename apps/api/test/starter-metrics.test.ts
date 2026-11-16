import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, rawDb, schema } from "@sector/db";
import { loadStarterPilotMetrics } from "../src/lib/starter-metrics.js";

describe("Starter pilot metrics", () => {
  const now = new Date("2026-11-16T12:00:00.000Z");
  let realId: string;
  let quietId: string;

  beforeAll(async () => {
    const [real] = await rawDb.insert(schema.organizations).values({ name: "Hope Foundation", plan: "starter" }).returning();
    const [quiet] = await rawDb.insert(schema.organizations).values({ name: "Quiet Trust", plan: "free" }).returning();
    const [demo] = await rawDb.insert(schema.organizations).values({ name: "Sales (Demo)", plan: "pro" }).returning();
    realId = real!.id;
    quietId = quiet!.id;
    const recent = new Date("2026-11-15T12:00:00.000Z");

    await rawDb.insert(schema.audits).values([
      { organizationId: realId, url: "https://hope.example", score: 60, runAt: recent },
      { organizationId: demo!.id, url: "https://demo.example", score: 90, runAt: recent },
    ]);
    await rawDb.insert(schema.platformConnections).values({ organizationId: realId, provider: "wordpress", status: "connected", siteUrl: "https://hope.example", credentialsEncrypted: "encrypted" });
    await rawDb.insert(schema.remediationLogs).values({ organizationId: realId, findingId: "finding-1", platform: "wordpress", action: "schema", status: "verified", beforeScore: 60, afterScore: 72, createdAt: recent });
    await rawDb.insert(schema.reports).values({ organizationId: realId, siteUrl: "https://hope.example", status: "done", createdBy: "ops", createdAt: recent, finishedAt: recent });
    const [exported] = await rawDb.insert(schema.contentAssets).values({ organizationId: realId, kind: "social_post", title: "Impact", body: "Update", status: "exported", createdBy: "ops", createdAt: recent }).returning();
    await rawDb.insert(schema.contentAssets).values({ organizationId: quietId, kind: "social_post", title: "Draft", body: "Draft", status: "draft", createdBy: "ops", createdAt: new Date("2026-10-01T00:00:00.000Z") });
    await rawDb.insert(schema.calendarItems).values({ organizationId: realId, contentAssetId: exported!.id, date: "2026-11-18", channel: "linkedin", objective: "Share impact", assignee: "Asha", createdAt: recent });
    await rawDb.insert(schema.planRequests).values({ organizationId: realId, organizationName: "Hope Foundation", contactName: "Asha", email: "asha@hope.example", plan: "starter", billingCycle: "monthly", status: "activated", createdAt: recent, updatedAt: recent });
  });

  afterAll(async () => {
    await pool.query("TRUNCATE organizations CASCADE");
    await pool.end();
  });

  it("reports real Starter usage and excludes demo organizations", async () => {
    await expect(loadStarterPilotMetrics(pool, now)).resolves.toEqual({
      organizations: 2,
      plans: { free: 1, starter: 1, growth: 0, pro: 0 },
      auditedOrganizations: 1,
      wordpressConnectedOrganizations: 1,
      remediationAttempts: 1,
      verifiedFixes: 1,
      averageScoreChange: 12,
      finishedReports: 1,
      contentCreated: 2,
      contentApproved: 1,
      contentExported: 1,
      calendarItems: 1,
      activeOrganizationsLast7Days: 1,
      outcomeOrganizationsLast7Days: 1,
      activatedStarterOrganizations: 1,
    });
  });
});
