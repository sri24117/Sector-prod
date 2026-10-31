import { describe, it, expect, vi } from "vitest";
import type { Browser } from "playwright";
import { gatherSiteData, type GatherDeps } from "../src/report/gather.js";
import type { CrawlResult } from "../src/report/collect.js";
import type { GuardedProxy } from "../src/report/proxy.js";
import type { LighthouseResult, PageFacts } from "../src/report/types.js";

const page = (url: string, over: Partial<PageFacts> = {}): PageFacts => ({
  url, status: 200, title: "t", metaDescription: "d", canonical: url, lang: "en", hasViewport: true, h1: 1, h2: 1, jsonLdTypes: [], images: 0, imagesMissingAlt: 0,
  words: 300, internalLinks: [], socialLinks: [], og: {}, ...over,
});
const crawl = (pages: PageFacts[], notes: string[] = []): CrawlResult => ({ pages, brokenLinks: [], unreachable: [], axe: [], screenshots: {}, notes });
const lh = (url: string): LighthouseResult => ({ url, scores: { performance: 90, seo: 90, accessibility: 90, bestPractices: 90 }, metrics: {}, failed: [] });
const browser = {} as Browser;
const proxy = {} as GuardedProxy;
const deps = (over: Partial<GatherDeps> = {}): GatherDeps => ({
  crawlSite: vi.fn(async () => crawl([page("https://x.org/"), page("https://x.org/about")], ["crawl note"])),
  runLighthouse: vi.fn(async (url: string) => lh(url)),
  checkSocial: vi.fn(async (p) => p),
  ...over,
});
const run = (d: GatherDeps, opts: { signal?: AbortSignal; elapsed?: number } = {}) =>
  gatherSiteData(browser, proxy, "https://x.org/", opts.signal ?? new AbortController().signal, () => undefined, 1_000, d, () => 1_000 + (opts.elapsed ?? 0));

describe("gatherSiteData", () => {
  it("tests the homepage and the key page, in that order, and keeps the crawl notes", async () => {
    const d = deps();
    const g = await run(d);
    expect(g.lighthouse.map((l) => l.url)).toEqual(["https://x.org/", "https://x.org/about"]);
    expect(g.notes).toEqual(["crawl note"]);
  });

  it("skips the second speed test on a slow site but always tests the homepage", async () => {
    const d = deps();
    const g = await run(d, { elapsed: 6 * 60_000 });
    expect(g.lighthouse.map((l) => l.url)).toEqual(["https://x.org/"]);
  });

  it("adds a plain note and carries on when a speed test fails", async () => {
    const d = deps({ runLighthouse: vi.fn(async (url: string) => { if (url.endsWith("/about")) throw new Error("boom"); return lh(url); }) });
    const g = await run(d);
    expect(g.lighthouse).toHaveLength(1);
    expect(g.notes.some((n) => n.includes("https://x.org/about"))).toBe(true);
  });

  it("runs no speed test once the job was aborted", async () => {
    const c = new AbortController(); c.abort();
    const d = deps();
    const g = await run(d, { signal: c.signal });
    expect(g.lighthouse).toEqual([]);
    expect(d.runLighthouse).not.toHaveBeenCalled();
  });

  it("checks the social profiles found on the crawled pages", async () => {
    const d = deps({ crawlSite: vi.fn(async () => crawl([page("https://x.org/", { socialLinks: ["https://facebook.com/asha"] })])) });
    const g = await run(d);
    expect(d.checkSocial).toHaveBeenCalledOnce();
    expect(g.social.map((s) => s.platform)).toEqual(["Facebook"]);
  });
});
