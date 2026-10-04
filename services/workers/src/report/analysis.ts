import type { Action, Impact, ReportData, SocialProfile } from "./types.js";

// Deterministic analysis for the full report: every action comes from a measured
// fact (CLAUDE.md section 2: no LLM in anything that must be correct).

const PLATFORMS: { name: string; hosts: RegExp; skip?: RegExp }[] = [
  { name: "Facebook", hosts: /(^|\.)facebook\.com$|(^|\.)fb\.com$/, skip: /\/(sharer|share|dialog|plugins)\b/ },
  { name: "Instagram", hosts: /(^|\.)instagram\.com$/ },
  { name: "LinkedIn", hosts: /(^|\.)linkedin\.com$/, skip: /\/(shareArticle|sharing)\b/ },
  { name: "YouTube", hosts: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/, skip: /\/(embed|watch)\b/ },
  { name: "X (Twitter)", hosts: /(^|\.)twitter\.com$|(^|\.)x\.com$/, skip: /\/(intent|share)\b/ },
  { name: "WhatsApp", hosts: /(^|\.)wa\.me$|(^|\.)whatsapp\.com$/, skip: /\/send\?/ },
];

/** One profile link per platform found on the site; share buttons and embeds are not profiles. */
export function socialProfilesFrom(links: string[]): SocialProfile[] {
  const found = new Map<string, string>();
  for (const raw of links) {
    let u: URL; try { u = new URL(raw); } catch { continue; }
    const host = u.hostname.toLowerCase();
    const p = PLATFORMS.find((x) => x.hosts.test(host));
    if (!p || (p.skip && p.skip.test(u.pathname + u.search)) || u.pathname.replace(/\/+$/, "") === "") continue;
    if (!found.has(p.name)) found.set(p.name, u.toString());
  }
  return PLATFORMS.filter((p) => found.has(p.name)).map((p) => ({ platform: p.name, url: found.get(p.name)!, state: "unchecked" as const }));
}

/** Mean of the four Lighthouse areas on the homepage, or null if Lighthouse could not run. */
export function overallScore(d: ReportData): number | null {
  const home = d.lighthouse[0];
  if (!home) return null;
  const s = home.scores;
  return Math.round((s.performance + s.seo + s.accessibility + s.bestPractices) / 4);
}

const RANK: Record<Impact, number> = { high: 0, medium: 1, low: 2 };
export const bucketOf = (a: Action) => (a.impact === "high" ? "Do first" : a.impact === "medium" ? "This month" : "Later");

export function buildActions(d: ReportData): Action[] {
  const out: Action[] = [];
  const home = d.pages[0];
  const pagesWhere = (pred: (p: ReportData["pages"][number]) => boolean) => d.pages.filter(pred).map((p) => p.url);
  const add = (a: Action) => out.push(a);

  // ---- Search ----
  if (home && home.jsonLdTypes.length === 0) add({ section: "Search", title: "Tell search engines who you are", why: "Your homepage has no structured description of your organization, so search engines and AI assistants have to guess your name, purpose and website.", impact: "high", effort: "About 10 minutes", owner: "SEctOr (WordPress)", where: [home.url] });
  const noTitle = pagesWhere((p) => !p.title.trim());
  if (noTitle.length) add({ section: "Search", title: "Give every page a title", why: "The title is the blue headline people click in search results. Pages without one rarely get chosen.", impact: "high", effort: "About 5 minutes per page", owner: "Your web person", where: noTitle });
  const titles = new Map<string, string[]>();
  for (const p of d.pages) if (p.title.trim()) titles.set(p.title.trim(), [...(titles.get(p.title.trim()) ?? []), p.url]);
  const dupes = [...titles.values()].filter((u) => u.length > 1).flat();
  if (dupes.length) add({ section: "Search", title: "Make each page title different", why: "When several pages share one title, search engines cannot tell which page answers which question.", impact: "medium", effort: "About 5 minutes per page", owner: "Your web person", where: dupes });
  const noDesc = pagesWhere((p) => !p.metaDescription.trim());
  if (noDesc.length) add({ section: "Search", title: "Write a one-line description for each page", why: "This is the grey text under your link in search results. Without it, search engines pick a random sentence.", impact: "medium", effort: "About 5 minutes per page", owner: "You", where: noDesc });
  const badH1 = pagesWhere((p) => p.h1 !== 1);
  if (badH1.length) add({ section: "Search", title: "Give each page one main heading", why: "One clear main heading tells search engines and screen readers what the page is about.", impact: "medium", effort: "About 10 minutes per page", owner: "Your web person", where: badH1 });
  const thin = pagesWhere((p) => p.status < 400 && p.words < 150);
  if (thin.length) add({ section: "Search", title: "Add more useful words to thin pages", why: "Pages with very little text give search engines and AI assistants almost nothing to quote.", impact: "low", effort: "About 30 minutes per page", owner: "You", where: thin });
  const noLang = pagesWhere((p) => !p.lang);
  if (noLang.length) add({ section: "Search", title: "Say which language your pages are in", why: "Setting the page language helps search engines show you to the right audience and helps screen readers pronounce words correctly.", impact: "low", effort: "About 5 minutes, once for the whole site", owner: "Your web person", where: noLang.slice(0, 1) });

  // ---- Website health ----
  if (d.brokenLinks.length) add({ section: "Website health", title: "Fix links that go nowhere", why: "Visitors and search engines who follow these links hit an error page and often leave.", impact: "high", effort: "About 5 minutes per link", owner: "Your web person", where: d.brokenLinks.map((b) => `${b.url} (found on ${b.foundOn})`) });
  const lh = d.lighthouse[0];
  if (lh) {
    const lcp = lh.metrics.lcpMs;
    if (lh.scores.performance < 50 || (lcp !== undefined && lcp > 4000)) add({ section: "Website health", title: "Make your homepage load faster", why: `On a typical phone your main content appears after ${lcp ? (lcp / 1000).toFixed(1) + " seconds" : "a long wait"}. Many visitors leave after about 3 seconds, and search engines favour faster pages.`, impact: "high", effort: "1 to 3 hours, usually smaller images and fewer plugins", owner: "Your web person", where: [lh.url] });
    else if (lh.scores.performance < 90) add({ section: "Website health", title: "Speed up your homepage a little", why: "Your homepage is acceptable but not quick on phones. Compressing images is usually the biggest easy win.", impact: "low", effort: "About 1 hour", owner: "Your web person", where: [lh.url] });
    if (lh.scores.bestPractices < 80) add({ section: "Website health", title: "Fix the technical warnings on your homepage", why: "The page shows browser warnings, such as insecure parts or outdated code, which can put off visitors and search engines.", impact: "medium", effort: "About 1 hour", owner: "Your web person", where: [lh.url] });
  }
  if (!d.siteUrl.startsWith("https://")) add({ section: "Website health", title: "Use a secure (https) address", why: "Browsers mark sites without https as \"Not secure\", which costs trust, especially on a donate page.", impact: "high", effort: "About 30 minutes with your hosting provider", owner: "Your web person", where: [d.siteUrl] });
  const noViewport = pagesWhere((p) => !p.hasViewport);
  if (noViewport.length) add({ section: "Website health", title: "Make pages fit phone screens", why: "Without a mobile setting, phones show a tiny zoomed-out page. Most NGO visitors arrive on a phone.", impact: "high", effort: "About 10 minutes", owner: "Your web person", where: noViewport.slice(0, 3) });

  // ---- Accessibility ----
  const alt = d.pages.reduce((n, p) => n + p.imagesMissingAlt, 0);
  if (alt > 0) add({ section: "Accessibility", title: "Describe your images", why: `${alt} image${alt === 1 ? " has" : "s have"} no description, so screen-reader users miss them and search engines cannot understand them.`, impact: "medium", effort: "About 2 minutes per image", owner: "You", where: pagesWhere((p) => p.imagesMissingAlt > 0) });
  const serious = d.axe.filter((v) => v.impact === "serious" || v.impact === "critical");
  for (const v of serious.slice(0, 4)) add({ section: "Accessibility", title: plainAxe(v.id, v.help), why: `${v.nodes} place${v.nodes === 1 ? "" : "s"} on your homepage make this hard for people with low vision or who use a keyboard or screen reader.`, impact: v.impact === "critical" ? "high" : "medium", effort: "About 30 minutes", owner: "Your web person", where: home ? [home.url] : [] });

  // ---- Social and sharing ----
  if (home && (!home.og.title || !home.og.image)) add({ section: "Social and sharing", title: "Add a share preview for WhatsApp, LinkedIn and Facebook", why: "When someone shares your site, the link shows no picture or a wrong title. A good preview gets far more clicks.", impact: "high", effort: "About 15 minutes", owner: "Your web person", where: [home.url] });
  if (d.social.length === 0) add({ section: "Social and sharing", title: "Link your social profiles from your website", why: "Visitors and search engines use these links to confirm your social accounts are really yours.", impact: "low", effort: "About 10 minutes", owner: "You", where: home ? [home.url] : [] });
  for (const s of d.social.filter((x) => x.state === "broken")) add({ section: "Social and sharing", title: `Fix your ${s.platform} link`, why: "The link on your website leads to a page that no longer exists.", impact: "medium", effort: "About 5 minutes", owner: "You", where: [s.url] });

  // The same fix can come from two checks (e.g. our image count and axe's image-alt): keep the
  // higher-impact one and merge the pages it affects.
  const byTitle = new Map<string, Action>();
  for (const a of out.sort((x, y) => RANK[x.impact] - RANK[y.impact])) {
    const kept = byTitle.get(a.title);
    if (!kept) byTitle.set(a.title, a);
    else kept.where = [...new Set([...kept.where, ...a.where])];
  }
  return [...byTitle.values()];
}

export function plainAxe(id: string, help: string): string {
  const plain: Record<string, string> = {
    "color-contrast": "Make text easier to read against its background",
    "image-alt": "Describe your images",
    "label": "Label every form field",
    "link-name": "Give every link a clear name",
    "button-name": "Give every button a clear name",
    "html-has-lang": "Say which language your pages are in",
    "target-size": "Make buttons and links easier to tap",
  };
  return plain[id] ?? help;
}
