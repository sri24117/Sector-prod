import { startGuardedProxy } from "../report/proxy.js";
import { launchBrowser } from "../report/collect.js";
import { gatherSiteData } from "../report/gather.js";
import type { ReportData } from "../report/types.js";

/** Starts the guarded proxy and Chromium (ADR-0007), gathers the site data, and always shuts both down. */
export async function collectResearchData(siteUrl: string, signal: AbortSignal, log: (stage: string) => void = () => undefined): Promise<ReportData> {
  const started = Date.now();
  const proxy = await startGuardedProxy();
  const browser = await launchBrowser(proxy);
  // On timeout, closing the browser and the proxy makes every pending step fail fast.
  const stop = () => { void browser.close().catch(() => undefined); void proxy.close().catch(() => undefined); };
  signal.addEventListener("abort", stop, { once: true });
  try {
    const { crawl, lighthouse, social, notes } = await gatherSiteData(browser, proxy, siteUrl, signal, log, started);
    return {
      siteUrl, organizationName: "", generatedAt: new Date().toISOString(),
      pages: crawl.pages, brokenLinks: crawl.brokenLinks, unreachable: crawl.unreachable, lighthouse, axe: crawl.axe,
      screenshots: {}, // not needed for scoring; skipping them keeps the job's memory small
      social, notes,
    };
  } finally {
    signal.removeEventListener("abort", stop);
    await browser.close().catch(() => undefined);
    await proxy.close().catch(() => undefined);
  }
}
