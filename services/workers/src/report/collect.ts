import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium, type Browser, type Page } from "playwright";
import { request } from "undici";
import { guardedAgent } from "@sector/shared/net-guard";
import type { AxeViolation, LighthouseResult, PageFacts, SocialProfile } from "./types.js";
import type { GuardedProxy } from "./proxy.js";

// Browser work for a full report. Every browser connection goes through the guarded proxy
// (ADR-0007); plain HTTP checks (broken links, social links) use the guarded undici agent.

const UA = "Mozilla/5.0 (compatible; SEctOrReport/1.0; +https://jyutrix.io)";
const MAX_PAGES = 20;
const PAGE_TIMEOUT = 15_000;
const HOME_TIMEOUT = 30_000;
const CRAWL_PARALLEL = 3;
const CRAWL_BUDGET = 180_000;
const SKIP_EXT = /\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|pptx?|mp4|mp3)$/i;
const require = createRequire(import.meta.url);

export const browserArgs = (proxy: GuardedProxy) => [
  `--proxy-server=${proxy.url}`,
  "--proxy-bypass-list=<-loopback>", // also send localhost through the proxy, which refuses it
  "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
];

export async function launchBrowser(proxy: GuardedProxy): Promise<Browser> {
  return chromium.launch({ args: browserArgs(proxy) });
}

const bareHost = (u: string) => new URL(u).hostname.toLowerCase().replace(/^www\./, "");
function normalize(u: string): string | null {
  try {
    const x = new URL(u); x.hash = ""; x.search = "";
    if (x.protocol !== "http:" && x.protocol !== "https:") return null;
    let s = x.toString(); if (s.endsWith("/") && x.pathname !== "/") s = s.slice(0, -1);
    return s;
  } catch { return null; }
}

/** Facts read inside the page. Kept dependency-free: this function runs in the browser. */
function readFacts(): Omit<PageFacts, "url" | "status"> {
  const meta = (sel: string) => (document.querySelector(sel) as HTMLMetaElement | null)?.content?.trim() ?? "";
  const types: string[] = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    try {
      const walk = (j: unknown): void => {
        if (Array.isArray(j)) j.forEach(walk);
        else if (j && typeof j === "object") {
          const o = j as Record<string, unknown>;
          const t = o["@type"]; if (t) (Array.isArray(t) ? t : [t]).forEach((x) => types.push(String(x)));
          if (o["@graph"]) walk(o["@graph"]);
        }
      };
      walk(JSON.parse(s.textContent || "null"));
    } catch { /* malformed JSON-LD counts as absent */ }
  });
  const imgs = Array.from(document.images);
  const links = Array.from(document.querySelectorAll("a[href]")).map((a) => (a as HTMLAnchorElement).href);
  return {
    title: document.title.trim(),
    metaDescription: meta('meta[name="description"]'),
    canonical: (document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null)?.href ?? "",
    lang: document.documentElement.lang || "",
    hasViewport: !!document.querySelector('meta[name="viewport"]'),
    h1: document.querySelectorAll("h1").length,
    h2: document.querySelectorAll("h2").length,
    jsonLdTypes: [...new Set(types)],
    images: imgs.length,
    imagesMissingAlt: imgs.filter((i) => !i.hasAttribute("alt")).length,
    words: (document.body?.innerText || "").split(/\s+/).filter(Boolean).length,
    internalLinks: links,
    socialLinks: links,
    og: { title: meta('meta[property="og:title"]') || undefined, description: meta('meta[property="og:description"]') || undefined, image: meta('meta[property="og:image"]') || undefined },
    twitterCard: meta('meta[name="twitter:card"]') || undefined,
  };
}

export interface CrawlResult {
  pages: PageFacts[];
  brokenLinks: { url: string; status: number; foundOn: string }[];
  axe: AxeViolation[];
  screenshots: { desktop?: string; mobile?: string };
  notes: string[];
}

export async function crawlSite(browser: Browser, startUrl: string, signal: AbortSignal, budgetMs = CRAWL_BUDGET): Promise<CrawlResult> {
  const until = Date.now() + budgetMs; // safety net only: normal sites finish well inside it
  const host = bareHost(startUrl);
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: false });
  // tsx/esbuild wraps named functions in __name(); functions sent to page.evaluate need it defined in the page.
  await context.addInitScript("window.__name = (fn) => fn;");
  const notes: string[] = [];
  const pages: PageFacts[] = [];
  const queue: { url: string; from: string }[] = [];
  const seen = new Set<string>([normalize(startUrl)!]);
  const linkFrom = new Map<string, string>(); // internal link -> first page it was seen on
  const broken: CrawlResult["brokenLinks"] = [];
  let axe: AxeViolation[] = [];
  const screenshots: CrawlResult["screenshots"] = {};
  // site.org/x and www.site.org/x (or a redirect onto a page already read) are one page.
  const pageKey = (u: string) => new URL(u).pathname.replace(/\/+$/, "").toLowerCase();

  /** Reads one page. The homepage (from === "") must succeed, or the report cannot be made. */
  async function visit(url: string, from: string): Promise<void> {
    const home = from === "";
    const page = await context.newPage();
    try {
      // Slow shared hosting is common for NGOs: the homepage gets a longer wait and one retry.
      const go = () => page.goto(url, { waitUntil: "domcontentloaded", timeout: home ? HOME_TIMEOUT : PAGE_TIMEOUT });
      const res = await go().catch((e) => { if (home && !signal.aborted) return go(); throw e; });
      const status = res?.status() ?? 0;
      if (status >= 400) { if (home) throw new Error(`Your homepage answered with error ${status}.`); broken.push({ url, status, foundOn: from }); return; }
      if (!/html/i.test(res?.headers()["content-type"] ?? "html")) return;
      await page.waitForLoadState("load", { timeout: 5_000 }).catch(() => undefined);
      const facts = await page.evaluate(readFacts);
      const finalUrl = normalize(page.url()) ?? url;
      if (bareHost(finalUrl) !== host) { if (home) notes.push(`Your homepage redirects to ${finalUrl}; only pages on ${host} are checked.`); return; }
      if (pages.some((p) => pageKey(p.url) === pageKey(finalUrl)) || pages.length >= MAX_PAGES) return;
      const internal = [...new Set(facts.internalLinks.map(normalize).filter((u): u is string => !!u && bareHost(u) === host && !SKIP_EXT.test(new URL(u).pathname)))];
      const external = facts.socialLinks.filter((u) => { try { return bareHost(u) !== host; } catch { return false; } });
      const facts2: PageFacts = { ...facts, url: finalUrl, status, internalLinks: internal, socialLinks: external };
      if (home) pages.unshift(facts2); else pages.push(facts2);
      for (const l of internal) {
        if (!linkFrom.has(l)) linkFrom.set(l, finalUrl);
        if (!seen.has(l)) { seen.add(l); queue.push({ url: l, from: finalUrl }); }
      }
      if (home) {
        axe = await runAxe(page).catch(() => { notes.push("The detailed accessibility scan could not run on your homepage."); return []; });
        screenshots.desktop = (await page.screenshot({ type: "jpeg", quality: 60 })).toString("base64");
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(500);
        screenshots.mobile = (await page.screenshot({ type: "jpeg", quality: 60 })).toString("base64");
      }
    } catch (err) {
      if (home) throw err instanceof Error ? err : new Error(String(err));
      broken.push({ url, status: 0, foundOn: from });
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  try {
    await visit(normalize(startUrl)!, "");
    // The rest of the site, a few pages at a time (one report runs at a time, so this stays light).
    let inFlight = 0;
    const more = () => queue.length > 0 && pages.length + inFlight < MAX_PAGES && !signal.aborted && Date.now() < until;
    await Promise.all(Array.from({ length: CRAWL_PARALLEL }, async () => {
      while (more()) {
        const next = queue.shift()!;
        inFlight++;
        try { await visit(next.url, next.from); } finally { inFlight--; }
      }
    }));
    const ranOut = pages.length < MAX_PAGES && queue.length > 0 && Date.now() >= until;
    // Links we saw but did not visit: a quick status check (at most 30 seconds) so broken ones still appear.
    const unvisited = [...linkFrom.keys()].filter((l) => !pages.some((p) => p.url === l) && !broken.some((b) => b.url === l)).slice(0, 30);
    const checkUntil = Date.now() + 30_000;
    await mapLimit(unvisited, 4, async (l) => {
      if (Date.now() > checkUntil || signal.aborted) return;
      const s = await statusOf(l); if (s === 404 || s === 410) broken.push({ url: l, status: s, foundOn: linkFrom.get(l)! });
    });
    if (ranOut) notes.push(`Your site loads very slowly, so we checked ${pages.length} pages in the time available.`);
    else if (seen.size > MAX_PAGES) notes.push(`Your site has more than ${MAX_PAGES} pages; we checked the first ${MAX_PAGES} we found from your homepage.`);
  } finally {
    await context.close().catch(() => undefined);
  }
  return { pages, brokenLinks: broken, axe, screenshots, notes };
}

async function runAxe(page: Page): Promise<AxeViolation[]> {
  const source = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
  await page.addScriptTag({ content: source });
  const violations = await page.evaluate(async () => {
    const r = await (window as unknown as { axe: { run: (ctx: Document, o: unknown) => Promise<{ violations: { id: string; impact: string | null; help: string; nodes: unknown[] }[] }> } }).axe.run(document, { resultTypes: ["violations"] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length }));
  });
  const order = { critical: 0, serious: 1, moderate: 2, minor: 3 } as Record<string, number>;
  return (violations as AxeViolation[]).sort((a, b) => (order[a.impact ?? "minor"] ?? 4) - (order[b.impact ?? "minor"] ?? 4));
}

async function statusOf(url: string): Promise<number> {
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const res = await request(url, { method, dispatcher: guardedAgent(), signal: AbortSignal.timeout(8_000), headers: { "user-agent": UA } });
      await res.body.dump({ limit: 64 * 1024 });
      if (method === "HEAD" && (res.statusCode === 405 || res.statusCode === 403)) continue;
      return res.statusCode;
    } catch { if (method === "GET") return 0; }
  }
  return 0;
}

export async function checkSocial(profiles: SocialProfile[]): Promise<SocialProfile[]> {
  return mapLimit(profiles, 3, async (p) => {
    const s = await statusOf(p.url);
    return { ...p, state: s >= 200 && s < 400 ? "ok" : s === 404 || s === 410 ? "broken" : "unchecked" };
  });
}

async function mapLimit<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]!); } }));
  return out;
}

/** Lighthouse (mobile) in its own Chromium, also forced through the guarded proxy. */
export async function runLighthouse(url: string, proxy: GuardedProxy, signal?: AbortSignal): Promise<LighthouseResult> {
  const { launch } = await import("chrome-launcher");
  const lighthouse = (await import("lighthouse")).default;
  const chrome = await launch({ chromePath: chromium.executablePath(), chromeFlags: ["--headless=new", ...browserArgs(proxy)] });
  const stop = () => chrome.kill();
  signal?.addEventListener("abort", stop, { once: true });
  try {
    const result = await lighthouse(url, { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance", "seo", "accessibility", "best-practices"], maxWaitForLoad: 45_000 });
    const lhr = result?.lhr;
    if (!lhr) throw new Error("Lighthouse returned no result");
    const cat = (k: string) => Math.round((lhr.categories[k]?.score ?? 0) * 100);
    const num = (k: string) => lhr.audits[k]?.numericValue;
    const failed = Object.values(lhr.categories).flatMap((c) => c.auditRefs.map((r) => lhr.audits[r.id]!))
      .filter((a) => a && typeof a.score === "number" && a.score < 0.9 && (a.scoreDisplayMode === "numeric" || a.scoreDisplayMode === "binary"))
      .slice(0, 10).map((a) => ({ id: a.id, title: a.title }));
    return {
      url,
      scores: { performance: cat("performance"), seo: cat("seo"), accessibility: cat("accessibility"), bestPractices: cat("best-practices") },
      metrics: { lcpMs: num("largest-contentful-paint"), cls: num("cumulative-layout-shift") !== undefined ? Math.round(num("cumulative-layout-shift")! * 1000) / 1000 : undefined, tbtMs: num("total-blocking-time") },
      failed,
    };
  } finally {
    signal?.removeEventListener("abort", stop);
    chrome.kill();
  }
}

/** A4 PDF of the report HTML (no network needed: fonts and images are embedded). */
export async function renderPdf(browser: Browser, html: string): Promise<Buffer> {
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    return await page.pdf({
      format: "A4", printBackground: true, displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;font:9px system-ui;color:#5b6058;padding:0 14mm;display:flex;justify-content:space-between"><span>SEctOr full report</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      margin: { top: "14mm", bottom: "16mm", left: "0", right: "0" },
    });
  } finally {
    await page.close();
  }
}
