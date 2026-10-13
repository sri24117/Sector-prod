import { describe, it, expect } from "vitest";
import type { AuditResult } from "@sector/crawler";
import { deriveRulesFindings, type RuleFinding } from "../src/research/rules.js";
import type { PageFacts, ReportData } from "../src/report/types.js";

const SITE = "https://ngo.example.org/";
const page = (over: Partial<PageFacts> = {}): PageFacts => ({
  url: SITE, status: 200, title: "Asha Foundation", metaDescription: "We teach children to read.", canonical: SITE, lang: "en",
  hasViewport: true, h1: 1, h2: 3, jsonLdTypes: ["NGO"], images: 4, imagesMissingAlt: 0, words: 600,
  internalLinks: [`${SITE}about`, `${SITE}donate`, `${SITE}our-work`, `${SITE}contact`], socialLinks: [],
  og: { title: "Asha", description: "Reading", image: `${SITE}og.jpg` }, twitterCard: "summary_large_image", ...over,
});
const report = (over: Partial<ReportData> = {}): ReportData => ({
  siteUrl: SITE, organizationName: "Asha", generatedAt: "2026-10-13T10:00:00.000Z", pages: [page()], brokenLinks: [], unreachable: [],
  lighthouse: [{ url: SITE, scores: { performance: 90, seo: 95, accessibility: 92, bestPractices: 100 }, metrics: { lcpMs: 1800, cls: 0.02, tbtMs: 100 }, failed: [] }],
  axe: [], screenshots: {}, social: [{ platform: "Facebook", url: "https://facebook.com/asha", state: "ok" }], notes: [], ...over,
});
const CHECKS = [
  ["schema", 20], ["robots_txt_ai_block", 15], ["llms_txt", 5], ["heading_hierarchy", 15], ["faq_pairs", 20], ["front_loaded_stat", 15], ["freshness", 10],
] as const;
const audit = (over: Partial<AuditResult> = {}, failing: string[] = []): AuditResult => ({
  url: SITE, score: 100, runAt: "2026-10-13T10:00:00.000Z", platform: "wordpress", htmlWords: 500,
  checks: CHECKS.map(([checkId, weight]) => ({ checkId, weight, passed: !failing.includes(checkId), detail: `${checkId} detail` })), ...over,
});
const get = (fs: RuleFinding[], id: string) => fs.find((f) => f.checkId === id)!;

describe("deriveRulesFindings: a healthy site", () => {
  const fs = deriveRulesFindings({ report: report(), audit: audit() });
  it("passes every check, with unique ids and no fix text on passes", () => {
    expect(fs.every((f) => f.result === "pass")).toBe(true);
    expect(new Set(fs.map((f) => f.checkId)).size).toBe(fs.length);
    expect(fs.every((f) => f.fix === null && f.evidence === null && f.layer === "rules" && f.points > 0)).toBe(true);
  });
  it("covers all four pillars", () => {
    expect(new Set(fs.map((f) => f.pillar))).toEqual(new Set(["seo", "aio", "uiux", "brand"]));
    expect(fs.filter((f) => f.pillar === "aio")).toHaveLength(8);
  });
});

describe("SEO", () => {
  it("fails a page with no title and names the page", () => {
    const f = get(deriveRulesFindings({ report: report({ pages: [page(), page({ url: `${SITE}x`, title: " " })] }), audit: audit() }), "seo.titles");
    expect(f.result).toBe("fail");
    expect(f.evidence).toContain(`${SITE}x`);
    expect(f.fix).toBeTruthy();
  });
  it("fails duplicate titles, missing descriptions, wrong h1 count, thin pages, missing lang", () => {
    const pages = [page(), page({ url: `${SITE}a`, metaDescription: "", h1: 2, words: 40, lang: "" })];
    const fs = deriveRulesFindings({ report: report({ pages }), audit: audit() });
    expect(get(fs, "seo.titles_unique").result).toBe("fail");
    expect(get(fs, "seo.meta_descriptions").result).toBe("fail");
    expect(get(fs, "seo.single_h1").result).toBe("fail");
    expect(get(fs, "seo.thin_content").result).toBe("fail");
    expect(get(fs, "seo.language").result).toBe("fail");
  });
  it("fails http sites, a missing homepage canonical and broken links", () => {
    const fs = deriveRulesFindings({ report: report({ siteUrl: "http://ngo.example.org/", pages: [page({ canonical: "" })], brokenLinks: [{ url: `${SITE}gone`, status: 404, foundOn: SITE }] }), audit: audit() });
    expect(get(fs, "seo.https").result).toBe("fail");
    expect(get(fs, "seo.canonical").result).toBe("fail");
    expect(get(fs, "seo.broken_links").result).toBe("fail");
    expect(get(fs, "seo.broken_links").evidence).toContain(`${SITE}gone`);
  });
  it("ignores pages that answered with an error", () => {
    const fs = deriveRulesFindings({ report: report({ pages: [page(), page({ url: `${SITE}err`, status: 500, title: "" })] }), audit: audit() });
    expect(get(fs, "seo.titles").result).toBe("pass");
  });
  it("shortens a long list of affected pages", () => {
    const pages = [page(), ...Array.from({ length: 8 }, (_, i) => page({ url: `${SITE}p${i}`, title: "" }))];
    expect(get(deriveRulesFindings({ report: report({ pages }), audit: audit() }), "seo.titles").evidence).toMatch(/and 3 more/);
  });
});

describe("could_not_check, never a failure", () => {
  it("marks the Lighthouse-based checks when Lighthouse did not finish", () => {
    const fs = deriveRulesFindings({ report: report({ lighthouse: [] }), audit: audit() });
    for (const id of ["seo.lighthouse_seo", "uiux.lighthouse_accessibility", "uiux.performance", "uiux.layout_shift", "uiux.best_practices"]) {
      expect(get(fs, id).result).toBe("could_not_check");
      expect(get(fs, id).fix).toBeNull();
      expect(get(fs, id).evidence).toBeTruthy();
    }
  });
  it("marks the axe check when the scan could not run, and fails it on serious violations", () => {
    expect(get(deriveRulesFindings({ report: report({ axe: null }), audit: audit() }), "uiux.axe_serious").result).toBe("could_not_check");
    const bad = report({ axe: [{ id: "color-contrast", impact: "serious", help: "Elements must have sufficient color contrast", nodes: 3 }, { id: "x", impact: "minor", help: "x", nodes: 1 }] });
    const f = get(deriveRulesFindings({ report: bad, audit: audit() }), "uiux.axe_serious");
    expect(f.result).toBe("fail");
    expect(f.evidence).toContain("color-contrast");
    expect(f.evidence).not.toContain("x:");
  });
  it("marks layout shift when Lighthouse gave no value", () => {
    const lh = [{ url: SITE, scores: { performance: 90, seo: 95, accessibility: 92, bestPractices: 100 }, metrics: {}, failed: [] }];
    expect(get(deriveRulesFindings({ report: report({ lighthouse: lh }), audit: audit() }), "uiux.layout_shift").result).toBe("could_not_check");
  });
  it("marks every AI-readiness check when the plain-HTML audit did not run", () => {
    const aio = deriveRulesFindings({ report: report(), audit: null }).filter((f) => f.pillar === "aio");
    expect(aio).toHaveLength(8);
    expect(aio.every((f) => f.result === "could_not_check")).toBe(true);
    expect(get(aio, "aio.schema").points).toBe(20);
  });
  it("returns no findings at all when no page could be read", () => {
    expect(deriveRulesFindings({ report: report({ pages: [] }), audit: audit() })).toEqual([]);
    expect(deriveRulesFindings({ report: report({ pages: [page({ status: 500 })] }), audit: audit() })).toEqual([]);
  });
});

describe("AI readiness", () => {
  it("fails a crawler check that did not pass and keeps the crawler's detail as evidence", () => {
    const f = get(deriveRulesFindings({ report: report(), audit: audit({}, ["faq_pairs"]) }), "aio.faq_pairs");
    expect(f.result).toBe("fail");
    expect(f.points).toBe(20);
    expect(f.evidence).toBe("faq_pairs detail");
    expect(f.fix).toBeTruthy();
  });
  it("treats a JavaScript-built site as unreadable to AI: five checks could_not_check and readable_without_js fails", () => {
    const fs = deriveRulesFindings({ report: report({ pages: [page({ words: 800 })] }), audit: audit({ htmlWords: 12 }) });
    for (const id of ["schema", "heading_hierarchy", "faq_pairs", "front_loaded_stat", "freshness"]) expect(get(fs, `aio.${id}`).result).toBe("could_not_check");
    expect(get(fs, "aio.robots_txt_ai_block").result).toBe("pass");
    expect(get(fs, "aio.llms_txt").result).toBe("pass");
    const js = get(fs, "aio.readable_without_js");
    expect(js.result).toBe("fail");
    expect(js.evidence).toContain("12");
  });
  it("does not call a genuinely small site JavaScript-built", () => {
    const fs = deriveRulesFindings({ report: report({ pages: [page({ words: 120 })] }), audit: audit({ htmlWords: 90 }) });
    expect(get(fs, "aio.readable_without_js").result).toBe("pass");
    expect(get(fs, "aio.schema").result).toBe("pass");
  });
});

describe("UI/UX", () => {
  it("fails missing viewport, missing alt text, slow pages and layout shift", () => {
    const lh = [{ url: SITE, scores: { performance: 40, seo: 95, accessibility: 70, bestPractices: 60 }, metrics: { lcpMs: 6000, cls: 0.4, tbtMs: 900 }, failed: [] }];
    const fs = deriveRulesFindings({ report: report({ pages: [page({ hasViewport: false, imagesMissingAlt: 3 })], lighthouse: lh }), audit: audit() });
    for (const id of ["uiux.viewport", "uiux.image_alt", "uiux.performance", "uiux.layout_shift", "uiux.lighthouse_accessibility", "uiux.best_practices"]) expect(get(fs, id).result).toBe("fail");
  });
  it("fails performance on a slow largest paint even when the score is fine", () => {
    const lh = [{ url: SITE, scores: { performance: 85, seo: 95, accessibility: 92, bestPractices: 100 }, metrics: { lcpMs: 5200, cls: 0.02, tbtMs: 100 }, failed: [] }];
    expect(get(deriveRulesFindings({ report: report({ lighthouse: lh }), audit: audit() }), "uiux.performance").result).toBe("fail");
  });
});

describe("content and brand", () => {
  it("fails a missing share preview, twitter card, organization schema and thin content", () => {
    const home = page({ og: {}, twitterCard: undefined, jsonLdTypes: ["WebSite"], words: 120 });
    const fs = deriveRulesFindings({ report: report({ pages: [home] }), audit: audit() });
    for (const id of ["brand.og_preview", "brand.twitter_card", "brand.org_schema", "brand.content_depth"]) expect(get(fs, id).result).toBe("fail");
  });
  it("finds key pages from crawled pages and from homepage links, and fails the ones that are missing", () => {
    const home = page({ internalLinks: [`${SITE}about-us`] });
    const fs = deriveRulesFindings({ report: report({ pages: [home, page({ url: `${SITE}programs`, title: "Programs" })] }), audit: audit() });
    expect(get(fs, "brand.about_page").result).toBe("pass");
    expect(get(fs, "brand.programs_page").result).toBe("pass");
    expect(get(fs, "brand.donate_path").result).toBe("fail");
    expect(get(fs, "brand.contact_page").result).toBe("fail");
  });
  it("fails social links when there are none or one is broken", () => {
    expect(get(deriveRulesFindings({ report: report({ social: [] }), audit: audit() }), "brand.social_links").result).toBe("fail");
    const broken = report({ social: [{ platform: "Facebook", url: "https://facebook.com/x", state: "broken" }] });
    expect(get(deriveRulesFindings({ report: broken, audit: audit() }), "brand.social_links").result).toBe("fail");
  });
  it("accepts underscores as well as hyphens in key-page paths", () => {
    const home = page({ internalLinks: [`${SITE}about_us`, `${SITE}Our_Work`, `${SITE}support_us`] });
    const fs = deriveRulesFindings({ report: report({ pages: [home, page({ url: `${SITE}Contact_Us`, title: "Contact" })] }), audit: audit() });
    for (const id of ["brand.contact_page", "brand.about_page", "brand.programs_page", "brand.donate_path"]) expect(get(fs, id).result).toBe("pass");
  });
  it("does not match paths that merely start with a key word", () => {
    const home = page({ internalLinks: [] });
    const fs = deriveRulesFindings({ report: report({ pages: [home, page({ url: `${SITE}programming-blog` }), page({ url: `${SITE}contactless` })] }), audit: audit() });
    expect(get(fs, "brand.programs_page").result).toBe("fail");
    expect(get(fs, "brand.contact_page").result).toBe("fail");
  });
  it("measures content depth by the median page, so one long page cannot hide thin ones", () => {
    const pages = [page({ words: 5000 }), page({ url: `${SITE}a`, words: 50 }), page({ url: `${SITE}b`, words: 60 })];
    expect(get(deriveRulesFindings({ report: report({ pages }), audit: audit() }), "brand.content_depth").result).toBe("fail");
  });
});
