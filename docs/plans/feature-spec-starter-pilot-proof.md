# Feature: Starter pilot proof

Status: the six open decisions were confirmed by the founder on 2026-10-31 and are recorded in
"Decisions" below. No slice has started. Slice D stays gated on its own pass bar.
Written 2026-10-31 against `main` at `bc487df`. Format: the MVP Feature Card
(`docs/methodology/AI_ENGINEERING_HANDYBOOK.md` §24), shaped by the founder's Builder Playbook.

## Goal

Find out, with evidence, whether the Starter plan works and sells: that a small NGO can go from
signup to a useful outcome (an approved content piece, a verified WordPress fix), that the
report and the AI drafts are accurate enough to trust, and that someone will pay Rs 5,999 + GST
a month for it. Starter is already built (PR #24). This spec is about **proving it**, not adding to it.

## User

The comms or marketing generalist at an FCRA-registered Indian NGO (often one person, no web
developer), plus the director who approves spending. See `docs/reference/sector-competitor-usp.md` §5.

## Why

Everything Starter needs exists on `main`, but almost nothing is validated:
the crawler has no recorded run on real NGO sites (`docs/plans/handoff-current-state-2026-10-26.md` §3, §4),
the updated WordPress plugin has not run on real WordPress, no AI provider is configured, CI does not
exist, and the funnel report cannot tell us whether anyone uses the content or calendar half of Starter.
More features now would be guessing. The Playbook's first rule applies: write the decision as one
sentence, list the assumptions, and run the cheapest test that could kill it.

**The decision:** "An NGO comms person will pay Rs 5,999 + GST a month for Starter."

## Assumptions (Playbook ch. 1)

| # | Assumption | Type |
|---|---|---|
| 1 | The buyer is the comms generalist, and the director approves a monthly spend this size | Not sure |
| 2 | Enough target NGOs run WordPress for the fix to matter | Not sure |
| 3 | The report's findings match what a person sees on real NGO sites | Not sure (never validated) |
| 4 | Drafts written from facts the NGO supplies save real time | Not sure |
| 5 | A manual-posting calendar is enough without auto-publishing | Human choice |
| 6 | 15 generated pieces a month is the right allowance | Human choice |
| 7 | Generated drafts are safe: no invented facts, no consent-less beneficiary content | Not sure (needs evals) |

**Kill test, within 7 days:** show the real report for 5 real NGO sites, plus a Starter walkthrough
and the price, to 5 real buyers, and ask whether they would take a one-month paid pilot. Bar
(confirmed, decision 1): at least 2 of 5 agree to a paid one-month pilot, and at least 1 confirms
in writing within 14 days.

## Current behavior (read on `main`, not run)

- Starter plan enforced by `packages/shared/src/plans.ts`: full report, live WordPress fix, brand kit, consent records and content need Starter; Ad Grants needs Pro; 15 generated pieces a month for Starter, counted from stored drafts.
- Content: manual drafts work without AI. AI generation returns "not yet available" until `LLM_PROVIDER`, `ANTHROPIC_API_KEY` and `LLM_MODEL` are set. Beneficiary names the user lists are replaced with placeholders before text goes to the model, then restored (`apps/api/src/content/consent.ts`). Names or details only in the free-text facts are NOT replaced.
- Calendar: manual-posting plan only, no publishing (`apps/api/src/routes/calendar.ts`).
- Funnel report counts audits, signups, WordPress connections, verified fixes and average score change. It has **no** numbers for reports, drafts, approvals, exports or calendar use.
- No CI workflow in the repo (`.github/workflows` is missing). `docs/plans/ngo-starter-mvp.md` lists release gates still open: native Postgres run, worker sandbox test, real WordPress, live AI.

## Desired behavior

In four slices. Slice A and C can start now and in parallel. D waits for one human decision.

### Slice A: validate before building (no code)

- A1. Run the free audit and the full report on 5 to 10 real NGO sites. For each, a person compares the output with the live site and notes every wrong or missing finding. Record the result in `docs/plans/validation-real-ngo-sites-<date>.md`.
- A2. Real WordPress test of Companion 0.2.0 on a staging site: connect, preview, approve, apply, restore, caches.
- A3. The kill test above. Write down what each buyer said, in their words.

### Slice B: release gates (Level 2)

- B1. Apply migrations `0000` to `0006` to a fresh native Postgres 16 database, and upgrade a copy that is at `0003`. Report what ran.
- B2. A CI workflow running types, lint, tests and the worker sandbox test. Pushing a workflow file needs a token with workflow scope; the founder adds that to their own `gh` login (decision 5).

### Slice C: see whether Starter is used (Level 2, no schema change)

Extend `apps/api/src/scripts/funnel-report.ts` with numbers derived from tables that already exist. No new tracking tool, no new events, no new tables. Per Starter organization, all time and last 7 days:

- full reports finished;
- content pieces created, approved, exported (`content_assets.status`);
- calendar items created;
- verified WordPress fixes (already counted);
- organizations active in the last 7 days.

Definitions (confirmed, decision 2): **activated** = an exported content piece or a verified fix within 14 days of being set to Starter; **North Star** = organizations with at least one exported piece or verified fix in the last 7 days. Export, not approval, because export means the organization took the work.
Not proposed: PostHog or any analytics service. It would be a new third-party processor for NGO data, which needs an ADR and a DPDP view (CLAUDE.md §2, §5).

### Slice D: AI quality gate before generation is switched on (Level 3: personal data and consent)

Generation stays off until this passes.

- D1. Provider (decision 3): do not enable generation for the first pilot; manual drafting covers it. When D passes, the only provider wired today appears to be Anthropic's (`packages/ai/src/index.ts`). Evaluate a mid-size and a smaller model and keep the cheapest that passes. Before any real NGO data goes to a provider, confirm the privacy policy and DPDP addendum name it as a processor. Only de-identified data may go to a non-Indian LLM API (CLAUDE.md §5).
- D2. An eval set of 30 cases, 10 of them adversarial: facts that tempt invented numbers; a beneficiary named only in the facts (the placeholder step misses it); thin facts; a request for an unverifiable claim about FCRA, 12A or 80G; prompt-injection text inside the facts. Fixture-based and repeatable, kept under `apps/api/test/` or a sibling folder.
- D3. Pass bar, proposed: zero invented numbers, names or quotes (every figure and proper noun in the draft appears in the supplied facts); when facts are thin the draft says what is missing instead of guessing; the consent gate still blocks export.
- D4. A shadow run on 3 pilot organizations' real facts. The founder compares the drafts with what they would have written. Record the gaps.
- D5. Record tokens and cost per piece during the eval run, then compute the Starter margin: price against 15 pieces plus the hosting share. Margin (confirmed, decision 4): floor 65 percent, target 75 percent, on direct costs (AI, hosting share, payment fees). Founder support hours per pilot customer are tracked separately, since at five customers that time is the real cost. Metering inside the product is not proposed yet; it would need a schema change and a human decision.

## Acceptance criteria

- [ ] A: a written validation note exists for at least 5 real NGO sites, with every discrepancy listed.
- [ ] A: Companion 0.2.0 has run the full apply and restore path on a real WordPress site, and the result is recorded.
- [ ] A: at least 5 buyer conversations are recorded and the kill-test bar is evaluated against them.
- [ ] B: the migration chain applies to a fresh database and upgrades one at `0003`; the output is in the PR.
- [ ] C: the funnel report prints the Starter numbers above, tenant-correct, with demo organizations excluded, and a test covers the queries.
- [ ] C: no new table, column, event or dependency.
- [ ] D: generation is off in production until the eval set passes the agreed bar and a human flips the configuration.
- [ ] D: the eval set includes a case where a beneficiary appears only in the facts, and the result is recorded even if it fails.
- [ ] Every PR states what was and was not verified, using the evidence ladder (Handbook §28).

## Guardrails

- No new plans, prices, limits or features. No billing.
- No schema change, auth change or new service without a separate human approval (CLAUDE.md §7).
- Tenant isolation on every query. Slice C queries group by `organization_id` and never mix tenants.
- Generated content never publishes. Draft, human approval, then export, with the consent check (CLAUDE.md §2, §5).
- The repository is public: no real NGO names, contact details or buyer quotes in committed files. Keep Slice A and A3 notes in the shared notes folder or private storage, and commit only anonymized summaries.

## Relevant files

- `packages/shared/src/plans.ts` (plan table)
- `apps/api/src/routes/content.ts`, `apps/api/src/content/consent.ts` (generation, placeholders, allowance)
- `apps/api/src/routes/calendar.ts`
- `apps/api/src/scripts/funnel-report.ts` (Slice C)
- `packages/ai/src/index.ts` (provider configuration)
- `docs/plans/ngo-starter-mvp.md` (existing release gates)

## Risks

- **Free-text facts can hold personal details.** The placeholder step only covers names listed as beneficiaries. Slice D must test this, and may need a warning or a stronger scrub before any real provider is used.
- **The WordPress fix helps only WordPress sites.** If few pilot NGOs use it, Starter's headline outcome is the content half, which depends on AI quality.
- **Selling on a heuristic score.** Audit scores keep the current scoring version with stated limits. Do not present them as a measure of donor outcomes.
- **Shared production host** (2 vCPU, 7.8 GB, per ADR-0007): a shadow run or several reports at once can slow other apps. Run evals on a developer machine, not production.

## Verification

Each slice names its own evidence. For Slice C: a test against a seeded database, plus the printed output on a copy of real pilot data. For Slice D: the eval run output and the shadow-run notes. For Slice A: the written notes themselves. Nothing is "done" on typecheck and tests alone (Handbook §1).

## How the two guides apply here

| Source | Idea | Where it lands |
|---|---|---|
| Handbook §1, §27 | Match the process to the risk | Slices A to C are Level 2. Slice D is Level 3: plan, human approval, independent review, security review |
| Handbook §10, §24 | Observable acceptance criteria | The checklist above |
| Handbook §13 | Stop conditions | Any schema, auth or new-service need pauses the work for a decision |
| Handbook §28 | Evidence ladder | Every PR labels what reached which level |
| Playbook ch. 1 | Assumptions and a kill test | The assumptions table and the 7-day test |
| Playbook ch. 2 | Test the screen with a real user | Part of A3: watch each buyer try Content and Calendar, and write down what they say and do not say |
| Playbook ch. 4 | Eval set, escalation, monitoring for AI | Slice D |
| Playbook ch. 5 | Activation and a North Star metric | Slice C |
| Playbook ch. 7 | Customer discovery | Slice A3 |
| Playbook ch. 9 | Unit economics and margin | Slice D5 |

The Playbook's own worked examples are about clinics, so only its principles are used here.

## Decisions (confirmed by the founder, 2026-10-31)

1. **Kill test.** At least 2 of 5 buyers agree to a paid one-month pilot and at least 1 confirms in writing within 14 days. Buyers match the research profile (FCRA-registered, foundation- or CSR-backed, a named comms person, preferably WordPress): three warm from the founder's network, two cold, none who would say yes to be polite. Before showing the price, ask what they spent on their website and content in the last year. The five are chosen by the founder and are not named in this public repository.
2. **Activation and North Star.** As defined in Slice C, using exported content.
3. **AI provider.** Generation stays off for the first pilot. Choose the provider and model after Slice D, as in D1.
4. **Margin.** Floor 65 percent, target 75 percent, as in D5.
5. **CI token.** The founder adds the workflow scope to their own `gh` login (`gh auth refresh -h github.com -s workflow`). No token is ever pasted into chat or committed.
6. **What pilot Starter contains.** Only what is built: audit, full report, WordPress schema fix, content (manual always; AI after the quality gate), brand kit, consent records, and the manual-posting calendar. Researcher and automatic posting stay "coming soon" in Growth. `docs/product/product.md` already says this.

## Definition of done

A real pilot NGO can reach an approved piece and a verified fix, the founder can see from one report whether they did, the report and drafts have been checked against real data, and there is a recorded answer to whether buyers will pay.
