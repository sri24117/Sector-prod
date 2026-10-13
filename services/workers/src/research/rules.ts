import type { AuditResult } from "@sector/crawler";
import type { CheckResult, Pillar } from "@sector/shared/research-score";
import { homeLighthouse } from "../report/analysis.js";
import type { PageFacts, ReportData } from "../report/types.js";

// The rules layer of the research audit (specs/2026-10-13-research-audit-design.md): deterministic
// checks over data we measured. No LLM. A check that could not run is could_not_check, never a failure.

export interface RuleFinding {
  pillar: Pillar; layer: "rules"; checkId: string; result: CheckResult; points: number;
  evidence: string | null; fix: string | null; effort: string | null;
}
export interface RulesInput { report: ReportData; audit: AuditResult | null }

const list = (urls: string[]) => (urls.length <= 5 ? urls.join(", ") : `${urls.slice(0, 5).join(", ")} and ${urls.length - 5} more`);
const pathOf = (u: string) => { try { return new URL(u).pathname.toLowerCase(); } catch { return ""; } };
const median = (n: number[]) => { const s = [...n].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length === 0 ? 0 : s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };

/** The checks in @sector/crawler that read the HTML as served; they say nothing about a page built by JavaScript. */
const HTML_BASED = new Set(["schema", "heading_hierarchy", "faq_pairs", "front_loaded_stat", "freshness"]);
const AIO: Record<string, { points: number; fix: string; effort: string }> = {
  schema: { points: 20, fix: "Add structured data (JSON-LD) that names your organization, such as an Organization or NGO block, and FAQPage on your questions page.", effort: "About 30 minutes" },
  robots_txt_ai_block: { points: 15, fix: "Allow AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended) in your robots.txt, unless you deliberately want to block them.", effort: "About 10 minutes" },
  llms_txt: { points: 5, fix: "Add a short llms.txt file at the root of your site that lists your most important pages for AI assistants.", effort: "About 20 minutes" },
  heading_hierarchy: { points: 15, fix: "Use one main heading per page and put sub-headings in order (H2 under H1, H3 under H2).", effort: "About 10 minutes per page" },
  faq_pairs: { points: 20, fix: "Add a question-and-answer section that answers what people ask about your work, in plain sentences.", effort: "About 1 hour" },
  front_loaded_stat: { points: 15, fix: "Put your strongest impact number in the first paragraph of your homepage.", effort: "About 15 minutes" },
  freshness: { points: 10, fix: "Show when pages were last updated, for example a visible 'last updated' date.", effort: "About 20 minutes" },
};
const ORG_TYPES = ["Organization", "NGO", "NonprofitOrganization"];
const KEY = {
  about: /\/(about|about[-_]us|who[-_]we[-_]are|our[-_]story)(\/|$)/,
  donate: /\/(donate|give|giving|support[-_]us|contribute)(\/|$)/,
  programs: /\/(programs?|programmes?|our[-_]work|projects?|what[-_]we[-_]do)(\/|$)/,
  contact: /\/contact([-_]us)?(\/|$)/,
};

export function deriveRulesFindings({ report, audit }: RulesInput): RuleFinding[] {
  const out: RuleFinding[] = [];
  const pages = report.pages.filter((p) => p.status < 400);
  const home = pages[0];
  if (!home) return out; // nothing readable: no findings, so no score (never 0)
  const lh = homeLighthouse(report);

  const add = (pillar: Pillar, checkId: string, points: number, result: CheckResult, evidence: string, fix: string, effort: string) =>
    out.push({ pillar, layer: "rules", checkId, result, points, evidence: result === "pass" ? null : evidence, fix: result === "fail" ? fix : null, effort: result === "fail" ? effort : null });
  const onPages = (pillar: Pillar, checkId: string, points: number, bad: PageFacts[], what: string, fix: string, effort: string) =>
    add(pillar, checkId, points, bad.length === 0 ? "pass" : "fail", `${what}: ${list(bad.map((p) => p.url))}`, fix, effort);
  const needsLh = (pillar: Pillar, checkId: string, points: number, ok: (l: NonNullable<typeof lh>) => boolean, evidence: (l: NonNullable<typeof lh>) => string, fix: string, effort: string) =>
    lh ? add(pillar, checkId, points, ok(lh) ? "pass" : "fail", evidence(lh), fix, effort)
       : add(pillar, checkId, points, "could_not_check", "The speed and accessibility test could not finish on your homepage.", fix, effort);

  // ---- SEO ----
  add("seo", "seo.https", 10, home.url.startsWith("https://") ? "pass" : "fail", `Your site ends up at ${home.url}`, "Move the whole site to https. Your hosting provider can switch it on and redirect old addresses.", "About 30 minutes with your hosting provider");
  onPages("seo", "seo.titles", 15, pages.filter((p) => !p.title.trim()), "No title on", "Give every page a short, specific title.", "About 5 minutes per page");
  const byTitle = new Map<string, string[]>();
  for (const p of pages) if (p.title.trim()) byTitle.set(p.title.trim(), [...(byTitle.get(p.title.trim()) ?? []), p.url]);
  const dupes = [...byTitle.values()].filter((u) => u.length > 1).flat();
  add("seo", "seo.titles_unique", 10, dupes.length ? "fail" : "pass", `Pages sharing a title: ${list(dupes)}`, "Give each page its own title so search engines can tell the pages apart.", "About 5 minutes per page");
  onPages("seo", "seo.meta_descriptions", 15, pages.filter((p) => !p.metaDescription.trim()), "No description on", "Write a one-line description for each page; it is the text under your link in search results.", "About 5 minutes per page");
  onPages("seo", "seo.single_h1", 10, pages.filter((p) => p.h1 !== 1), "Not exactly one main heading on", "Give each page exactly one main heading (H1) that says what the page is about.", "About 10 minutes per page");
  add("seo", "seo.canonical", 5, home.canonical ? "pass" : "fail", "Your homepage has no canonical link.", "Add a canonical link to your homepage so search engines know the preferred address.", "About 10 minutes");
  onPages("seo", "seo.language", 5, pages.filter((p) => !p.lang), "No page language on", "Set the page language (for example lang=\"en\") once for the whole site.", "About 5 minutes");
  onPages("seo", "seo.thin_content", 10, pages.filter((p) => p.words < 150), "Fewer than 150 words on", "Add more useful text to these pages; very short pages give search engines and AI assistants little to quote.", "About 30 minutes per page");
  add("seo", "seo.broken_links", 10, report.brokenLinks.length ? "fail" : "pass", `Broken links: ${list(report.brokenLinks.map((b) => `${b.url} (found on ${b.foundOn})`))}`, "Fix or remove links that lead to error pages.", "About 5 minutes per link");
  needsLh("seo", "seo.lighthouse_seo", 10, (l) => l.scores.seo >= 90, (l) => `Search score ${l.scores.seo} out of 100 on your homepage.`, "Fix the search problems Lighthouse lists for your homepage (titles, descriptions, link text, mobile setup).", "About 1 hour");

  // ---- AI readiness ----
  const jsBuilt = audit !== null && audit.htmlWords < 100 && home.words >= 300;
  if (audit === null) {
    for (const [id, a] of Object.entries(AIO)) add("aio", `aio.${id}`, a.points, "could_not_check", "The AI-readiness check could not read your homepage.", a.fix, a.effort);
    add("aio", "aio.readable_without_js", 15, "could_not_check", "The AI-readiness check could not read your homepage.", "", "");
  } else {
    for (const c of audit.checks) {
      const a = AIO[c.checkId];
      if (!a) continue;
      if (jsBuilt && HTML_BASED.has(c.checkId)) add("aio", `aio.${c.checkId}`, c.weight, "could_not_check", "Your pages are built with JavaScript, so this check could not read them the way an AI crawler would.", a.fix, a.effort);
      else add("aio", `aio.${c.checkId}`, c.weight, c.passed ? "pass" : "fail", c.detail, a.fix, a.effort);
    }
    add("aio", "aio.readable_without_js", 15, jsBuilt ? "fail" : "pass", `Without JavaScript your homepage shows about ${audit.htmlWords} words; with it, about ${home.words}. AI crawlers such as GPTBot do not run JavaScript.`, "Make your main text and headings part of the page itself (server-rendered or static), not built only by scripts.", "Depends on your website builder; ask your web person");
  }

  // ---- UI/UX ----
  onPages("uiux", "uiux.viewport", 15, pages.filter((p) => !p.hasViewport), "No mobile setting on", "Add the mobile viewport setting so phones show the page at the right size.", "About 10 minutes");
  needsLh("uiux", "uiux.lighthouse_accessibility", 20, (l) => l.scores.accessibility >= 90, (l) => `Accessibility score ${l.scores.accessibility} out of 100 on your homepage.`, "Fix the accessibility problems Lighthouse lists for your homepage.", "About 1 hour");
  if (report.axe === null) add("uiux", "uiux.axe_serious", 20, "could_not_check", "The automated accessibility scan could not run on your homepage.", "", "");
  else {
    const serious = report.axe.filter((v) => v.impact === "serious" || v.impact === "critical");
    add("uiux", "uiux.axe_serious", 20, serious.length ? "fail" : "pass", serious.map((v) => `${v.id}: ${v.help} (${v.nodes} places)`).join("; "), "Fix the serious accessibility problems listed; they stop people with low vision or who use a keyboard or screen reader.", "About 30 minutes each");
  }
  const missingAlt = pages.filter((p) => p.imagesMissingAlt > 0);
  add("uiux", "uiux.image_alt", 10, missingAlt.length ? "fail" : "pass", `Images without a description on: ${list(missingAlt.map((p) => p.url))}`, "Describe every meaningful image with short alt text.", "About 2 minutes per image");
  needsLh("uiux", "uiux.performance", 20, (l) => l.scores.performance >= 70 && (l.metrics.lcpMs === undefined || l.metrics.lcpMs <= 4000), (l) => `Speed score ${l.scores.performance} out of 100; main content appears after ${l.metrics.lcpMs ? (l.metrics.lcpMs / 1000).toFixed(1) + " seconds" : "an unknown time"}.`, "Make your homepage load faster: compress images and remove plugins you do not need.", "1 to 3 hours");
  if (lh && lh.metrics.cls === undefined) add("uiux", "uiux.layout_shift", 10, "could_not_check", "The speed test gave no layout-shift value.", "", "");
  else needsLh("uiux", "uiux.layout_shift", 10, (l) => (l.metrics.cls ?? 0) <= 0.1, (l) => `Layout shift ${l.metrics.cls} (should be 0.1 or less).`, "Give images and banners a fixed size so the page does not jump while it loads.", "About 1 hour");
  needsLh("uiux", "uiux.best_practices", 5, (l) => l.scores.bestPractices >= 80, (l) => `Best-practices score ${l.scores.bestPractices} out of 100.`, "Fix the technical warnings Lighthouse lists for your homepage.", "About 1 hour");

  // ---- Content and brand ----
  add("brand", "brand.og_preview", 15, home.og.title && home.og.image ? "pass" : "fail", "Sharing your link on WhatsApp, LinkedIn or Facebook shows no picture or title.", "Add a share preview (title, description and picture) to your homepage.", "About 15 minutes");
  add("brand", "brand.twitter_card", 5, home.twitterCard ? "pass" : "fail", "No Twitter/X card setting on your homepage.", "Add a Twitter/X card setting so shares on X show a large preview.", "About 10 minutes");
  const broken = report.social.filter((s) => s.state === "broken");
  add("brand", "brand.social_links", 10, report.social.length > 0 && broken.length === 0 ? "pass" : "fail", report.social.length === 0 ? "Your website does not link to any social profile." : `Broken social links: ${list(broken.map((s) => s.url))}`, "Link your real social profiles from your website and fix any that no longer exist.", "About 10 minutes");
  add("brand", "brand.org_schema", 10, home.jsonLdTypes.some((t) => ORG_TYPES.includes(t)) ? "pass" : "fail", "Your homepage has no structured description of your organization.", "Add Organization or NGO structured data so search engines and AI assistants know who you are.", "About 30 minutes");
  const seen = [...new Set([...pages.map((p) => pathOf(p.url)), ...home.internalLinks.map(pathOf)])];
  const hasKey = (re: RegExp) => seen.some((p) => re.test(p));
  add("brand", "brand.about_page", 10, hasKey(KEY.about) ? "pass" : "fail", "No page about who you are was found.", "Add an About page that says who you are, why you exist and who runs the organization.", "About 2 hours");
  add("brand", "brand.donate_path", 15, hasKey(KEY.donate) ? "pass" : "fail", "No donate or support page was found.", "Add a clear way to give or support you, and link it from the homepage.", "About 2 hours");
  add("brand", "brand.programs_page", 10, hasKey(KEY.programs) ? "pass" : "fail", "No page describing your programmes or work was found.", "Add a page that explains what you do, with real numbers and stories.", "About 3 hours");
  add("brand", "brand.contact_page", 5, hasKey(KEY.contact) ? "pass" : "fail", "No contact page was found.", "Add a contact page with an address, email or phone, and a form.", "About 1 hour");
  const depth = median(pages.map((p) => p.words));
  add("brand", "brand.content_depth", 10, depth >= 300 ? "pass" : "fail", `The typical page has about ${Math.round(depth)} words; 300 or more gives visitors and search engines enough to understand your work.`, "Add more of your real story, numbers and examples to your main pages.", "About 1 hour per page");

  return out;
}
