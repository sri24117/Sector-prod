import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Action, ReportData } from "./types.js";
import { bucketOf, homeLighthouse, overallScore, plainAxe } from "./analysis.js";
import { SCORE_MODEL } from "./types.js";

const SERIOUS: Record<string, string> = { critical: "Blocks some people", serious: "Hard for some people", moderate: "Annoying", minor: "Minor" };

// The full report as one self-contained HTML document: SEctOr design system (paper, ink,
// pine; Newsreader for the score and headings, Public Sans for text), embedded fonts and
// screenshots, no scripts. The same HTML is shown online and printed to PDF.

export const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

let fontCss: string | undefined;
function fonts(): string {
  if (fontCss !== undefined) return fontCss;
  try {
    const f = (n: string) => readFileSync(fileURLToPath(new URL(`../../assets/${n}`, import.meta.url))).toString("base64");
    fontCss = `@font-face{font-family:Newsreader;src:url(data:font/woff2;base64,${f("newsreader-latin-var.woff2")}) format("woff2");font-weight:400 500}
@font-face{font-family:"Public Sans";src:url(data:font/woff2;base64,${f("public-sans-latin-var.woff2")}) format("woff2");font-weight:400 600}`;
  } catch { fontCss = ""; }
  return fontCss;
}

const AREA = { performance: "Speed", seo: "Search basics", accessibility: "Accessibility", bestPractices: "Good practice" } as const;
const verdict = (n: number) => (n >= 90 ? "Good" : n >= 50 ? "Needs work" : "Poor");
const path = (u: string) => { try { const x = new URL(u); return x.pathname + x.search || "/"; } catch { return u; } };
const yes = (ok: boolean) => (ok ? `<span class="ok">✓ Yes</span>` : `<span class="no">✗ No</span>`);

function summary(d: ReportData, actions: Action[]): string[] {
  const out: string[] = [];
  const lh = homeLighthouse(d);
  if (lh) {
    const s = lh.scores;
    out.push(s.performance >= 90 ? "Your homepage loads quickly on phones." : s.performance >= 50 ? "Your homepage loads at an acceptable speed on phones, with room to improve." : "Your homepage is slow on phones, which loses visitors before they read anything.");
    out.push(s.accessibility >= 90 ? "Most people, including those using screen readers, can use your homepage." : "Some people with low vision or who use screen readers will struggle with parts of your homepage.");
  }
  const searchIssues = actions.filter((a) => a.section === "Search").length;
  out.push(searchIssues === 0 ? "Search engines have what they need to understand your pages." : `We found ${searchIssues} thing${searchIssues === 1 ? "" : "s"} that make it harder for search engines and AI assistants to understand and show your pages.`);
  out.push(d.social.length ? `Your website links to ${d.social.map((s) => s.platform).join(", ")}.` : "Your website does not link to any social profiles.");
  const first = actions.filter((a) => a.impact === "high").length;
  out.push(first ? `Start with the ${first} item${first === 1 ? "" : "s"} under "Do first" in the action plan: they make the biggest difference.` : "There is nothing urgent. The action plan lists smaller improvements.");
  return out;
}

export function renderReportHtml(d: ReportData, actions: Action[]): string {
  const score = overallScore(d);
  const lh = homeLighthouse(d);
  const date = new Date(d.generatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const wins = actions.slice(0, 3);
  const buckets = (["Do first", "This month", "Later"] as const).map((b) => [b, actions.filter((a) => bucketOf(a) === b)] as const);
  const home = d.pages[0];

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SEctOr report: ${esc(d.organizationName)}</title>
<style>${fonts()}
:root{--paper:#f6f7f3;--ink:#161b17;--muted:#5b6058;--line:#e2e4dc;--pine:#1f4d3b;--ochre:#9c6b1f;--surface:#fbfcf9}
*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 "Public Sans",system-ui,sans-serif;font-variant-numeric:tabular-nums}
main{max-width:860px;margin:0 auto;padding:48px 24px 64px}
h1,h2,.num{font-family:Newsreader,Georgia,serif;font-weight:500}h1{font-size:32px;line-height:1.2;margin:8px 0}
h2{font-size:28px;line-height:1.25;margin:0 0 8px}h3{font-size:16px;margin:24px 0 8px}
p{margin:0 0 8px}.muted{color:var(--muted)}.small{font-size:13px;color:var(--muted)}
section{margin-top:48px;padding-top:32px;border-top:1px solid var(--line);break-inside:auto}
.card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:20px 24px;margin:12px 0;break-inside:avoid}
.big{font-size:72px;line-height:1;font-family:Newsreader,Georgia,serif}.rule{width:200px;height:2px;background:var(--ink);margin:12px 0 4px}
.areas{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:24px}.area .num{font-size:32px}
table{width:100%;border-collapse:collapse;font-size:13px;margin:8px 0}th,td{text-align:left;padding:8px 8px 8px 0;border-bottom:1px solid var(--line);vertical-align:top}th{font-weight:600}
.ok{color:var(--ink)}.ok::first-letter{color:var(--pine)}.no{color:var(--ink)}.no::first-letter{color:var(--ochre)}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.chip{border:1px solid var(--line);border-radius:999px;padding:2px 12px;font-size:13px;background:var(--paper)}
.shots{display:grid;grid-template-columns:3fr 1fr;gap:16px;align-items:start}.shots img{width:100%;border:1px solid var(--line);border-radius:12px}
ul.plain{padding-left:20px}a{color:var(--pine)}.where{font-size:13px;color:var(--muted);word-break:break-all}
@page{size:A4;margin:16mm 14mm}@media print{main{padding:0}section{break-before:auto}.cover{min-height:auto}}
</style></head><body><main>

<header class="cover">
<p class="small">SEctOr full report · ${esc(date)}</p>
<h1>${esc(d.organizationName)}</h1>
<p class="muted">${esc(d.siteUrl)} · ${d.pages.length} page${d.pages.length === 1 ? "" : "s"} checked</p>
${score !== null ? `<div style="margin-top:32px"><div class="big">${score}</div><div class="rule"></div><p class="muted">out of 100 overall</p></div>` : `<p class="muted">The speed and accessibility test could not run this time; the rest of the report is complete.</p>`}
${lh ? `<div class="areas">${(Object.keys(AREA) as (keyof typeof AREA)[]).map((k) => `<div class="card area"><p class="small">${AREA[k]}</p><div class="num">${lh.scores[k]}</div><p class="small">${verdict(lh.scores[k])}</p></div>`).join("")}</div>` : ""}
${wins.length ? `<div class="card" style="margin-top:24px"><h3 style="margin-top:0">Your three biggest wins</h3><ol>${wins.map((a) => `<li><strong>${esc(a.title)}</strong>: ${esc(a.why)}</li>`).join("")}</ol></div>` : ""}
</header>

<section><h2>Summary</h2>${summary(d, actions).map((s) => `<p>${esc(s)}</p>`).join("")}</section>

<section><h2>Search</h2><p class="muted">How easily search engines and AI assistants can find, understand and show each page.</p>
<table><thead><tr><th>Page</th><th>Title</th><th>Description</th><th>One main heading</th><th>Words</th></tr></thead><tbody>
${d.pages.map((p) => `<tr><td>${esc(path(p.url))}${p.status >= 400 ? ` <span class="no">✗ error ${p.status}</span>` : ""}</td><td>${p.title ? esc(p.title.slice(0, 70)) : yes(false)}</td><td>${yes(!!p.metaDescription)}</td><td>${yes(p.h1 === 1)}</td><td>${p.words}</td></tr>`).join("")}
</tbody></table>
<p class="small">Structured data on the homepage: ${home?.jsonLdTypes.length ? esc(home.jsonLdTypes.join(", ")) : "none found"}.</p></section>

<section><h2>Website health</h2><p class="muted">Speed, phones, security and broken links.</p>
${lh ? `<table><tbody><tr><th>Main content appears after</th><td>${lh.metrics.lcpMs ? (lh.metrics.lcpMs / 1000).toFixed(1) + " s" : "n/a"} <span class="small">(good: under 2.5 s)</span></td></tr>
<tr><th>Page jumps while loading</th><td>${lh.metrics.cls ?? "n/a"} <span class="small">(good: under 0.1)</span></td></tr>
<tr><th>Time the page is busy</th><td>${lh.metrics.tbtMs !== undefined ? Math.round(lh.metrics.tbtMs) + " ms" : "n/a"} <span class="small">(good: under 200 ms)</span></td></tr>
<tr><th>Secure address (https)</th><td>${yes(d.siteUrl.startsWith("https://"))}</td></tr>
<tr><th>Fits phone screens</th><td>${yes(d.pages.every((p) => p.hasViewport))}</td></tr></tbody></table>` : ""}
${d.screenshots.desktop || d.screenshots.mobile ? `<div class="shots">${d.screenshots.desktop ? `<img alt="Your homepage on a computer" src="data:image/jpeg;base64,${d.screenshots.desktop}">` : ""}${d.screenshots.mobile ? `<img alt="Your homepage on a phone" src="data:image/jpeg;base64,${d.screenshots.mobile}">` : ""}</div>` : ""}
<h3>Broken links</h3>${d.brokenLinks.length ? `<ul class="plain">${d.brokenLinks.map((b) => `<li>${esc(path(b.url))} <span class="small">error ${b.status}, linked from ${esc(path(b.foundOn))}</span></li>`).join("")}</ul>` : `<p>${yes(true)} None found on the pages we checked.</p>`}
${d.unreachable.length ? `<p class="small">These pages did not load in time while we checked, so we could not tell whether they work. Open them yourself to be sure: ${d.unreachable.slice(0, 10).map((u) => esc(path(u.url))).join(", ")}.</p>` : ""}</section>

<section><h2>Accessibility</h2><p class="muted">Whether people with low vision, or who use a keyboard or screen reader, can use your homepage.</p>
${d.axe === null ? `<p>The automated accessibility scan could not run on your homepage this time, so we cannot say whether it has problems. Creating a new report usually fixes this.</p>` : d.axe.length ? `<table><thead><tr><th>What we found</th><th>How serious</th><th>Places</th></tr></thead><tbody>${d.axe.slice(0, 12).map((v) => `<tr><td>${esc(plainAxe(v.id, v.help))}</td><td>${esc(SERIOUS[v.impact ?? "minor"] ?? "Minor")}</td><td>${v.nodes}</td></tr>`).join("")}</tbody></table>` : `<p>${yes(true)} No accessibility problems found automatically on the homepage.</p>`}
<p class="small">Automated checks find many common problems, not all of them. This section is not a full accessibility (WCAG) audit, which needs a person testing the site.</p>
<p class="small">Images without a description across checked pages: ${d.pages.reduce((n, p) => n + p.imagesMissingAlt, 0)} of ${d.pages.reduce((n, p) => n + p.images, 0)}.</p></section>

<section><h2>Social and sharing</h2><p class="muted">The social profiles your website points to, and how your site looks when someone shares it.</p>
${d.social.length ? `<table><thead><tr><th>Platform</th><th>Profile</th><th>Link works</th></tr></thead><tbody>${d.social.map((s) => `<tr><td>${esc(s.platform)}</td><td class="where">${esc(s.url)}</td><td>${s.state === "ok" ? yes(true) : s.state === "broken" ? yes(false) : `<span class="small">could not check automatically</span>`}</td></tr>`).join("")}</tbody></table>` : `<p>No social profile links found on your website.</p>`}
<h3>Share preview</h3><table><tbody><tr><th>Preview title</th><td>${home?.og.title ? esc(home.og.title) : yes(false)}</td></tr><tr><th>Preview description</th><td>${home?.og.description ? esc(home.og.description) : yes(false)}</td></tr><tr><th>Preview image</th><td>${yes(!!home?.og.image)}</td></tr><tr><th>Large card on X</th><td>${yes(home?.twitterCard === "summary_large_image")}</td></tr></tbody></table>
<p class="small">Follower counts and engagement need each platform's permission and are not part of this report.</p></section>

<section><h2>Your action plan</h2><p class="muted">Every fix, in the order we suggest. "Who" is a suggestion: your web person is whoever manages your website.</p>
${buckets.map(([b, list]) => list.length ? `<h3>${b}</h3>${list.map((a) => `<div class="card"><p><strong>${esc(a.title)}</strong></p><p class="muted">${esc(a.why)}</p><p class="chips"><span class="chip">${esc(a.section)}</span><span class="chip">${esc(a.effort)}</span><span class="chip">Who: ${esc(a.owner)}</span></p>${a.where.length ? `<p class="where">Where: ${a.where.slice(0, 5).map((w) => esc(path(w.split(" (found on")[0]!))).join(", ")}${a.where.length > 5 ? ` and ${a.where.length - 5} more` : ""}</p>` : ""}</div>`).join("")}` : "").join("")}
${actions.length ? "" : `<p>${yes(true)} Nothing to fix right now.</p>`}</section>

${d.notes.length ? `<section><h2>What we could not check</h2><ul class="plain">${d.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></section>` : ""}
<p class="small" style="margin-top:48px">Prepared by SEctOr on ${esc(date)} for ${esc(d.organizationName)}. Speed and accessibility measured with Lighthouse and axe-core on a simulated mid-range phone. Score model ${SCORE_MODEL}.</p>
</main></body></html>`;
}
