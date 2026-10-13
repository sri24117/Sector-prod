# Research audit: four-pillar scored audit with benchmarks

Date: 2026-10-13 · Status: design approved in conversation, written spec awaiting review

## Intent

After the free taster audit, a paid or pilot organization (NGO, CSR team, foundation, social enterprise) can request a **research audit** of its own website. It is scored in four pillars (**SEO**, **AIO/GEO**, **UI/UX**, **Content and brand direction**) and combined into one overall score and a prioritized fix plan. Scores are measured against published standards, a curated library of proven organizations, and live peers in the same cause and region. The platform owner reviews and can edit every result before the organization sees it, then helps fix what the audit finds.

The scoring is mostly automated (rules in code, AI for subjective parts). The owner is the reviewer, not the scorer.

## Access rules

Same as the full report (2026-10-04-full-report-design.md):

- `organizations.plan` must be `pilot` or `paid`, checked on the API, not only in the UI.
- The organization's own website must be **verified** (`site_verifications.verified_at`).
- Only the profile `websiteUrl` can be audited.
- The free audit ends with an upgrade prompt for `free` plans.
- A research audit is hidden from the organization until `released_at` is set.

## Scoring model

Each pillar score (0-100) combines three layers:

| Layer | Source | Default share |
|---|---|---|
| **rules** | Published standards encoded as checks: Google guidance, schema.org, WCAG, Core Web Vitals, AI-crawler access | 50% |
| **reference** | Curated `reference_sources` library of proven NGOs, foundations and CSR programmes | 30% |
| **peer** | 3-5 live peers in the organization's cause and region, researched per audit | 20% |

Overall score = weighted mean of the four pillars, default 25% each. Layer shares and pillar weights are configuration, and the values used are snapshotted on every audit (`layer_weights`) so old scores stay explainable.

Honesty rules (as in ADR/PR #15):

1. A check that could not run is `could_not_check`, is excluded from the score, and is shown to the organization as such.
2. A `reference` or `peer` finding **must** cite a `source_id`. A finding without one is dropped by the validator.
3. Evidence must be text or a URL that exists in content fetched from the audited site or the cited source. The AI never invents a benchmark.
4. If a layer has no usable data (for example an empty reference library), its weight is redistributed proportionally to the remaining layers and the report says so.

## Pillars

Each pillar is a skill file in `skills/` with its own rubric and score anchors (0 = absent, 50 = basic, 100 = comparable to the reference set), plus rule checks in code.

- **SEO**: indexability, titles and descriptions, headings, internal links, sitemap and robots, canonicalization, structured data, page speed, mobile.
- **AIO/GEO**: AI-crawler access, answer-ready content structure, entity and organization schema, citations and factual clarity, FAQ coverage, how the organization appears in AI answers.
- **UI/UX**: accessibility (WCAG), mobile layout, contrast, navigation clarity, donation or contact path, performance.
- **Content and brand**: clarity of mission and impact, proof (numbers, stories, reports), tone consistency, calls to action, visual brand consistency, and a brand-direction summary.

A **synthesis** step combines the four into the overall score, the brand-direction summary and a prioritized plan ranked by points gained against effort.

## Data model (migration 0004)

- `research_audits`: `id`, `org_id`, `site_url`, `platform`, `status` (`queued | running | in_review | released | failed`), `seo_score`, `aio_score`, `uiux_score`, `brand_score`, `overall_score`, `layer_weights` (jsonb), `pillar_weights` (jsonb), `summary` (jsonb), `created_at`, `released_at`.
- `research_findings`: `id`, `audit_id`, `pillar`, `layer` (`rules | reference | peer`), `check_id`, `result` (`pass | fail | could_not_check`), `evidence`, `source_id` (nullable, required for reference and peer), `fix`, `effort`, `points`.
- `reference_sources`: `id`, `name`, `org_type` (`ngo | foundation | csr`), `cause`, `region`, `url`, `retrieved_on`, `strengths` (jsonb, per pillar). Written only by the owner through an import script; the AI reads it and never writes it.
- `review_edits`: `id`, `audit_id`, `target` (finding or score), `old_value`, `new_value`, `note`, `created_at`. The original AI output is never overwritten.

## Review and release

`/admin/research/[id]`, limited to the owner account:

- Shows the four pillar scores and the overall score. Each can be overridden with a required one-line reason.
- Findings are grouped by pillar and layer, each with its evidence and source. The owner can edit, delete or add findings.
- A "could not check" list.
- **Release to organization** sets `released_at`. Before that, the organization sees "Your audit is being reviewed".

## What the organization sees

A new tab beside the full report: overall score, four pillar cards, the brand-direction summary, and per pillar "what's working", "what to fix first" and "how you compare" with cited peers and sources. PDF export through the same pipeline as the full report. "Could not check" items are shown. No before/after comparison in v1; every run is a snapshot.

## Non-WordPress sites

Most organizations will not be on WordPress. The audit reads the public website and works on any platform. WordPress is needed only for one verification method and for future automatic fixes.

- **Verification:** the meta tag and DNS TXT methods work for any site. A site builder with no code access uses DNS.
- **Platform detection:** the crawl detects the platform (`wordpress | wix | squarespace | webflow | shopify | custom | unknown`) from the page source and stores it in `research_audits.platform`. It is shown on the report. Detection is a hint, not a gate: `unknown` still gets a full audit.
- **JavaScript-rendered sites:** if the plain HTML has little or no visible text or links, the crawl re-reads the page in the headless browser the worker already uses for reports. If the page still cannot be read, the affected checks are `could_not_check`, never a failed score.
- **Fixes:** every fix is written as copy-paste text (title, description, schema snippet, alt text) plus steps for the detected platform, for example Wix: Marketing & SEO, SEO Tools. Fixes are applied by hand by the owner or the organization's web person. Automatic fixing exists only for a connected WordPress site, through the connector, and is out of scope for v1.
- **Connectors for other platforms** (Wix, Webflow and so on) are added behind the connector interface only when pilot organizations need them. The platform split of the first pilot organizations decides which comes first.

## Build order

1. Migration 0004 and the plan and verification gate.
2. Scoring core: a pure function from findings, layer weights and pillar weights to scores, with all honesty rules.
3. Rules layer for all four pillars (SEO and AIO first, then UI/UX, then content and brand), including platform detection and the JS-rendering fallback.
4. Reference library: table, import script, and about 10 sources filled in first.
5. Peer research: worker job using the SSRF-guarded fetcher, LLM extraction of strengths, 30-day cache.
6. Pillar skills and synthesis with strict JSON-schema output validation.
7. Review screen, organization tab, PDF, upgrade prompt.

## Testing

- Scoring function: unit tests including all checks skipped, an empty library, and weights that do not sum to 100.
- Rules checks: fixture HTML pages, one good and one bad per check.
- LLM steps: recorded responses plus schema validation; one manual end-to-end run on a real NGO site before release.
- Platform detection and the JS fallback: fixture pages for WordPress, Wix, a script-only page and an unknown page.
- API: a `free` org gets 403; an unreleased audit is not visible to the organization; an unverified site is refused.

## Risks

| Risk | Mitigation |
|---|---|
| LLM cost | Per-audit token budget, cached peer data, rules done in code. Estimate the cost before building step 5 and show it to the owner. |
| Prompt injection from crawled pages | Page text is data, never instructions. Output is schema-validated and cannot trigger actions. Findings may only cite evidence present in the fetched content. |
| Hallucinated benchmarks | `source_id` required for reference and peer findings; the validator drops the rest. |
| Subjective scores feel arbitrary | Written rubrics with score anchors, and the owner review step. |
| Slow audits | Background worker job, retries, then `failed`. |
| Naming real organizations as comparisons | Cite only public pages, describe observations rather than judgments, and confirm the wording in the legal pages. |
| Empty reference library at launch | Layer weight redistribution (honesty rule 4) until enough sources exist. |

## Out of scope for v1

Before/after re-run comparison, automatic fixing from the report, paid benchmark data sources.

## Open questions

- Final layer shares and pillar weights (defaults above; tune after the first pilot audits).
- Price or inclusion in `pilot`/`paid` (a business decision; the code only checks `plan`).
- Which 10 organizations seed the reference library (to be chosen with the owner, each with a real source URL).
