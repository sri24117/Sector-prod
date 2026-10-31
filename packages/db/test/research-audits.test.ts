import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { rawDb, pool, schema } from "../src/client.js";
import { scopedDb } from "../src/tenant-scope.js";

const orgA = crypto.randomUUID();
const orgB = crypto.randomUUID();
let auditA: string;

beforeAll(async () => {
  await rawDb.insert(schema.organizations).values([{ id: orgA, name: "Org A" }, { id: orgB, name: "Org B" }]);
  auditA = (await scopedDb(orgA).researchAudits.create({ siteUrl: "https://a.example.org/", createdBy: "u1" })).id;
});
afterAll(async () => {
  await pool.query("TRUNCATE organizations, reference_sources CASCADE");
  await pool.end();
});

describe("researchAudits repository", () => {
  it("creates a queued audit scoped to the organization", async () => {
    const row = await scopedDb(orgA).researchAudits.findById(auditA);
    expect(row?.status).toBe("queued");
    expect(row?.organizationId).toBe(orgA);
    expect(row?.releasedAt).toBeNull();
  });

  it("never returns another organization's audit by id", async () => {
    expect(await scopedDb(orgB).researchAudits.findById(auditA)).toBeNull();
    expect(await scopedDb(orgB).researchAudits.list()).toEqual([]);
    expect(await scopedDb(orgB).researchAudits.update(auditA, { status: "failed" })).toBeNull();
    expect((await scopedDb(orgA).researchAudits.findById(auditA))?.status).toBe("queued");
  });

  it("refuses to add findings to another organization's audit", async () => {
    await expect(scopedDb(orgB).researchAudits.addFindings(auditA, [{ pillar: "seo", layer: "rules", checkId: "c", result: "pass", points: 5 }])).rejects.toThrow("audit_not_found");
  });

  it("stores findings and returns them only through releasedFindings once released", async () => {
    const db = scopedDb(orgA).researchAudits;
    expect(await db.addFindings(auditA, [
      { pillar: "seo", layer: "rules", checkId: "title", result: "fail", points: 10, fix: "Add a title" },
      { pillar: "seo", layer: "peer", checkId: "peer-faq", result: "pass", points: 5, sourceUrl: "https://peer.example.org/", sourceName: "Peer NGO" },
    ])).toBe(2);
    expect((await db.findings(auditA)).length).toBe(2);
    expect(await db.releasedFindings(auditA)).toBeNull(); // queued
    await db.update(auditA, { status: "in_review" });
    expect(await db.releasedFindings(auditA)).toBeNull(); // in review is still hidden
    await rawDb.update(schema.researchAudits).set({ status: "released", releasedAt: new Date() }).where(eq(schema.researchAudits.id, auditA));
    const shown = await db.releasedFindings(auditA);
    expect(shown?.length).toBe(2);
    expect(shown?.find((x) => x.layer === "peer")?.sourceName).toBe("Peer NGO");
    expect(await scopedDb(orgB).researchAudits.releasedFindings(auditA)).toBeNull();
  });

  it("update cannot set releasedAt", async () => {
    const db = scopedDb(orgA).researchAudits;
    const b = await db.create({ siteUrl: "https://a.example.org/", createdBy: "u1" });
    await db.update(b.id, { status: "in_review", releasedAt: new Date() } as never);
    expect((await db.findById(b.id))?.releasedAt).toBeNull();
  });

  it("update refuses status released and leaves the audit unchanged", async () => {
    const db = scopedDb(orgA).researchAudits;
    const c = await db.create({ siteUrl: "https://a.example.org/", createdBy: "u1" });
    await db.addFindings(c.id, [{ pillar: "seo", layer: "rules", checkId: "c", result: "pass", points: 1 }]);
    expect(() => db.update(c.id, { status: "released" } as never)).toThrow("release_forbidden");
    expect((await db.findById(c.id))?.status).toBe("queued");
    expect(await db.releasedFindings(c.id)).toBeNull();
  });

  it("releasedFindings requires released_at, not just status released", async () => {
    const db = scopedDb(orgA).researchAudits;
    const d = await db.create({ siteUrl: "https://a.example.org/", createdBy: "u1" });
    await db.addFindings(d.id, [{ pillar: "seo", layer: "rules", checkId: "c", result: "pass", points: 1 }]);
    await rawDb.update(schema.researchAudits).set({ status: "released" }).where(eq(schema.researchAudits.id, d.id));
    expect(await db.releasedFindings(d.id)).toBeNull();
    await rawDb.update(schema.researchAudits).set({ releasedAt: new Date() }).where(eq(schema.researchAudits.id, d.id));
    expect((await db.releasedFindings(d.id))?.length).toBe(1);
  });

  it("counts active audits and audits since a time", async () => {
    const db = scopedDb(orgB).researchAudits;
    expect(await db.activeCount()).toBe(0);
    const x = await db.create({ siteUrl: "https://b.example.org/", createdBy: "u2" });
    expect(await db.activeCount()).toBe(1);
    await db.update(x.id, { status: "in_review" });
    expect(await db.activeCount()).toBe(0);
    expect(await db.countSince(new Date(Date.now() - 60_000))).toBe(1);
    expect(await db.countSince(new Date(Date.now() + 60_000))).toBe(0);
  });
  it("update returns null and changes nothing once an audit is released", async () => {
    const db = scopedDb(orgA).researchAudits;
    const a = await db.create({ siteUrl: "https://a.example.org/", createdBy: "u1" });
    await rawDb.update(schema.researchAudits).set({ status: "released", releasedAt: new Date(), overallScore: 70 }).where(eq(schema.researchAudits.id, a.id));
    expect(await db.update(a.id, { overallScore: 5, status: "failed" })).toBeNull();
    const row = await db.findById(a.id);
    expect(row?.status).toBe("released");
    expect(row?.overallScore).toBe(70);
  });
});

describe("research tables constraints", () => {
  it("rejects a peer finding whose source_url is only whitespace", async () => {
    await expect(rawDb.insert(schema.researchFindings).values({ auditId: auditA, organizationId: orgA, pillar: "seo", layer: "peer", checkId: "x", result: "pass", points: 5, sourceUrl: "   " })).rejects.toThrow();
  });

  it("rejects a peer or reference finding with no source_url", async () => {
    for (const layer of ["peer", "reference"]) {
      await expect(rawDb.insert(schema.researchFindings).values({ auditId: auditA, organizationId: orgA, pillar: "seo", layer, checkId: "x", result: "pass", points: 5 })).rejects.toThrow();
    }
  });

  it("rejects unknown pillar, layer, result and status values", async () => {
    const base = { auditId: auditA, organizationId: orgA, pillar: "seo", layer: "rules", checkId: "x", result: "pass", points: 1 };
    await expect(rawDb.insert(schema.researchFindings).values({ ...base, pillar: "social" })).rejects.toThrow();
    await expect(rawDb.insert(schema.researchFindings).values({ ...base, layer: "guess" })).rejects.toThrow();
    await expect(rawDb.insert(schema.researchFindings).values({ ...base, result: "maybe" })).rejects.toThrow();
    await expect(rawDb.update(schema.researchAudits).set({ status: "done" }).where(eq(schema.researchAudits.id, auditA))).rejects.toThrow();
  });

  it("deleting an organization removes its audits and findings", async () => {
    const o = crypto.randomUUID();
    await rawDb.insert(schema.organizations).values({ id: o, name: "Temp" });
    const a = await scopedDb(o).researchAudits.create({ siteUrl: "https://t.example.org/", createdBy: "u" });
    await scopedDb(o).researchAudits.addFindings(a.id, [{ pillar: "seo", layer: "rules", checkId: "c", result: "pass", points: 1 }]);
    await rawDb.delete(schema.organizations).where(eq(schema.organizations.id, o));
    expect(await rawDb.select().from(schema.researchFindings).where(eq(schema.researchFindings.auditId, a.id))).toEqual([]);
  });
});
