import { describe, it, expect } from "vitest";
import type { AuditResult } from "@sector/crawler";
import { analyzeResearch, RESEARCH_SCORE_MODEL } from "../src/research/analyze.js";
import type { ReportData } from "../src/report/types.js";

const SITE = "https://ngo.example.org/";
const home = { url: SITE, status: 200, title: "Asha", metaDescription: "d", canonical: SITE, lang: "en", hasViewport: true, h1: 1, h2: 1, jsonLdTypes: ["NGO"], images: 1, imagesMissingAlt: 0, words: 600, internalLinks: [`${SITE}about`, `${SITE}donate`, `${SITE}programs`, `${SITE}contact`], socialLinks: [], og: { title: "a", image: "b" }, twitterCard: "summary" };
const base = (over: Partial<ReportData> = {}): ReportData => ({
  siteUrl: SITE, organizationName: "", generatedAt: "2026-10-13T00:00:00.000Z", pages: [home], brokenLinks: [], unreachable: [],
  lighthouse: [{ url: SITE, scores: { performance: 90, seo: 95, accessibility: 92, bestPractices: 100 }, metrics: { lcpMs: 1800, cls: 0.02 }, failed: [] }],
  axe: [], screenshots: {}, social: [{ platform: "Facebook", url: "https://facebook.com/a", state: "ok" }], notes: ["a crawl note"], ...over,
});
const audit: AuditResult = { url: SITE, score: 100, runAt: "x", platform: "wix", htmlWords: 500, checks: [{ checkId: "schema", weight: 20, passed: true, detail: "ok" }] };

describe("analyzeResearch", () => {
  it("scores a healthy site 100 in every pillar and says only the rules layer was used", () => {
    const r = analyzeResearch({ report: base(), audit });
    expect(r.score.overall).toBe(100);
    expect(r.score.pillars.seo.missingLayers).toEqual(["reference", "peer"]);
    expect(r.summary.scoreModel).toBe(RESEARCH_SCORE_MODEL);
    expect(r.summary.layersUsed).toEqual(["rules"]);
    expect(String(r.summary.benchmarkNote)).toMatch(/not included/i);
    expect(r.summary.notes).toEqual(["a crawl note"]);
  });

  it("lists the biggest failed checks first, with their fixes", () => {
    const r = analyzeResearch({ report: base({ siteUrl: "http://ngo.example.org/" }), audit });
    const top = r.summary.topFixes as { checkId: string; points: number; fix: string }[];
    expect(top[0]!.checkId).toBe("seo.https");
    expect(top.every((t, i) => i === 0 || top[i - 1]!.points >= t.points)).toBe(true);
    expect(top.length).toBeLessThanOrEqual(5);
  });

  it("counts what could not be checked and keeps those out of the score", () => {
    const r = analyzeResearch({ report: base({ lighthouse: [], axe: null }), audit: null });
    expect(r.summary.couldNotCheck).toBeGreaterThan(0);
    expect(r.score.pillars.aio.score).toBeNull();
    expect(r.score.pillars.seo.score).toBe(100);
  });

  it("gives no scores when nothing could be read", () => {
    const r = analyzeResearch({ report: base({ pages: [] }), audit });
    expect(r.findings).toEqual([]);
    expect(r.score.overall).toBeNull();
  });
});
