import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { AuditResult } from "@sector/crawler";
import { pool, rawDb, schema, scopedDb } from "@sector/db";
import { runResearchAuditJob, type ResearchDeps } from "../src/research/run.js";
import type { ReportData } from "../src/report/types.js";

const org = crypto.randomUUID();
const SITE = "https://ngo.example.org/";
const home = { url: SITE, status: 200, title: "Asha", metaDescription: "d", canonical: SITE, lang: "en", hasViewport: true, h1: 1, h2: 1, jsonLdTypes: ["NGO"], images: 1, imagesMissingAlt: 0, words: 600, internalLinks: [`${SITE}about`, `${SITE}donate`, `${SITE}programs`, `${SITE}contact`], socialLinks: [], og: { title: "a", image: "b" }, twitterCard: "summary" };
const data = (over: Partial<ReportData> = {}): ReportData => ({
  siteUrl: SITE, organizationName: "", generatedAt: "2026-10-13T00:00:00.000Z", pages: [home], brokenLinks: [], unreachable: [],
  lighthouse: [{ url: SITE, scores: { performance: 90, seo: 95, accessibility: 92, bestPractices: 100 }, metrics: { lcpMs: 1800, cls: 0.02 }, failed: [] }],
  axe: [], screenshots: {}, social: [{ platform: "Facebook", url: "https://facebook.com/asha", state: "ok" }], notes: [], ...over,
});
const audit: AuditResult = { url: SITE, score: 80, runAt: "x", platform: "squarespace", htmlWords: 500, checks: [{ checkId: "schema", weight: 20, passed: true, detail: "ok" }] };
const deps = (over: Partial<ResearchDeps> = {}): ResearchDeps => ({ collect: vi.fn(async () => data()), runAudit: vi.fn(async () => audit), ...over });
const make = () => scopedDb(org).researchAudits.create({ siteUrl: SITE, createdBy: "u" }).then((a) => a.id);
const row = (id: string) => scopedDb(org).researchAudits.findById(id);

beforeAll(async () => { await rawDb.insert(schema.organizations).values({ id: org, name: "Job Org" }); });
afterAll(async () => { await pool.query("TRUNCATE organizations CASCADE"); await pool.end(); });

describe("runResearchAuditJob", () => {
  it("stores findings and scores and leaves the audit in review, never released", async () => {
    const id = await make();
    await runResearchAuditJob({ auditId: id, organizationId: org }, deps());
    const a = (await row(id))!;
    expect(a.status).toBe("in_review");
    expect(a.releasedAt).toBeNull();
    expect(a.platform).toBe("squarespace");
    expect(a.overallScore).toBe(100);
    expect(a.seoScore).toBe(100);
    expect(a.layerWeights).toEqual({ rules: 50, reference: 30, peer: 20 });
    expect(a.pillarWeights).toEqual({ seo: 25, aio: 25, uiux: 25, brand: 25 });
    expect((a.summary as { layersUsed: string[] }).layersUsed).toEqual(["rules"]);
    const found = await scopedDb(org).researchAudits.findings(id);
    expect(found.length).toBeGreaterThan(20);
    expect(found.every((f) => f.layer === "rules" && f.organizationId === org)).toBe(true);
  });

  it("does nothing when the audit is not queued, so a repeated delivery writes nothing twice", async () => {
    const id = await make();
    const d = deps();
    await runResearchAuditJob({ auditId: id, organizationId: org }, d);
    const before = (await scopedDb(org).researchAudits.findings(id)).length;
    await runResearchAuditJob({ auditId: id, organizationId: org }, d);
    expect(d.collect).toHaveBeenCalledTimes(1);
    expect((await scopedDb(org).researchAudits.findings(id)).length).toBe(before);
    await runResearchAuditJob({ auditId: crypto.randomUUID(), organizationId: org }, d); // unknown id
    expect(d.collect).toHaveBeenCalledTimes(1);
  });

  it("will not touch another organization's audit", async () => {
    const other = crypto.randomUUID();
    await rawDb.insert(schema.organizations).values({ id: other, name: "Other" });
    const id = await make();
    const d = deps();
    await runResearchAuditJob({ auditId: id, organizationId: other }, d);
    expect(d.collect).not.toHaveBeenCalled();
    expect((await row(id))!.status).toBe("queued");
  });

  it("marks the audit failed with a plain message and stores no findings when collection fails", async () => {
    const id = await make();
    await runResearchAuditJob({ auditId: id, organizationId: org }, deps({ collect: vi.fn(async () => { throw new Error("Your homepage answered with error 500."); }) }));
    const a = (await row(id))!;
    expect(a.status).toBe("failed");
    expect(a.error).toMatch(/homepage/i);
    expect(a.overallScore).toBeNull();
    expect(await scopedDb(org).researchAudits.findings(id)).toEqual([]);
  });

  it("still completes with platform unknown when only the plain-HTTP check failed", async () => {
    const id = await make();
    await runResearchAuditJob({ auditId: id, organizationId: org }, deps({ runAudit: vi.fn(async () => { throw new Error("blocked"); }) }));
    const a = (await row(id))!;
    expect(a.status).toBe("in_review");
    expect(a.platform).toBe("unknown");
    expect(a.aioScore).toBeNull(); // every AI-readiness check was could_not_check
    expect(a.seoScore).toBe(100);
  });

  it("stores empty scores, not zeros, when no page could be read", async () => {
    const id = await make();
    await runResearchAuditJob({ auditId: id, organizationId: org }, deps({ collect: vi.fn(async () => data({ pages: [] })) }));
    const a = (await row(id))!;
    expect(a.status).toBe("in_review");
    expect(a.overallScore).toBeNull();
    expect(a.seoScore).toBeNull();
  });

  it("fails the audit instead of hanging when it exceeds its time limit", async () => {
    const id = await make();
    const never = vi.fn((_u: string, signal: AbortSignal) => new Promise<ReportData>((_r, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })));
    await runResearchAuditJob({ auditId: id, organizationId: org }, deps({ collect: never as never }), 50);
    const a = (await row(id))!;
    expect(a.status).toBe("failed");
    expect(a.error).toMatch(/too long/i);
    expect(a.status).not.toBe("released");
  });
});
