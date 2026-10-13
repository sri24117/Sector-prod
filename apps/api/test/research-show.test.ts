import { describe, it, expect } from "vitest";
import type { schema } from "@sector/db";
import { formatAudit } from "../src/lib/research-show.js";

type A = typeof schema.researchAudits.$inferSelect;
type F = typeof schema.researchFindings.$inferSelect;
const audit = (over: Partial<A> = {}): A => ({
  id: "a1", organizationId: "o1", siteUrl: "https://ngo.example.org/", platform: "wix", status: "in_review", error: null,
  seoScore: 80, aioScore: null, uiuxScore: 60, brandScore: 50, overallScore: 63, layerWeights: { rules: 50, reference: 30, peer: 20 }, pillarWeights: null,
  summary: { benchmarkNote: "Benchmarks are not included yet.", couldNotCheck: 2 }, createdBy: "u", createdAt: new Date("2026-10-13T10:00:00Z"), releasedAt: null, ...over,
});
const finding = (over: Partial<F> = {}): F => ({
  id: "f1", auditId: "a1", organizationId: "o1", pillar: "seo", layer: "rules", checkId: "seo.titles", result: "fail", evidence: "No title on: https://ngo.example.org/x",
  sourceId: null, sourceUrl: null, sourceName: null, fix: "Give every page a title.", effort: "5 minutes", points: 15, ...over,
});

describe("formatAudit", () => {
  const text = formatAudit(audit(), [
    finding(),
    finding({ id: "f2", checkId: "seo.https", result: "pass", evidence: null, fix: null, points: 10 }),
    finding({ id: "f3", pillar: "aio", checkId: "aio.schema", result: "could_not_check", evidence: "The check could not read your homepage.", fix: null, points: 20 }),
  ], "Asha Foundation");

  it("shows who, what, status, platform and every pillar score, with no score shown as a dash", () => {
    expect(text).toContain("Asha Foundation");
    expect(text).toContain("https://ngo.example.org/");
    expect(text).toContain("in_review");
    expect(text).toContain("wix");
    expect(text).toMatch(/overall\s+63/i);
    expect(text).toMatch(/aio\s+-/i);
    expect(text).not.toMatch(/aio\s+0\b/i);
  });

  it("marks failed, passed and could-not-check findings differently and shows evidence and fix for failures", () => {
    expect(text).toContain("FAIL seo.titles (15)");
    expect(text).toContain("No title on: https://ngo.example.org/x");
    expect(text).toContain("Give every page a title.");
    expect(text).toContain("pass seo.https (10)");
    expect(text).toContain("?    aio.schema (20)");
  });

  it("states the benchmark note and the release command", () => {
    expect(text).toContain("Benchmarks are not included yet.");
    expect(text).toContain("npm run research-release -- a1");
  });

  it("says plainly when the audit is already released or failed", () => {
    expect(formatAudit(audit({ status: "released", releasedAt: new Date("2026-10-14T00:00:00Z") }), [], "X")).toMatch(/released/i);
    expect(formatAudit(audit({ status: "failed", error: "Your site took too long to check." }), [], "X")).toContain("Your site took too long to check.");
  });
});
