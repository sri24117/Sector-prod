# Feature: Research audit v1, four tabs with AI-grounded analysis

Status: PROPOSED. The social-data source and the AI-grounded direction were chosen by the founder on
2026-10-31 (see "Decisions"). Nothing here is built. Format: MVP Feature Card
(`docs/methodology/AI_ENGINEERING_HANDYBOOK.md` §24). Written against `main` at `cd9679c`.
This builds on `docs/superpowers/specs/2026-10-13-research-audit-design.md`; where they differ, this
file records the change and the old design stands otherwise.

## Goal

A paying NGO opens one page with four tabs, **SEO**, **AI visibility (GEO)**, **UI/UX** and
**Content and brand**, each with a score, what is working, what to fix first, and findings that are
specific to that organization, not generic advice.

## User

The comms generalist and the director at a Starter NGO. The founder reviews each audit before the
organization sees it (the existing release gate).

## Why

The full report gives one long document. Tabs are easier to work through, and the research audit
design already defines these four pillars. The founder's concern is that output must be specific:
"scrape their websites and social media and use an AI model, with our logic and scores, instead of generic".

## Current state (read on `main`; PR #25 read only by file list)

- On `main`: the design, tables (`research_audits`, findings, reference sources, review edits; migration `0006`), the scoring function (`packages/shared/src/research-score.ts`), and an API to create, list and read audits. Scores are hidden from the organization until the owner releases them. The create endpoint is registered only when a queue exists, so production does not create audits today.
- Open PR [#25](https://github.com/sri24117/Sector-prod/pull/25) (about 5,000 lines, no checks yet): the automated checks, collection, the job runner, an ops viewer, migration `0007`, a runbook, and a very small analysis step. It is the stranded second half of the stacked work. It needs review before anything builds on it.
- Not built anywhere: the organization-facing tabs, the owner review screen, PDF export, any AI scoring, the reference library, peer research.

## Decisions (confirmed by the founder, 2026-10-31)

1. **Social data comes from the NGO first.** What the organization's own website shows (links, share cards, embedded feeds) plus data the NGO provides: links to public posts it chooses, or exports and screenshots from its own accounts. **No automated scraping of social platforms** (their terms forbid automated collection without permission; a third-party scraper would be a new data processor). Official platform connections come later, when approvals clear.
2. **AI-grounded analysis.** AI reads the organization's real pages and the data it supplies, and writes findings against our written rubrics. Checks in code sit underneath. The owner reviews before release.

## Desired behavior

For each pillar, scoring combines three things:

| Layer | What it is | v1? |
|---|---|---|
| Rules | Automated checks from PR #25 (SEO, GEO, accessibility, speed, mobile, structure) | yes |
| AI analysis | AI scores against the pillar rubric (anchors: 0 absent, 50 basic, 100 comparable to the reference set) and writes findings | yes |
| Reference and peers | Curated reference organizations and live peers | later; its weight moves to the others, per the design's honesty rule 4 |

Rules that keep it specific and honest (from the existing design, restated because they are the point):

- **Every AI finding quotes evidence** from the page or the supplied data, and names its source. A finding without evidence is dropped by the scorer and rejected by the database.
- A check that could not run is shown as "could not check" and excluded from the score. Nothing is guessed.
- Page text and supplied data are data, never instructions. AI output is validated against a strict schema and can trigger no action.
- The rubrics live in `skills/` as written domain logic ("our logic"), not hidden in prompts.

**Social input (v1):** a small form where the owner or staff add up to N public post links and may upload exports or screenshots of their own accounts. The AI reads what they supply. The tab states plainly what it could and could not see.

**The page:** one "Website research" page with the four tabs and an overall score, shown only after release. Each tab has: score, what is working, what to fix first, findings with their evidence, and "could not check". No PDF in v1.

## Acceptance criteria

- [ ] PR #25 is reviewed and merged (or replaced) before any dependent work.
- [ ] A Starter org with a verified site can request an audit; Free gets 403; an unverified site is refused.
- [ ] Before release the organization sees only "being reviewed"; after release, four tabs with scores.
- [ ] Every AI finding in a fixture run carries a quote that appears in the fetched source; one that does not is dropped (tested).
- [ ] An empty social input yields "could not check" for social findings, not invented ones.
- [ ] An eval set (as in the Starter pilot spec, slice D) covers research prompts: invented figures, injected instructions on a page, thin content. It passes the agreed bar before AI analysis runs for a real organization.
- [ ] Cost per audit is measured on the eval run and written down before the first real audit.
- [ ] Tenant isolation: one organization can never read another's audit, findings or supplied data.

## Guardrails

- No scraping of social platforms. No third-party scraper or crawler service (Firecrawl stays rejected, ADR-0007).
- Only the organization's own verified site is fetched, through the existing guarded fetcher.
- Only de-identified data goes to a non-Indian AI API (CLAUDE.md §5). Do not ingest comments or other people's personal data from supplied exports; strip or refuse them.
- Naming other organizations as comparisons waits for the reference library and legal wording.
- Any schema change (for example storing supplied social data) needs separate approval (CLAUDE.md §7).
- Level 3 work (handbook §27): approval before build, independent review, security review.

## Relevant files

- `docs/superpowers/specs/2026-10-13-research-audit-design.md`, `docs/runbooks/research-audit.md` (in PR #25)
- `apps/api/src/routes/research-audits.ts`, `packages/shared/src/research-score.ts`
- `services/workers/src/research/*` (in PR #25), `skills/` (rubrics)

## Risks

- **AI cost and quality.** Not yet measured. The AI provider decision, deferred in the Starter pilot spec, is needed earlier because of this feature.
- **Supplied exports can contain other people's personal data** (comments, names). Needs a refuse-or-strip rule before anything reaches an AI provider.
- **Review does not scale.** The owner reviews every audit; fine for a pilot, a bottleneck after.
- **PR #25 is large and unreviewed**, and `main` has moved since it was written.
- A single score can feel authoritative. State the method and limits on the page.

## Verification

Evidence ladder (handbook §28): scoring and rules by unit tests; AI steps by recorded responses plus schema validation and the eval set; then one manual run on a real NGO site with the founder comparing the output to what a person sees. Nothing is called done on tests alone.

## Definition of done

A released audit shows four specific, evidence-backed tabs for a real pilot NGO, the founder judged it better than generic advice, and the cost per audit is known.

## Open decisions (HUMAN DECISION REQUIRED)

1. AI provider and model, and the cost ceiling per audit.
2. How many post links, and what upload types, the social input accepts.
3. Whether the research page replaces the full report later (not proposed yet; keep both).
4. Whether Starter includes it or it is a higher tier (the old design says the paid plan).
5. A reviewer for PR #25.
