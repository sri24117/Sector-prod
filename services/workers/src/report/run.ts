import { scopedDb } from "@sector/db";
import { startGuardedProxy } from "./proxy.js";
import { crawlSite, launchBrowser, runLighthouse, renderPdf, checkSocial } from "./collect.js";
import { buildActions, overallScore, socialProfilesFrom, bucketOf, homeLighthouse, coverage } from "./analysis.js";
import { renderReportHtml } from "./render.js";
import { SCORE_MODEL, type LighthouseResult, type ReportData } from "./types.js";

// One full report, start to finish (spec 2026-10-04-full-report-design.md, ADR-0007).
// Runs on the "report" queue with concurrency 1. Never throws: failures are stored on the row.

const REPORT_TIMEOUT_MS = 8 * 60_000;
const SECOND_LIGHTHOUSE_BEFORE_MS = 5 * 60_000; // safety net so a very slow site still finishes inside the timeout
const KEY_PAGE = /\/(about|about-us|who-we-are|donate|programs?|programmes?|our-work|projects?|contact)(\/|$)/i;

export async function buildReport(siteUrl: string, organizationName: string, signal: AbortSignal, log: (stage: string) => void = () => undefined): Promise<{ data: ReportData; html: string; pdf: Buffer }> {
  const started = Date.now();
  const proxy = await startGuardedProxy();
  const browser = await launchBrowser(proxy);
  // On timeout, closing the browser and the proxy makes every pending browser or network step fail fast.
  const stop = () => { void browser.close().catch(() => undefined); void proxy.close().catch(() => undefined); };
  signal.addEventListener("abort", stop, { once: true });
  try {
    log("crawl");
    const crawl = await crawlSite(browser, siteUrl, signal);
    const notes = [...crawl.notes];
    const home = crawl.pages[0]!;
    const key = crawl.pages.slice(1).find((p) => KEY_PAGE.test(new URL(p.url).pathname)) ?? crawl.pages[1];
    const lighthouse: LighthouseResult[] = [];
    for (const target of [home, key].filter((p): p is NonNullable<typeof p> => !!p)) {
      if (signal.aborted) break;
      if (target !== home && Date.now() - started > SECOND_LIGHTHOUSE_BEFORE_MS) break; // homepage test only on slow sites
      log(`lighthouse ${target.url}`);
      try { lighthouse.push(await runLighthouse(target.url, proxy, signal)); }
      catch { notes.push(`The speed and accessibility test could not finish for ${target.url}.`); }
    }
    log("social");
    const social = await checkSocial(socialProfilesFrom(crawl.pages.flatMap((p) => p.socialLinks)));
    const data: ReportData = {
      siteUrl, organizationName, generatedAt: new Date().toISOString(),
      pages: crawl.pages, brokenLinks: crawl.brokenLinks, unreachable: crawl.unreachable, lighthouse, axe: crawl.axe, screenshots: crawl.screenshots, social, notes,
    };
    const actions = buildActions(data);
    const html = renderReportHtml(data, actions);
    log("pdf");
    const pdf = await renderPdf(browser, html);
    return { data, html, pdf };
  } finally {
    signal.removeEventListener("abort", stop);
    await browser.close().catch(() => undefined);
    await proxy.close().catch(() => undefined);
  }
}

export async function runReportJob(job: { reportId: string; organizationId: string }): Promise<void> {
  const db = scopedDb(job.organizationId);
  const report = await db.reports.findById(job.reportId);
  if (!report || report.status === "done" || report.status === "failed") return; // a stalled job retried after it ended
  const org = await db.organization.get();
  await db.reports.update(job.reportId, { status: "running" });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REPORT_TIMEOUT_MS);
  const started = Date.now();
  const log = (stage: string) => console.log(`report ${job.reportId}: ${stage} (${Math.round((Date.now() - started) / 1000)}s)`);
  // Stop waiting at the deadline even if some step ignores the abort signal.
  const deadline = new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(new Error("timeout")), { once: true }));
  try {
    const { data, html, pdf } = await Promise.race([buildReport(report.siteUrl, org?.name ?? "Your organization", controller.signal, log), deadline]);
    if (controller.signal.aborted) throw new Error("timeout");
    const actions = buildActions(data);
    const summary = {
      scoreModel: SCORE_MODEL,
      overall: overallScore(data),
      areas: homeLighthouse(data)?.scores ?? null,
      coverage: coverage(data),
      pages: data.pages.length,
      actions: { doFirst: actions.filter((a) => bucketOf(a) === "Do first").length, thisMonth: actions.filter((a) => bucketOf(a) === "This month").length, later: actions.filter((a) => bucketOf(a) === "Later").length },
      topActions: actions.slice(0, 3).map((a) => a.title),
    };
    await db.reports.update(job.reportId, { status: "done", summary, html, pdf, finishedAt: new Date() });
    log("done");
  } catch (err) {
    const msg = controller.signal.aborted
      ? "Your site took too long to check. Try again later, or contact SEctOr if it keeps happening."
      : err instanceof Error && /homepage/i.test(err.message) ? err.message
      : "We could not finish this report. Check your website is online, then try again.";
    console.error(`report ${job.reportId} failed:`, err instanceof Error ? err.message : err);
    await db.reports.update(job.reportId, { status: "failed", error: msg, finishedAt: new Date() });
  } finally {
    clearTimeout(timer);
  }
}
