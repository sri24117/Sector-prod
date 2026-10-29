import type { Browser } from "playwright";
import { crawlSite, runLighthouse, checkSocial, type CrawlResult } from "./collect.js";
import { socialProfilesFrom } from "./analysis.js";
import type { GuardedProxy } from "./proxy.js";
import type { LighthouseResult, SocialProfile } from "./types.js";

// Everything a report or a research audit needs to know about a site, gathered once (ADR-0007).
// Shared by the paid full report and the research audit so both measure the same way.

const SECOND_LIGHTHOUSE_BEFORE_MS = 5 * 60_000; // safety net so a very slow site still finishes inside the timeout
export const KEY_PAGE = /\/(about|about-us|who-we-are|donate|programs?|programmes?|our-work|projects?|contact)(\/|$)/i;

export interface GatherDeps { crawlSite: typeof crawlSite; runLighthouse: typeof runLighthouse; checkSocial: typeof checkSocial }
export interface Gathered { crawl: CrawlResult; lighthouse: LighthouseResult[]; social: SocialProfile[]; notes: string[] }

export async function gatherSiteData(
  browser: Browser, proxy: GuardedProxy, siteUrl: string, signal: AbortSignal, log: (stage: string) => void, started: number,
  deps: GatherDeps = { crawlSite, runLighthouse, checkSocial }, now: () => number = Date.now,
): Promise<Gathered> {
  log("crawl");
  const crawl = await deps.crawlSite(browser, siteUrl, signal);
  const notes = [...crawl.notes];
  const home = crawl.pages[0]!;
  const key = crawl.pages.slice(1).find((p) => KEY_PAGE.test(new URL(p.url).pathname)) ?? crawl.pages[1];
  const lighthouse: LighthouseResult[] = [];
  for (const target of [home, key].filter((p): p is NonNullable<typeof p> => !!p)) {
    if (signal.aborted) break;
    if (target !== home && now() - started > SECOND_LIGHTHOUSE_BEFORE_MS) break; // homepage test only on slow sites
    log(`lighthouse ${target.url}`);
    try { lighthouse.push(await deps.runLighthouse(target.url, proxy, signal)); }
    catch { notes.push(`The speed and accessibility test could not finish for ${target.url}.`); }
  }
  log("social");
  const social = await deps.checkSocial(socialProfilesFrom(crawl.pages.flatMap((p) => p.socialLinks)));
  return { crawl, lighthouse, social, notes };
}
