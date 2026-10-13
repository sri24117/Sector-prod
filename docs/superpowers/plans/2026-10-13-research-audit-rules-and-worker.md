# Research Audit Rules Layer and Worker Implementation Plan (Plan 2 of 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a research audit actually run: a worker job crawls the organization's verified site, derives deterministic rules-layer findings for all four pillars, scores them with the Plan 1 engine, stores everything, and leaves the audit `in_review` for the owner, who can read it with a CLI and release it. Production stays switched off behind a feature flag.

**Architecture:** The paid full report already crawls with Playwright, runs Lighthouse and axe, and checks social links. This plan extracts that data gathering into one reusable function, adds a pure rules catalogue that turns the gathered data (plus the cheerio-based AI-readiness checks from `@sector/crawler`) into findings, and a job that persists the result through `scopedDb`. The job runs on the existing `report` queue (job name `research-audit`), so only one Chromium job runs at a time on the shared host (ADR-0007).

**Tech Stack:** TypeScript, Playwright, Lighthouse, axe-core, cheerio, BullMQ, drizzle-orm, Fastify, vitest (real Postgres for DB-backed tests).

**Spec:** `docs/superpowers/specs/2026-10-13-research-audit-design.md` (PR #17). Builds on Plan 1 (`docs/superpowers/plans/2026-10-13-research-audit-foundation.md`, PR #18), which must be merged first: this plan uses `scopedDb(...).researchAudits`, migration 0004 and `@sector/shared/research-score`.

## Plan series

1. Plan 1, foundation (done, PR #18).
2. **This plan:** rules layer, platform detection, worker job, queue wiring behind a flag, `research-show` CLI.
3. Reference library: import script and the first ~10 sources (needs real URLs from the owner; candidate list received 2026-10-13).
4. Peer research (layer C): search-source ADR, fetch, LLM extraction, 30-day cache.
5. Pillar skills and synthesis (LLM-written summaries and brand direction, platform-specific fix copy), JSON-schema output validation.
6. Review screen, organization tab, PDF, upgrade prompt, operator login (blocked on a human decision about operator auth).

## Spec deltas and rulings made while planning

1. **Platform-specific fix copy is deferred to Plan 5.** The spec says fixes are written for the detected platform. Menu paths for Wix, Squarespace and the rest must be checked against each platform's own documentation, and I will not invent them. This plan detects and stores the platform and writes generic fixes.
2. **JavaScript-built sites.** The spec said HTML checks on an unreadable page become `could_not_check`. Plan 2 does that for the five cheerio-based AI-readiness checks, **and** adds a real AIO check, `aio.readable_without_js`, that fails when the site shows almost no text without JavaScript. AI crawlers such as GPTBot do not run JavaScript, so such a site is genuinely invisible to them. That is a finding, not a gap.
3. **"One active audit" means one being prepared.** Plan 1's reviewer asked whether `in_review` counts as active. Ruling: no. The limit protects the worker and Chromium; an audit waiting for review uses neither. The daily cap of 3 still bounds duplicates. No code change; the wording is fixed here.
4. **Feature flag.** `POST /research-audits` is registered only when a queue is wired, and the queue is wired in production only when `RESEARCH_AUDIT_ENABLED=true`. The owner has no review screen until Plan 6, so the flag stays off until the owner chooses to run audits and read them with `research-show`.
5. **Carry-overs from Plan 1's final review** are done in Task 1: whitespace-only source URLs are rejected by the scorer and the database; an audit cannot be updated after release. The viewer-role 403 test is **not** done: the repo has no simple helper for creating a viewer session, and writing one is out of scope. It stays on the deferred list.

## Global Constraints

- Layer shares default to rules 50, reference 30, peer 20; pillar weights 25 each; both sum to exactly 100 (Plan 1 `DEFAULT_WEIGHTS`). This plan produces only the `rules` layer; the other two layers are missing and their weight is redistributed. The stored summary says so in plain words.
- A check that could not run is `could_not_check`: never a failure, never counted. A page-level check with no readable page produces no findings at all, so the pillar score is `null`, never 0.
- Everything in the rules layer is deterministic code. No LLM anywhere in this plan (CLAUDE.md section 2).
- All fetching goes through the SSRF guard: Playwright through the guarded proxy (ADR-0007), plain HTTP through `guardedAgent()`. Never add a direct fetch.
- One Chromium job at a time: research audits share the `report` queue (concurrency 1, `lockDuration` 10 minutes). Limits: 20 pages (existing `MAX_PAGES`), 10-minute job timeout.
- Every database access goes through `scopedDb(organizationId)`; the job never receives a bare audit id without its organization id.
- `researchAudits.update()` cannot set `status: "released"` or `releasedAt` (Plan 1). Only `releaseAudit` releases.
- The audit is visible to the organization only after release. This plan must not add any path that shows an unreleased audit.
- No new runtime dependencies. Match surrounding style (dense one-liners in `tenant-scope.ts`; `.js` import suffixes; short comments saying why).
- Production deploys run migrations against live data: migration 0005 must be additive or a constraint swap on a table that has never held data, and must be read before commit.

## Review Focus

Failure modes the spec implies that no obvious test would catch. Each has a test in the task that owns the code.

1. A site built with JavaScript (almost no text without scripts): five HTML checks are `could_not_check`, `aio.readable_without_js` fails, nothing divides by zero. (Task 3.)
2. Lighthouse could not finish: the five Lighthouse-based checks are `could_not_check` and the pillar scores come from the remaining checks, not 0. Same for a failed axe scan. (Task 3.)
3. A site where only the homepage loaded: page-level checks still work on one page, and an empty crawl yields no findings and `null` scores. (Task 3 and Task 5.)
4. The job delivered twice, or after the audit already left `queued`: it does nothing and writes nothing twice. (Task 5.)
5. The job fails midway or times out: the audit ends `failed` with a plain-language message, and no half-written findings remain (findings are inserted in one statement only after analysis succeeds). (Task 5.)
6. The platform cannot be detected because the plain-HTTP fetch failed but the browser crawl worked: platform is `unknown`, the audit still completes. (Task 5.)
7. The feature flag is off: no `POST /research-audits` route exists in production. (Task 6.)

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/shared/src/research-score.ts` (modify) | Trim whitespace in source URLs (Task 1). |
| `packages/db/drizzle/0005_*.sql` + meta (generated or hand-written) | Tighten the source CHECK (Task 1). |
| `packages/db/src/schema.ts` (modify) | New CHECK expression (Task 1). |
| `packages/db/src/tenant-scope.ts` (modify) | `update()` refuses audits already released (Task 1). |
| `services/crawler/src/platform.ts` (create) | `detectPlatform(html, headers)` and the `Platform` type. |
| `services/crawler/src/audit.ts` (modify) | `AuditResult` gains `platform` and `htmlWords`. |
| `services/crawler/src/lib.ts` (modify) | Export platform helpers. |
| `services/crawler/test/platform.test.ts` (create) | Detection fixtures. |
| `services/workers/src/report/gather.ts` (create) | `gatherSiteData`: crawl, Lighthouse, social, with injectable deps. |
| `services/workers/src/report/run.ts` (modify) | `buildReport` calls `gatherSiteData` (behavior unchanged). |
| `services/workers/test/gather.test.ts` (create) | Ordering, timing and failure behavior with fake deps. |
| `services/workers/src/research/rules.ts` (create) | Pure catalogue: `deriveRulesFindings`. |
| `services/workers/test/research-rules.test.ts` (create) | One good and one bad case per check. |
| `services/workers/src/research/analyze.ts` (create) | Pure: findings, scores, summary. |
| `services/workers/src/research/collect.ts` (create) | Starts proxy and browser, gathers, closes; returns `ReportData`. |
| `services/workers/src/research/run.ts` (create) | `runResearchAuditJob` with injectable deps. |
| `services/workers/vitest.config.ts`, `services/workers/test/global-setup.ts` (create) | Test database for DB-backed worker tests. |
| `services/workers/test/research-run.test.ts` (create) | Job behavior against real Postgres with fake collectors. |
| `services/workers/src/index.ts` (modify) | Dispatch jobs on the `report` queue by name. |
| `apps/api/src/lib/research-queue.ts` (create) | Producer: adds `research-audit` jobs to the `report` queue. |
| `apps/api/src/app.ts` (modify) | Wire the queue only when `RESEARCH_AUDIT_ENABLED=true`. |
| `apps/api/test/research-flag.test.ts` (create) | Route exists only with the flag. |
| `apps/api/src/lib/research-show.ts` (create) | Pure `formatAudit` text formatter. |
| `apps/api/src/scripts/research-show.ts` (create) | Read-only CLI. |
| `apps/api/test/research-show.test.ts` (create) | Formatter tests. |
| `apps/api/package.json` (modify) | `research-show` script. |
| `.env.example`, `docker-compose.yml` (modify) | `RESEARCH_AUDIT_ENABLED` documented and passed to the api container. |
| `docs/runbooks/research-audit.md` (create) | Enable, review, release, disable. |

**Prerequisites:** Plan 1 merged to `main` (or branch from `feat/research-audit-foundation`). Postgres running (`bash ~/.local/sector-deps/start-sector.sh` starts everything; for tests only, `pg_ctl` on 127.0.0.1:5432 is enough). To run any command needing `DATABASE_URL` or `REDIS_URL` locally: `source ~/.local/sector-deps/dev.env.sh` (contains secrets: never print it). **Branch:** `feat/research-audit-rules` from the latest `main`. Never push to `main`.

---

### Task 1: Carry-over hardening from Plan 1

**Files:**
- Modify: `packages/shared/src/research-score.ts` (the drop rule), `packages/shared/test/research-score.test.ts`
- Modify: `packages/db/src/schema.ts` (the `research_findings_source_ck` check)
- Create: `packages/db/drizzle/0005_*.sql` and meta (see Step 4)
- Modify: `packages/db/src/tenant-scope.ts` (`researchAudits.update`, add `ne` to the drizzle-orm import)
- Modify: `packages/db/test/research-audits.test.ts`

**Interfaces:**
- Consumes: Plan 1 `scoreResearchAudit`, `scopedDb(...).researchAudits.update`.
- Produces: unchanged signatures. Behavior changes: a whitespace-only `sourceUrl` counts as missing; `update()` returns `null` (and changes nothing) for an audit that is already `released`.

- [ ] **Step 1: Write the failing tests**

Add to `packages/shared/test/research-score.test.ts`, inside the `describe`:

```ts
  it("treats a whitespace-only source as no source", () => {
    const r = scoreResearchAudit([
      { pillar: "seo", layer: "reference", checkId: "x", result: "pass", points: 10, sourceUrl: "   " },
      f("seo", "rules", "fail", 10),
    ]);
    expect(r.pillars.seo.dropped).toBe(1);
    expect(r.pillars.seo.layers.reference.score).toBeNull();
  });
```

Add to `packages/db/test/research-audits.test.ts`, inside the `describe("researchAudits repository")`:

```ts
  it("update returns null and changes nothing once an audit is released", async () => {
    const db = scopedDb(orgA).researchAudits;
    const a = await db.create({ siteUrl: "https://a.example.org/", createdBy: "u1" });
    await rawDb.update(schema.researchAudits).set({ status: "released", releasedAt: new Date(), overallScore: 70 }).where(eq(schema.researchAudits.id, a.id));
    expect(await db.update(a.id, { overallScore: 5, status: "failed" })).toBeNull();
    const row = await db.findById(a.id);
    expect(row?.status).toBe("released");
    expect(row?.overallScore).toBe(70);
  });
```

and inside the `describe("research tables constraints")`:

```ts
  it("rejects a peer finding whose source_url is only whitespace", async () => {
    await expect(rawDb.insert(schema.researchFindings).values({ auditId: auditA, organizationId: orgA, pillar: "seo", layer: "peer", checkId: "x", result: "pass", points: 5, sourceUrl: "   " })).rejects.toThrow();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @sector/shared test -- research-score && pnpm --filter @sector/db test -- research-audits`
Expected: the three new tests FAIL (scorer keeps the whitespace source; `update` changes a released audit; the database accepts `"   "`).

- [ ] **Step 3: Fix the scorer and the repository**

In `packages/shared/src/research-score.ts` change the drop line to:

```ts
      if (x.layer !== "rules" && !x.sourceUrl?.trim()) { dropped++; continue; }
```

In `packages/db/src/tenant-scope.ts`, add `ne` to the first import line (`import { and, desc, eq, gt, inArray, isNotNull, isNull, ne } from "drizzle-orm";`, keeping whatever names are already there) and change the `update` method's WHERE to also require the audit is not released:

```ts
        return rawDb.update(schema.researchAudits).set(allowed).where(and(eq(schema.researchAudits.id, auditId), eq(schema.researchAudits.organizationId, organizationId), ne(schema.researchAudits.status, "released"))).returning({ id: schema.researchAudits.id }).then((r) => r[0] ?? null);
```

In `packages/db/src/schema.ts` replace the source check with:

```ts
  check("research_findings_source_ck", sql`${t.layer} = 'rules' or (${t.sourceUrl} is not null and length(trim(${t.sourceUrl})) > 0)`),
```

- [ ] **Step 4: Create migration 0005**

Run: `pnpm --filter @sector/db generate`. Open the new `0005_*.sql`. drizzle-kit may or may not emit the constraint change. The migration must contain exactly this and nothing else (hand-write it into the generated file, or create it with `pnpm --filter @sector/db exec drizzle-kit generate --custom --name=research_source_ck` and paste this):

```sql
ALTER TABLE "research_findings" DROP CONSTRAINT IF EXISTS "research_findings_source_ck";--> statement-breakpoint
ALTER TABLE "research_findings" ADD CONSTRAINT "research_findings_source_ck" CHECK ("research_findings"."layer" = 'rules' or ("research_findings"."source_url" is not null and length(trim("research_findings"."source_url")) > 0));
```

Confirm `meta/_journal.json` has an `idx: 5` entry and a `0005_snapshot.json` exists whose check expression matches. Stop and report if the generated file contains anything else (any `DROP TABLE`, `ALTER COLUMN`, or other tables). This is safe on production because `research_findings` was created in 0004 and has never held data.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @sector/shared test && pnpm --filter @sector/db test && pnpm --filter @sector/api test -- research`
Expected: all PASS (the API research tests prove nothing relied on updating a released audit).

- [ ] **Step 6: Commit**

```bash
git add packages
git commit -m "fix: research audit carry-overs (blank sources, no edits after release)"
```

---

### Task 2: Platform detection in the crawler

**Files:**
- Create: `services/crawler/src/platform.ts`, `services/crawler/test/platform.test.ts`
- Modify: `services/crawler/src/audit.ts` (the `AuditResult` interface and `runAudit`), `services/crawler/src/lib.ts`

**Interfaces:**
- Consumes: `runAudit`'s existing `html`, `res.headers`, and cheerio import.
- Produces:
  - `type Platform = "wordpress" | "wix" | "squarespace" | "webflow" | "shopify" | "custom" | "unknown"`
  - `detectPlatform(html: string, headers: Record<string, string | string[] | undefined>): Platform`
  - `AuditResult` gains `platform: Platform` and `htmlWords: number` (visible words in the HTML as served, scripts and styles excluded).
  - Exported from `@sector/crawler`.

- [ ] **Step 1: Write the failing tests**

Create `services/crawler/test/platform.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { detectPlatform } from "../src/platform.js";

const page = (head: string, body = "<p>Hello</p>") => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

describe("detectPlatform", () => {
  it.each([
    ["wordpress", page('<meta name="generator" content="WordPress 6.5">')],
    ["wordpress", page('<link rel="stylesheet" href="/wp-content/themes/x/style.css">')],
    ["wix", page('<script src="https://static.wixstatic.com/services/x.js"></script>')],
    ["wix", page('<meta name="generator" content="Wix.com Website Builder">')],
    ["squarespace", page('<script src="https://static1.squarespace.com/static/x.js"></script>')],
    ["webflow", '<!doctype html><html data-wf-site="abc" data-wf-page="def"><head></head><body>x</body></html>'],
    ["webflow", page('<link href="https://assets.website-files.com/x.css">')],
    ["shopify", page('<script src="https://cdn.shopify.com/s/files/x.js"></script>')],
  ])("detects %s", (expected, html) => {
    expect(detectPlatform(html, {})).toBe(expected);
  });

  it("detects Wix and Shopify from response headers alone", () => {
    expect(detectPlatform(page(""), { "x-wix-request-id": "1" })).toBe("wix");
    expect(detectPlatform(page(""), { "x-shopid": "1", "x-shopify-stage": "production" })).toBe("shopify");
  });

  it("calls an unrecognised page custom and an empty response unknown", () => {
    expect(detectPlatform(page('<title>Plain</title>'), {})).toBe("custom");
    expect(detectPlatform("", {})).toBe("unknown");
    expect(detectPlatform("   \n", {})).toBe("unknown");
  });

  it("does not confuse a page that merely mentions WordPress in its text", () => {
    expect(detectPlatform(page("", "<p>We built this with WordPress and love it.</p>"), {})).toBe("custom");
  });
});
```

Add to `services/crawler/test/audit.test.ts` (match the file's existing mock-server style; read it first) one test asserting that `runAudit` against the mock site returns `platform` as a string and `htmlWords` as a number greater than 0, and that a page whose body is only `<div id="root"></div><script>…</script>` returns `htmlWords` of 0.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @sector/crawler test -- platform`
Expected: FAIL, "Failed to load url ../src/platform.js".

- [ ] **Step 3: Implement**

Create `services/crawler/src/platform.ts`:

```ts
// Which website builder produced a page. A hint for the report and for later platform-specific fix
// copy, never a gate: "unknown" and "custom" still get a full audit.
export type Platform = "wordpress" | "wix" | "squarespace" | "webflow" | "shopify" | "custom" | "unknown";

const GENERATOR = (name: string) => new RegExp(`<meta[^>]+name=["']generator["'][^>]+content=["']${name}`, "i");

const SIGNALS: [Exclude<Platform, "custom" | "unknown">, RegExp][] = [
  ["wordpress", new RegExp(`${GENERATOR("WordPress").source}|/wp-content/|/wp-includes/`, "i")],
  ["wix", new RegExp(`static\\.wixstatic\\.com|${GENERATOR("Wix\\.com").source}`, "i")],
  ["squarespace", new RegExp(`static1\\.squarespace\\.com|squarespace-cdn\\.com|${GENERATOR("Squarespace").source}`, "i")],
  ["webflow", new RegExp(`<html[^>]+data-wf-(?:site|page)=|assets\\.website-files\\.com|uploads-ssl\\.webflow\\.com|${GENERATOR("Webflow").source}`, "i")],
  ["shopify", /cdn\.shopify\.com|Shopify\.theme/i],
];

export function detectPlatform(html: string, headers: Record<string, string | string[] | undefined>): Platform {
  if (!html.trim()) return "unknown";
  const names = Object.keys(headers).map((k) => k.toLowerCase());
  if (names.some((k) => k.startsWith("x-wix-"))) return "wix";
  if (names.some((k) => k.startsWith("x-shopify-"))) return "shopify";
  for (const [platform, re] of SIGNALS) if (re.test(html)) return platform;
  return "custom";
}
```

In `services/crawler/src/audit.ts`: add `import { detectPlatform, type Platform } from "./platform.js";`, add `platform: Platform; htmlWords: number;` to `AuditResult`, and in `runAudit` compute and return them. After `const $ = cheerio.load(html);` add:

```ts
  const visible = cheerio.load(html);
  visible("script, style, noscript").remove();
  const htmlWords = visible("body").text().split(/\s+/).filter(Boolean).length;
  const platform = detectPlatform(html, res.headers);
```

and return `{ url, score, runAt: new Date().toISOString(), checks, platform, htmlWords }`.

In `services/crawler/src/lib.ts` add `export * from "./platform.js";`.

- [ ] **Step 4: Run the tests and typecheck**

Run: `pnpm --filter @sector/crawler test && pnpm --filter @sector/crawler typecheck && pnpm --filter @sector/api typecheck && pnpm --filter @sector/api test -- audit`
Expected: all PASS. If `apps/api/src/routes/audit.ts` or a test compares the full `AuditResult` with `toEqual` and breaks, update that test to allow the two new fields; extra fields in the free-audit response are harmless.

- [ ] **Step 5: Commit**

```bash
git add services/crawler apps/api
git commit -m "feat(crawler): detect website platform and count served words"
```

---

### Task 3: Rules catalogue (pure)

**Files:**
- Create: `services/workers/src/research/rules.ts`
- Create: `services/workers/test/research-rules.test.ts`

**Interfaces:**
- Consumes: `ReportData`, `PageFacts` (`services/workers/src/report/types.ts`), `homeLighthouse` (`services/workers/src/report/analysis.ts`), `AuditResult` from `@sector/crawler` (Task 2), `Pillar` and `CheckResult` from `@sector/shared/research-score`.
- Produces:
  - `interface RuleFinding { pillar: Pillar; layer: "rules"; checkId: string; result: CheckResult; points: number; evidence: string | null; fix: string | null; effort: string | null }`
  - `interface RulesInput { report: ReportData; audit: AuditResult | null }`
  - `deriveRulesFindings(input: RulesInput): RuleFinding[]`
  - Check ids and points: SEO `seo.https` 10, `seo.titles` 15, `seo.titles_unique` 10, `seo.meta_descriptions` 15, `seo.single_h1` 10, `seo.canonical` 5, `seo.language` 5, `seo.thin_content` 10, `seo.broken_links` 10, `seo.lighthouse_seo` 10. AIO: the seven crawler checks (`aio.schema` 20, `aio.robots_txt_ai_block` 15, `aio.llms_txt` 5, `aio.heading_hierarchy` 15, `aio.faq_pairs` 20, `aio.front_loaded_stat` 15, `aio.freshness` 10; points come from the crawler's own weight when it ran) plus `aio.readable_without_js` 15. UI/UX: `uiux.viewport` 15, `uiux.lighthouse_accessibility` 20, `uiux.axe_serious` 20, `uiux.image_alt` 10, `uiux.performance` 20, `uiux.layout_shift` 10, `uiux.best_practices` 5. Brand: `brand.og_preview` 15, `brand.twitter_card` 5, `brand.social_links` 10, `brand.org_schema` 10, `brand.about_page` 10, `brand.donate_path` 15, `brand.programs_page` 10, `brand.contact_page` 5, `brand.content_depth` 10. Points need not sum to 100: the scorer divides earned by available.

- [ ] **Step 1: Write the failing tests**

Create `services/workers/test/research-rules.test.ts`:

```ts
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
  it("measures content depth by the median page, so one long page cannot hide thin ones", () => {
    const pages = [page({ words: 5000 }), page({ url: `${SITE}a`, words: 50 }), page({ url: `${SITE}b`, words: 60 })];
    expect(get(deriveRulesFindings({ report: report({ pages }), audit: audit() }), "brand.content_depth").result).toBe("fail");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @sector/workers test -- research-rules`
Expected: FAIL, "Failed to load url ../src/research/rules.js".

- [ ] **Step 3: Implement the catalogue**

Create `services/workers/src/research/rules.ts`:

```ts
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
  about: /\/(about|about-us|who-we-are|our-story)(\/|$)/,
  donate: /\/(donate|give|giving|support-us|contribute)(\/|$)/,
  programs: /\/(programs?|programmes?|our-work|projects?|what-we-do)(\/|$)/,
  contact: /\/contact(-us)?(\/|$)/,
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
  add("seo", "seo.https", 10, report.siteUrl.startsWith("https://") ? "pass" : "fail", `Your address is ${report.siteUrl}`, "Move the whole site to https. Your hosting provider can switch it on and redirect old addresses.", "About 30 minutes with your hosting provider");
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
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `pnpm --filter @sector/workers test -- research-rules && pnpm --filter @sector/workers typecheck`
Expected: all PASS. If a test's expected number differs because of an off-by-one in a threshold, fix the code to match the thresholds written in the tests (they are the spec for this task), not the other way round.

- [ ] **Step 5: Commit**

```bash
git add services/workers
git commit -m "feat(workers): research audit rules catalogue"
```

---

### Task 4: Extract data gathering from the report job

**Files:**
- Create: `services/workers/src/report/gather.ts`, `services/workers/test/gather.test.ts`
- Modify: `services/workers/src/report/run.ts` (`buildReport` only)

**Interfaces:**
- Consumes: `crawlSite`, `runLighthouse`, `checkSocial` (`report/collect.ts`), `socialProfilesFrom` (`report/analysis.ts`), `CrawlResult`, `GuardedProxy`.
- Produces:
  - `interface GatherDeps { crawlSite: typeof crawlSite; runLighthouse: typeof runLighthouse; checkSocial: typeof checkSocial }`
  - `interface Gathered { crawl: CrawlResult; lighthouse: LighthouseResult[]; social: SocialProfile[]; notes: string[] }`
  - `gatherSiteData(browser: Browser, proxy: GuardedProxy, siteUrl: string, signal: AbortSignal, log: (stage: string) => void, started: number, deps?: GatherDeps, now?: () => number): Promise<Gathered>`
  - `KEY_PAGE` regex exported from `gather.ts`.
  - **Behavior of `buildReport` must not change.**

- [ ] **Step 1: Write the failing tests**

Create `services/workers/test/gather.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @sector/workers test -- gather`
Expected: FAIL, "Failed to load url ../src/report/gather.js".

- [ ] **Step 3: Implement `gather.ts`**

Create `services/workers/src/report/gather.ts` by moving the crawl, Lighthouse and social steps out of `buildReport` unchanged in behavior:

```ts
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
```

In `services/workers/src/report/run.ts`: remove the `SECOND_LIGHTHOUSE_BEFORE_MS` and `KEY_PAGE` constants and the now-unused imports (`crawlSite`, `runLighthouse`, `checkSocial`, `socialProfilesFrom`, `LighthouseResult`); import `gatherSiteData` from `./gather.js`; and replace the body between `try {` and `const actions = buildActions(data);` in `buildReport` with:

```ts
    const { crawl, lighthouse, social, notes } = await gatherSiteData(browser, proxy, siteUrl, signal, log, started);
    const data: ReportData = {
      siteUrl, organizationName, generatedAt: new Date().toISOString(),
      pages: crawl.pages, brokenLinks: crawl.brokenLinks, unreachable: crawl.unreachable, lighthouse, axe: crawl.axe, screenshots: crawl.screenshots, social, notes,
    };
```

Keep `launchBrowser`, `renderPdf` imports; keep everything after `buildActions` as it was.

- [ ] **Step 4: Run the tests, typecheck and lint the touched files**

Run: `pnpm --filter @sector/workers test && pnpm --filter @sector/workers typecheck`
Expected: PASS (all existing worker tests plus the 5 new ones), typecheck clean.

- [ ] **Step 5: Prove the full report still works**

This refactor touches the paid product, and no automated test exercises `buildReport`. Run one real report from a foreground shell against a public site: `source ~/.local/sector-deps/dev.env.sh`, then from `services/workers` run `npx tsx -e "import('./src/report/run.ts').then(async (m) => { const c = new AbortController(); const r = await m.buildReport('https://www.balavikasa.org/', 'Check', c.signal, console.log); console.log(r.data.pages.length, 'pages', r.data.lighthouse.length, 'speed tests', r.pdf.length, 'pdf bytes'); process.exit(0); })"`. Expected: log lines `crawl`, `lighthouse …`, `social`, `pdf`, then a page count above 0, at least 1 speed test, and a PDF over 10000 bytes. If Chromium cannot launch from a detached shell on Windows (a known local limitation), say so in the report and mark this step NOT VERIFIED rather than skipping silently.

- [ ] **Step 6: Commit**

```bash
git add services/workers
git commit -m "refactor(workers): share site data gathering between report and research audit"
```

---

### Task 5: Analyze and run the research audit job

**Files:**
- Create: `services/workers/src/research/analyze.ts`, `services/workers/src/research/collect.ts`, `services/workers/src/research/run.ts`
- Create: `services/workers/vitest.config.ts`, `services/workers/test/global-setup.ts`
- Create: `services/workers/test/research-analyze.test.ts`, `services/workers/test/research-run.test.ts`

**Interfaces:**
- Consumes: Task 3 `deriveRulesFindings`, `RuleFinding`, `RulesInput`; Task 4 `gatherSiteData`; Task 2 `runAudit`/`AuditResult`/`Platform`; Plan 1 `scoreResearchAudit`, `DEFAULT_WEIGHTS`, `PILLARS`; `scopedDb(...).researchAudits.{findById,update,addFindings}`; `startGuardedProxy`, `launchBrowser`, `coverage` from `report/analysis.ts`.
- Produces:
  - `RESEARCH_SCORE_MODEL = "research-2026-10.1"`
  - `analyzeResearch(input: RulesInput): { findings: RuleFinding[]; score: ResearchScore; summary: Record<string, unknown> }`
  - `collectResearchData(siteUrl: string, signal: AbortSignal, log: (stage: string) => void): Promise<ReportData>`
  - `interface ResearchDeps { collect: typeof collectResearchData; runAudit: typeof runAudit }`
  - `runResearchAuditJob(job: { auditId: string; organizationId: string }, deps?: ResearchDeps): Promise<void>`. Never throws; failures are stored on the audit.

- [ ] **Step 1: Write the failing analyze tests**

Create `services/workers/test/research-analyze.test.ts`:

```ts
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
```

- [ ] **Step 2: Write the failing job tests**

Create `services/workers/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { testDbUrl } from "../../packages/db/src/test-db.js";
export default defineConfig({
  test: {
    env: { DATABASE_URL: testDbUrl("sector_test_workers"), CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64") },
    globalSetup: ["./test/global-setup.ts"],
    fileParallelism: false,
  },
});
```

Create `services/workers/test/global-setup.ts`:

```ts
import { ensureTestDb } from "../../../packages/db/src/test-db.js";
export default async function setup() { await ensureTestDb("sector_test_workers"); }
```

Create `services/workers/test/research-run.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { AuditResult } from "@sector/crawler";
import { pool, rawDb, schema, scopedDb } from "@sector/db";
import { runResearchAuditJob, type ResearchDeps } from "../src/research/run.js";
import type { ReportData } from "../src/report/types.js";

const org = crypto.randomUUID();
const SITE = "https://ngo.example.org/";
const home = { url: SITE, status: 200, title: "Asha", metaDescription: "d", canonical: SITE, lang: "en", hasViewport: true, h1: 1, h2: 1, jsonLdTypes: ["NGO"], images: 1, imagesMissingAlt: 0, words: 600, internalLinks: [`${SITE}about`, `${SITE}donate`, `${SITE}programs`, `${SITE}contact`], socialLinks: [], og: { title: "a", image: "b" }, twitterCard: "summary" };
const data = (over: Partial<ReportData> = {}): ReportData => ({
  siteUrl: SITE, organizationName: "", generatedAt: "2026-10-13T00:00:00.000Z", pages: [home], brokenLinks: [], unreachable: [],
  lighthouse: [{ url: SITE, scores: { performance: 90, seo: 95, accessibility: 92, bestPractices: 100 }, metrics: { lcpMs: 1800, cls: 0.02 }, failed: [] }],
  axe: [], screenshots: {}, social: [{ platform: "Facebook", url: "https://facebook.com/asha", state: "ok" }], notes: [], ...over,
});
const audit: AuditResult = { url: SITE, score: 80, runAt: "x", platform: "squarespace", htmlWords: 500, checks: [{ checkId: "schema", weight: 20, passed: true, detail: "ok" }] };
const deps = (over: Partial<ResearchDeps> = {}): ResearchDeps => ({ collect: vi.fn(async () => data()), runAudit: vi.fn(async () => audit), ...over });
const make = () => scopedDb(org).researchAudits.create({ siteUrl: SITE, createdBy: "u" }).then((a) => a.id);
const row = (id: string) => scopedDb(org).researchAudits.findById(id);

beforeAll(async () => { await rawDb.insert(schema.organizations).values({ id: org, name: "Job Org" }); });
afterAll(async () => { await pool.query("TRUNCATE organizations CASCADE"); await pool.end(); });

describe("runResearchAuditJob", () => {
  it("stores findings and scores and leaves the audit in review, never released", async () => {
    const id = await make();
    await runResearchAuditJob({ auditId: id, organizationId: org }, deps());
    const a = (await row(id))!;
    expect(a.status).toBe("in_review");
    expect(a.releasedAt).toBeNull();
    expect(a.platform).toBe("squarespace");
    expect(a.overallScore).toBe(100);
    expect(a.seoScore).toBe(100);
    expect(a.layerWeights).toEqual({ rules: 50, reference: 30, peer: 20 });
    expect(a.pillarWeights).toEqual({ seo: 25, aio: 25, uiux: 25, brand: 25 });
    expect((a.summary as { layersUsed: string[] }).layersUsed).toEqual(["rules"]);
    const found = await scopedDb(org).researchAudits.findings(id);
    expect(found.length).toBeGreaterThan(20);
    expect(found.every((f) => f.layer === "rules" && f.organizationId === org)).toBe(true);
  });

  it("does nothing when the audit is not queued, so a repeated delivery writes nothing twice", async () => {
    const id = await make();
    const d = deps();
    await runResearchAuditJob({ auditId: id, organizationId: org }, d);
    const before = (await scopedDb(org).researchAudits.findings(id)).length;
    await runResearchAuditJob({ auditId: id, organizationId: org }, d);
    expect(d.collect).toHaveBeenCalledTimes(1);
    expect((await scopedDb(org).researchAudits.findings(id)).length).toBe(before);
    await runResearchAuditJob({ auditId: crypto.randomUUID(), organizationId: org }, d); // unknown id
    expect(d.collect).toHaveBeenCalledTimes(1);
  });

  it("will not touch another organization's audit", async () => {
    const other = crypto.randomUUID();
    await rawDb.insert(schema.organizations).values({ id: other, name: "Other" });
    const id = await make();
    const d = deps();
    await runResearchAuditJob({ auditId: id, organizationId: other }, d);
    expect(d.collect).not.toHaveBeenCalled();
    expect((await row(id))!.status).toBe("queued");
  });

  it("marks the audit failed with a plain message and stores no findings when collection fails", async () => {
    const id = await make();
    await runResearchAuditJob({ auditId: id, organizationId: org }, deps({ collect: vi.fn(async () => { throw new Error("Your homepage answered with error 500."); }) }));
    const a = (await row(id))!;
    expect(a.status).toBe("failed");
    expect(a.error).toMatch(/homepage/i);
    expect(a.overallScore).toBeNull();
    expect(await scopedDb(org).researchAudits.findings(id)).toEqual([]);
  });

  it("still completes with platform unknown when only the plain-HTTP check failed", async () => {
    const id = await make();
    await runResearchAuditJob({ auditId: id, organizationId: org }, deps({ runAudit: vi.fn(async () => { throw new Error("blocked"); }) }));
    const a = (await row(id))!;
    expect(a.status).toBe("in_review");
    expect(a.platform).toBe("unknown");
    expect(a.aioScore).toBeNull(); // every AI-readiness check was could_not_check
    expect(a.seoScore).toBe(100);
  });

  it("stores empty scores, not zeros, when no page could be read", async () => {
    const id = await make();
    await runResearchAuditJob({ auditId: id, organizationId: org }, deps({ collect: vi.fn(async () => data({ pages: [] })) }));
    const a = (await row(id))!;
    expect(a.status).toBe("in_review");
    expect(a.overallScore).toBeNull();
    expect(a.seoScore).toBeNull();
  });

  it("fails the audit instead of hanging when it exceeds its time limit", async () => {
    const id = await make();
    const never = vi.fn((_u: string, signal: AbortSignal) => new Promise<ReportData>((_r, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })));
    await runResearchAuditJob({ auditId: id, organizationId: org }, deps({ collect: never as never }), 50);
    const a = (await row(id))!;
    expect(a.status).toBe("failed");
    expect(a.error).toMatch(/too long/i);
    expect(a.status).not.toBe("released");
  });
});
```

(The third parameter of `runResearchAuditJob` is a timeout in milliseconds, default 10 minutes, so the timeout test runs in 50 ms.)

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @sector/workers test -- research-analyze research-run`
Expected: FAIL, "Failed to load url ../src/research/analyze.js".

- [ ] **Step 4: Implement `analyze.ts`**

Create `services/workers/src/research/analyze.ts`:

```ts
import { DEFAULT_WEIGHTS, scoreResearchAudit, type ResearchScore } from "@sector/shared/research-score";
import { coverage } from "../report/analysis.js";
import { deriveRulesFindings, type RuleFinding, type RulesInput } from "./rules.js";

/** Bump when checks, points or weights change, so a stored score can always be explained. */
export const RESEARCH_SCORE_MODEL = "research-2026-10.1";

export function analyzeResearch(input: RulesInput): { findings: RuleFinding[]; score: ResearchScore; summary: Record<string, unknown> } {
  const findings = deriveRulesFindings(input);
  const score = scoreResearchAudit(findings, DEFAULT_WEIGHTS);
  const failed = findings.filter((f) => f.result === "fail").sort((a, b) => b.points - a.points);
  const summary = {
    scoreModel: RESEARCH_SCORE_MODEL,
    layersUsed: ["rules"],
    benchmarkNote: "Comparisons with proven organizations and live peers are not included in this score yet.",
    couldNotCheck: findings.filter((f) => f.result === "could_not_check").length,
    failed: failed.length,
    topFixes: failed.slice(0, 5).map((f) => ({ checkId: f.checkId, pillar: f.pillar, points: f.points, fix: f.fix })),
    coverage: coverage(input.report),
    notes: input.report.notes,
  };
  return { findings, score, summary };
}
```

- [ ] **Step 5: Implement `collect.ts`**

Create `services/workers/src/research/collect.ts`:

```ts
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
```

- [ ] **Step 6: Implement `run.ts`**

Create `services/workers/src/research/run.ts`:

```ts
import { runAudit } from "@sector/crawler";
import { DEFAULT_WEIGHTS } from "@sector/shared/research-score";
import { scopedDb } from "@sector/db";
import { analyzeResearch } from "./analyze.js";
import { collectResearchData } from "./collect.js";

// One research audit, start to finish (specs/2026-10-13-research-audit-design.md). Runs on the "report"
// queue (concurrency 1, ADR-0007). Never throws: failures are stored on the audit. The audit ends
// in_review; only apps/api/src/lib/research-release.ts can release it.

const RESEARCH_TIMEOUT_MS = 10 * 60_000;

export interface ResearchDeps { collect: typeof collectResearchData; runAudit: typeof runAudit }
const realDeps: ResearchDeps = { collect: collectResearchData, runAudit };

export async function runResearchAuditJob(job: { auditId: string; organizationId: string }, deps: ResearchDeps = realDeps, timeoutMs = RESEARCH_TIMEOUT_MS): Promise<void> {
  const db = scopedDb(job.organizationId).researchAudits;
  const audit = await db.findById(job.auditId);
  if (!audit || audit.status !== "queued") return; // a redelivered job, or an audit that already ran
  await db.update(audit.id, { status: "running" });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  const log = (stage: string) => console.log(`research ${audit.id}: ${stage} (${Math.round((Date.now() - started) / 1000)}s)`);
  // Stop waiting at the deadline even if some step ignores the abort signal.
  const deadline = new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(new Error("timeout")), { once: true }));
  try {
    const report = await Promise.race([deps.collect(audit.siteUrl, controller.signal, log), deadline]);
    // The plain-HTTP AI-readiness audit; if it fails the browser data still stands and those checks become could_not_check.
    const plain = await Promise.race([deps.runAudit(audit.siteUrl, { signal: controller.signal }).catch(() => null), deadline]);
    if (controller.signal.aborted) throw new Error("timeout");
    const { findings, score, summary } = analyzeResearch({ report, audit: plain });
    // One insert after analysis succeeded, so a failed audit never keeps half its findings.
    await db.addFindings(audit.id, findings.map((f) => ({ pillar: f.pillar, layer: f.layer, checkId: f.checkId, result: f.result, evidence: f.evidence, fix: f.fix, effort: f.effort, points: f.points })));
    await db.update(audit.id, {
      status: "in_review", platform: plain?.platform ?? "unknown",
      seoScore: score.pillars.seo.score, aioScore: score.pillars.aio.score, uiuxScore: score.pillars.uiux.score, brandScore: score.pillars.brand.score, overallScore: score.overall,
      layerWeights: DEFAULT_WEIGHTS.layers, pillarWeights: DEFAULT_WEIGHTS.pillars, summary,
    });
    log("in review");
  } catch (err) {
    const msg = controller.signal.aborted
      ? "Your site took too long to check. Try again later, or contact SEctOr if it keeps happening."
      : err instanceof Error && /homepage/i.test(err.message) ? err.message
      : "We could not finish this audit. Check your website is online, then try again.";
    console.error(`research ${job.auditId} failed:`, err instanceof Error ? err.message : err);
    await db.update(audit.id, { status: "failed", error: msg });
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 7: Run the tests and typecheck**

Run: `pnpm --filter @sector/workers test && pnpm --filter @sector/workers typecheck`
Expected: all worker tests PASS, including the 4 analyze tests and 7 job tests. Postgres must be running. If the timeout test is flaky because `deadline` rejects before `collect`'s own abort handler, keep the `Promise.race` and fix the test's helper rather than loosening the assertion.

- [ ] **Step 8: Commit**

```bash
git add services/workers
git commit -m "feat(workers): research audit job, analysis and test database"
```

---

### Task 6: Queue wiring behind a feature flag

**Files:**
- Modify: `services/workers/src/index.ts`
- Create: `apps/api/src/lib/research-queue.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/test/research-flag.test.ts`
- Modify: `.env.example`, `docker-compose.yml`

**Interfaces:**
- Consumes: `ResearchQueue` (Plan 1, `apps/api/src/routes/research-audits.ts`), `runResearchAuditJob` (Task 5), the existing `report` queue and `runReportJob`.
- Produces: `bullResearchQueue(): ResearchQueue` (adds job name `research-audit` to the `report` queue with `jobId` `research-<auditId>`, `attempts: 1`); `RESEARCH_AUDIT_ENABLED` environment variable.

- [ ] **Step 1: Write the failing test**

Create `apps/api/test/research-flag.test.ts`:

```ts
import { describe, it, expect, afterEach, afterAll, vi } from "vitest";
import { pool } from "@sector/db";
import { buildApp } from "../src/app.js";

// The create route must not exist in production until the owner switches research audits on.
afterEach(() => { vi.unstubAllEnvs(); });

async function postStatus(): Promise<number> {
  const app = await buildApp({ reportQueue: { add: async () => {} } });
  try { await app.ready(); return (await app.inject({ method: "POST", url: "/research-audits" })).statusCode; }
  finally { await app.close(); }
}

describe("RESEARCH_AUDIT_ENABLED", () => {
  it("leaves POST /research-audits unregistered when the flag is off or missing", async () => {
    vi.stubEnv("RESEARCH_AUDIT_ENABLED", "");
    expect(await postStatus()).toBe(404);
    vi.stubEnv("RESEARCH_AUDIT_ENABLED", "false");
    expect(await postStatus()).toBe(404);
  });

  it("registers the route when the flag is exactly true (an unauthenticated call is then refused with 401)", async () => {
    vi.stubEnv("RESEARCH_AUDIT_ENABLED", "true");
    expect(await postStatus()).toBe(401);
  });

  it("keeps the read routes available either way", async () => {
    vi.stubEnv("RESEARCH_AUDIT_ENABLED", "false");
    const app = await buildApp({ reportQueue: { add: async () => {} } });
    await app.ready();
    expect((await app.inject({ method: "GET", url: "/research-audits" })).statusCode).toBe(401);
    await app.close();
  });
});

afterAll(async () => { await pool.end(); });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @sector/api test -- research-flag`
Expected: FAIL on the "flag is exactly true" case (the route is not registered, so 404 instead of 401).

- [ ] **Step 3: Implement the producer and the wiring**

Create `apps/api/src/lib/research-queue.ts`:

```ts
import { Queue } from "bullmq";
import type { ResearchQueue } from "../routes/research-audits.js";

// Producer for research audits. They share the "report" queue (concurrency 1) with full reports, so
// only one Chromium job ever runs on the shared host (ADR-0007). Lazy: no Redis until the first audit.
let queue: Queue | undefined;
export function bullResearchQueue(): ResearchQueue {
  return {
    async add(job) {
      queue ??= new Queue("report", { connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379", maxRetriesPerRequest: null } });
      await queue.add("research-audit", job, { jobId: `research-${job.auditId}`, removeOnComplete: 100, removeOnFail: 100, attempts: 1 });
    },
  };
}
```

In `apps/api/src/app.ts` import it beside the report queue import and change the Plan 1 registration line to:

```ts
  // Research audits stay off in production until RESEARCH_AUDIT_ENABLED=true (docs/runbooks/research-audit.md).
  await registerResearchAuditRoutes(app, opts.researchQueue ?? (process.env.RESEARCH_AUDIT_ENABLED === "true" ? bullResearchQueue() : undefined));
```

In `services/workers/src/index.ts` import `runResearchAuditJob` and replace the `reportWorker` definition and the startup log with a dispatcher by job name:

```ts
// Full reports and research audits (ADR-0007): Chromium-heavy, so strictly one at a time with a long lock.
const reportWorker = new Worker("report", async (job: Job<{ reportId?: string; auditId?: string; organizationId: string }>) => {
  if (job.name === "research-audit") return runResearchAuditJob({ auditId: job.data.auditId!, organizationId: job.data.organizationId });
  return runReportJob({ reportId: job.data.reportId!, organizationId: job.data.organizationId });
}, { connection, concurrency: 1, lockDuration: 10 * 60_000 });
```

and update the final `console.log` text from `report (1 at a time)` to `report (full reports and research audits, 1 at a time)`.

In `.env.example`, near `WORKER_CONCURRENCY`, add:

```
# Research audits (docs/runbooks/research-audit.md). Leave false until you are ready to run and review them.
RESEARCH_AUDIT_ENABLED=false
```

In `docker-compose.yml`, find how the `api` service receives its environment variables (the `environment:` block that contains `TRUST_PROXY`) and add `RESEARCH_AUDIT_ENABLED: ${RESEARCH_AUDIT_ENABLED:-false}` in the same style.

- [ ] **Step 4: Run the tests and checks**

Run: `pnpm --filter @sector/api test && pnpm --filter @sector/api typecheck && pnpm --filter @sector/workers typecheck && pnpm --filter @sector/workers test`
Expected: all PASS. Also run `docker compose config -q` from the repo root if Docker is available, to confirm the compose file still parses.

- [ ] **Step 5: Commit**

```bash
git add apps/api services/workers .env.example docker-compose.yml
git commit -m "feat: queue research audits behind RESEARCH_AUDIT_ENABLED"
```

---

### Task 7: `research-show` CLI, runbook, and a real end-to-end run

**Files:**
- Create: `apps/api/src/lib/research-show.ts`, `apps/api/src/scripts/research-show.ts`, `apps/api/test/research-show.test.ts`
- Modify: `apps/api/package.json` (scripts)
- Create: `docs/runbooks/research-audit.md`

**Interfaces:**
- Consumes: `rawDb`, `schema` from `@sector/db` (ops script, like `research-release`).
- Produces: `formatAudit(audit: AuditRow, findings: FindingRow[], orgName: string): string` where `AuditRow = typeof schema.researchAudits.$inferSelect` and `FindingRow = typeof schema.researchFindings.$inferSelect`; CLI `npm run research-show -- <auditId>`.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/test/research-show.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { schema } from "@sector/db";
import { formatAudit } from "../src/lib/research-show.js";

type A = typeof schema.researchAudits.$inferSelect;
type F = typeof schema.researchFindings.$inferSelect;
const audit = (over: Partial<A> = {}): A => ({
  id: "a1", organizationId: "o1", siteUrl: "https://ngo.example.org/", platform: "wix", status: "in_review", error: null,
  seoScore: 80, aioScore: null, uiuxScore: 60, brandScore: 50, overallScore: 63, layerWeights: { rules: 50, reference: 30, peer: 20 }, pillarWeights: null,
  summary: { benchmarkNote: "Benchmarks are not included yet.", couldNotCheck: 2 }, createdBy: "u", createdAt: new Date("2026-10-13T10:00:00Z"), releasedAt: null, ...over,
});
const finding = (over: Partial<F> = {}): F => ({
  id: "f1", auditId: "a1", organizationId: "o1", pillar: "seo", layer: "rules", checkId: "seo.titles", result: "fail", evidence: "No title on: https://ngo.example.org/x",
  sourceId: null, sourceUrl: null, sourceName: null, fix: "Give every page a title.", effort: "5 minutes", points: 15, ...over,
});

describe("formatAudit", () => {
  const text = formatAudit(audit(), [
    finding(),
    finding({ id: "f2", checkId: "seo.https", result: "pass", evidence: null, fix: null, points: 10 }),
    finding({ id: "f3", pillar: "aio", checkId: "aio.schema", result: "could_not_check", evidence: "The check could not read your homepage.", fix: null, points: 20 }),
  ], "Asha Foundation");

  it("shows who, what, status, platform and every pillar score, with no score shown as a dash", () => {
    expect(text).toContain("Asha Foundation");
    expect(text).toContain("https://ngo.example.org/");
    expect(text).toContain("in_review");
    expect(text).toContain("wix");
    expect(text).toMatch(/overall\s+63/i);
    expect(text).toMatch(/aio\s+-/i);
    expect(text).not.toMatch(/aio\s+0\b/i);
  });

  it("marks failed, passed and could-not-check findings differently and shows evidence and fix for failures", () => {
    expect(text).toContain("FAIL seo.titles (15)");
    expect(text).toContain("No title on: https://ngo.example.org/x");
    expect(text).toContain("Give every page a title.");
    expect(text).toContain("pass seo.https (10)");
    expect(text).toContain("?    aio.schema (20)");
  });

  it("states the benchmark note and the release command", () => {
    expect(text).toContain("Benchmarks are not included yet.");
    expect(text).toContain("npm run research-release -- a1");
  });

  it("says plainly when the audit is already released or failed", () => {
    expect(formatAudit(audit({ status: "released", releasedAt: new Date("2026-10-14T00:00:00Z") }), [], "X")).toMatch(/released/i);
    expect(formatAudit(audit({ status: "failed", error: "Your site took too long to check." }), [], "X")).toContain("Your site took too long to check.");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @sector/api test -- research-show`
Expected: FAIL, "Failed to load url ../src/lib/research-show.js".

- [ ] **Step 3: Implement the formatter and the CLI**

Create `apps/api/src/lib/research-show.ts`:

```ts
import type { schema } from "@sector/db";

type AuditRow = typeof schema.researchAudits.$inferSelect;
type FindingRow = typeof schema.researchFindings.$inferSelect;

const score = (n: number | null) => (n === null ? "-" : String(n));
const ORDER = ["seo", "aio", "uiux", "brand"] as const;

/** A plain-text view of one audit for the owner to read before releasing it. Read-only. */
export function formatAudit(audit: AuditRow, findings: FindingRow[], orgName: string): string {
  const s = (audit.summary ?? {}) as { benchmarkNote?: string; couldNotCheck?: number };
  const lines = [
    `${orgName}  ${audit.siteUrl}`,
    `audit ${audit.id}  status ${audit.status}  platform ${audit.platform ?? "-"}  created ${audit.createdAt.toISOString()}`,
    audit.status === "failed" && audit.error ? `FAILED: ${audit.error}` : "",
    audit.releasedAt ? `Released ${audit.releasedAt.toISOString()}` : "",
    "",
    "SCORES (0-100, - means not enough data)",
    ...ORDER.map((p) => `  ${p.padEnd(7)}${score(audit[`${p}Score` as "seoScore" | "aioScore" | "uiuxScore" | "brandScore"])}`),
    `  overall${" "}${score(audit.overallScore)}`,
    s.benchmarkNote ? `\n${s.benchmarkNote}` : "",
    s.couldNotCheck ? `${s.couldNotCheck} checks could not run and are not counted.` : "",
  ];
  for (const pillar of ORDER) {
    const rows = findings.filter((f) => f.pillar === pillar).sort((a, b) => Number(b.result === "fail") - Number(a.result === "fail") || b.points - a.points);
    if (!rows.length) continue;
    lines.push("", pillar.toUpperCase());
    for (const f of rows) {
      const mark = f.result === "fail" ? "FAIL" : f.result === "pass" ? "pass" : "?   ";
      lines.push(`  ${mark} ${f.checkId} (${f.points})`);
      if (f.result !== "pass" && f.evidence) lines.push(`       ${f.evidence}`);
      if (f.result === "fail" && f.fix) lines.push(`       Fix: ${f.fix}${f.effort ? ` (${f.effort})` : ""}`);
    }
  }
  if (audit.status === "in_review") lines.push("", `To show this audit to the organization: npm run research-release -- ${audit.id}`);
  return lines.filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
}
```

Create `apps/api/src/scripts/research-show.ts`:

```ts
import "../env.js";
import { eq } from "drizzle-orm";
import { rawDb, pool, schema } from "@sector/db";
import { formatAudit } from "../lib/research-show.js";

// INTERNAL OPS ONLY, read-only. Prints one research audit so the owner can review it before releasing.
//   npm run research-show -- <auditId>
const [arg] = process.argv.slice(2);
if (!arg || arg.startsWith("-")) {
  console.error("usage: research-show <auditId>");
  process.exitCode = 1;
} else {
  const [audit] = await rawDb.select().from(schema.researchAudits).where(eq(schema.researchAudits.id, arg));
  if (!audit) { console.error(`No audit ${arg}.`); process.exitCode = 1; }
  else {
    const [org] = await rawDb.select({ name: schema.organizations.name }).from(schema.organizations).where(eq(schema.organizations.id, audit.organizationId));
    const findings = await rawDb.select().from(schema.researchFindings).where(eq(schema.researchFindings.auditId, audit.id));
    console.log(formatAudit(audit, findings, org?.name ?? "(unknown organization)"));
  }
}
await pool.end();
```

Add to `apps/api/package.json` scripts, after `research-release`: `"research-show": "tsx src/scripts/research-show.ts"`.

- [ ] **Step 4: Run the tests and checks**

Run: `pnpm --filter @sector/api test -- research-show && pnpm --filter @sector/api typecheck`
Expected: PASS. If the `aio  -` / `aio  0` assertions fail because of column padding, fix the formatter to put the score after the padded pillar name, never change the test to accept `0`.

- [ ] **Step 5: Write the runbook**

Create `docs/runbooks/research-audit.md` with these sections, in plain language, using exactly these commands (run on the server inside `/opt/sector` with the `dc` alias used elsewhere in the runbooks):
1. **What it is and what it is not:** the rules layer only; no reference or peer benchmarks yet; nothing is shown to the NGO until released; no review screen yet.
2. **Turn it on:** set `RESEARCH_AUDIT_ENABLED=true` in `/opt/sector/.env` (never print the file), then `dc up -d --no-deps api`. The worker needs no flag but must be running the new image: `dc build worker api` first, then `dc up -d worker api`. Migration 0005 must be applied: `dc exec api npm run migrate`.
3. **Make an organization eligible:** `dc exec api npm run set-plan -- <orgId> pilot`, and the organization must have verified its website.
4. **Review:** `dc exec api npm run research-show -- <auditId>`; list audits waiting with `dc exec api npm run research-release -- --list`.
5. **Release:** `dc exec api npm run research-release -- <auditId>`.
6. **Turn it off:** set the flag to `false` and `dc up -d --no-deps api`. Audits already created stay in the database; queued jobs still run.
7. **Resource note:** one audit takes several minutes of Chromium on the shared 2 vCPU / 7.8 GB host and queues behind any full report; the worker container is capped at 1.5 GB.
8. **Not included yet:** platform-specific fix steps, benchmark comparison, AI-written summary, a review and edit screen (Plans 3-6).

- [ ] **Step 6: Commit**

```bash
git add apps/api docs
git commit -m "feat(api): research-show review CLI and runbook"
```

- [ ] **Step 7: Run one real audit end to end on the local stack**

This is the only step that proves the whole chain works. Run it in foreground shells (a detached worker cannot launch Chromium on this Windows PC):

1. `bash ~/.local/sector-deps/start-sector.sh` is not needed in full. Start Postgres and Redis as in that script, then in the repo root: `source ~/.local/sector-deps/dev.env.sh && export RESEARCH_AUDIT_ENABLED=true && pnpm db:migrate`.
2. Terminal A (worker, foreground): `source ~/.local/sector-deps/dev.env.sh && pnpm --filter @sector/workers dev`.
3. Terminal B (api): `source ~/.local/sector-deps/dev.env.sh && export RESEARCH_AUDIT_ENABLED=true && pnpm --filter @sector/api dev`.
4. Sign up a test organization through the local web app (or `seed:demo`), set its profile website to `https://www.balavikasa.org/` (a public site: the SSRF guard refuses localhost), run `npm run set-plan -- <orgId> pilot` from `apps/api`, and mark the website verified with the local database only (`UPDATE site_verifications SET verified_at = now(), method = 'meta' WHERE organization_id = '<orgId>'`; the row exists after the app's verification page is opened once).
5. As that user, `POST /research-audits` (the web session cookie), note the returned `id`, and watch Terminal A until it logs `research <id>: in review`.
6. Run `cd apps/api && npm run research-show -- <id>` and read it: scores present, failed checks with evidence and fixes, `?` marks only where a check truly could not run.
7. Confirm the organization cannot see it yet: `GET /research-audits/<id>` shows status `in_review` and null scores. Then `npm run research-release -- <id>` and confirm the same GET now shows scores and findings.

Paste the `research-show` output (without secrets) and the two GET results into the PR description as the verification evidence. If Chromium or Lighthouse cannot run on this PC, say so and mark the end-to-end step NOT VERIFIED; do not claim it passed.

- [ ] **Step 8: Run the whole repo's checks, push and open the PR**

Run (repo root): `pnpm test && pnpm typecheck`
Expected: all green (lint is known to fail repo-wide for an unrelated, existing reason).

```bash
git push -u origin feat/research-audit-rules
gh pr create --base main --title "feat: research audit rules layer and worker (behind a flag)"
```

PR body: summarise Tasks 1-7; state production stays off until `RESEARCH_AUDIT_ENABLED=true`; state migration 0005 only swaps a CHECK constraint on a table that has never held data; list what was and was not verified, including the end-to-end result from Step 7.

---

## Self-review (completed while writing)

**Spec coverage.** Rules layer for all four pillars: Task 3. Platform detection and the JavaScript-site handling: Tasks 2-3, with the deviation recorded above. Playwright, Lighthouse and axe for UI/UX, reusing the full-report pipeline and ADR-0007 limits: Tasks 4-5. Worker job that leaves audits `in_review`: Task 5. Real queue: Task 6. Owner can read an audit before releasing: Task 7. Not covered here, by design: reference library (Plan 3), peers (Plan 4), LLM summaries, brand-direction text and platform-specific fix copy (Plan 5), review and edit screen, organization tab, PDF and upgrade prompt (Plan 6). `review_edits` stays unused until Plan 6.

**Placeholders.** None. Task 1 Step 4 gives the migration SQL in full because drizzle-kit may not emit check-constraint changes; Task 2 Step 1 asks the implementer to extend an existing test file whose style must be read first, and states the exact assertions.

**Type consistency.** `RuleFinding` (Task 3) is what Task 5 maps into `addFindings` rows and what Plan 1's `ScoreFinding` accepts structurally (`sourceUrl` absent, treated as `undefined`). `AuditResult.platform` and `htmlWords` (Task 2) are used by Tasks 3 and 5. `ResearchDeps.collect` has the signature of `collectResearchData` (Task 5) and the test's `never` mock matches `(siteUrl, signal)`. The job payload `{ auditId, organizationId }` matches Plan 1's `ResearchQueue`. Check ids are `<pillar>.<name>` everywhere; the crawler's own ids are prefixed `aio.` in Task 3 only.

**Known simplifications.** Point values are first-version judgments and are versioned by `RESEARCH_SCORE_MODEL`; changing any of them means bumping it. The key-page checks look at URL paths only, so a page called `/who-we-are-and-why` passes `brand.about_page` while an About page at an unusual path is missed; the failure text says "was found", not "does not exist".
