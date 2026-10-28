# NGO Starter pilot implementation

Authorized by the founder in conversation on 28 October 2026: implement the smallest paid-pilot journey, reusing the existing app. Scope is accurate report inputs, safe limited WordPress remediation, factual editable content, approval and export, and a persistent manual-posting calendar. Existing owner/staff/viewer roles and manual invoicing remain. No invitations, new role hierarchy, automated publishing, Ad Grants expansion, website builder, or new pricing limits.

Calendar items attach an existing content asset to a date, channel, objective, and named responsible person. Planning never claims to schedule or publish. All records are organization scoped. Content edits use optimistic revision checks and reset approval. Approved/exported content can be downloaded repeatedly, with consent checked each time. Manually supplied drafts work without an AI provider and use the existing content allowance.

Schema additions support this authorized scope: revision and source facts on content assets; organization-scoped calendar items. Migrations are additive, run locally for verification; production migration and deployment are not part of this action.

Audit scores retain the current scoring version for compatibility, with explicit heuristic/coverage limitations. No new search or donor score claims. Schema changes are proposed and approved for the exact current organization website. Duplicate operations and uncertain write outcomes must not trigger blind retries.

## Enable the pilot in staging

1. Install with the frozen lockfile and run the additive `0004_fearless_ultron` database migration using the existing migration command. Back up the staging database first; do not apply to production as part of this branch review.
2. Update the controlled staging WordPress site to Companion 0.2.0. Older versions are deliberately refused when a schema snapshot is unavailable. Review conflicts with existing SEO-plugin schema before applying anything.
3. Invoice manually and set the organization's existing Starter plan using the current operations script. No new price or numerical fix limit is introduced.
4. Use Content → Write or paste a draft without AI. Record source facts and all named people. Manual and generated drafts share the existing 15-piece allowance; edits and repeated exports do not consume another piece.
5. Save, review, approve, and download. Add the draft to Calendar with a date, channel, objective, and responsible person's name. This does not send invitations or publish content. Viewers cannot mutate either resource.
6. On Audits, request a proposal, inspect the target/old/new schema, approve and apply, and review durable change history. Test restoring the previous value and refreshing website caches.

## Verification record

- Source, API, web, database, crawler, connector, and worker TypeScript checks passed. API/crawler/worker compilation and Next.js production build passed.
- ESLint now parses TypeScript/TSX using a pinned parser dependency. Source lint passed; removed stale suppression comments for a hook plugin that was never configured.
- API suite: 119 tests across 17 files passed across the full run and subsequent focused regression run. Database tenant-isolation suite: 8 passed. These ran with a temporary PGlite PostgreSQL-WASM adapter, applying all checked-in SQL migrations. This supplements rather than replaces native PostgreSQL 16 checks.
- Crawler: 13 passed. Shared utilities/plans: 63 passed. Report analysis/proxy: 16 passed; one additional static browser-argument assertion passed. The actual worker browser-egress test could not launch its expected installed Chromium and remains a release gate.
- Actual Next.js UI and API journey passed in headless Chromium: manual draft, approval, repeat-capable text download, calendar creation and persistence after reload, edit invalidating approval, and calendar status reflecting the draft state. Desktop and 360px screenshots inspected; no horizontal overflow in the tested mobile screen.
- Companion behavior tested through a controlled HTTP mock including subdirectory targeting, stale review, changed organization website, duplicate attempt, failed verification after successful write, and restoration. The PHP plugin has not been executed on real WordPress in this environment.
- Added PR checks with native PostgreSQL 16, Redis, Chromium, lint, types, tests and build. CI execution is pending the pull request; it is not claimed to have passed.

## Remaining release gates

Run native PostgreSQL integration tests and the worker's sandbox/egress test in CI, then validate the updated plugin on a real staging WordPress installation. Test a configured live AI provider separately if enabling generation; manual drafting needs no provider. Prior dependency/runtime security advisories, production configuration, backup restore and capacity checks remain outside this feature branch's verified claims. Do not market this change as complete production hardening.

## Rollback

The migration only adds fields and a calendar table. The previous application can ignore them; keep the additive schema when rolling back application images. Restore schema changes through recorded remediation history before removing the upgraded plugin. Unknown apply/restore outcomes require manual reconciliation rather than blind retry. Preserve the database and credential encryption key.
