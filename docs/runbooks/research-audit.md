# Runbook — research audit (rules layer)

Run every command on the server inside `/opt/sector`, with the same `dc` alias used in the deployment runbook:
`alias dc='docker compose -f docker-compose.yml -f infra/compose.coolify.yml'`

## 1. What it is and what it is not

The research audit checks an organization's own website against a fixed set of rules for four areas: search (SEO), AI answer engines (AIO), user experience (UI/UX) and brand. It is the rules layer only.

- There are no reference-library or peer benchmarks yet, so every score comes from the rules alone.
- Nothing is shown to the organization until you release it. A finished audit waits in `in_review`.
- There is no review or edit screen yet. You read the audit in the terminal (section 4), then release it or not.

## 2. Turn it on

Do the steps in this order, so the api never runs with research audits enabled before the database is ready.

1. Build the new images: `dc build worker api`
2. Start them with the feature still off (`RESEARCH_AUDIT_ENABLED` is `false` or unset in `/opt/sector/.env`): `dc up -d worker api`
3. Apply the database migrations: `dc exec api npm run migrate`. This applies migrations 0004 and 0005, which are additive and safe on a table that has never held data.
4. Only now set `RESEARCH_AUDIT_ENABLED=true` in `/opt/sector/.env` (edit it without printing it, never `cat` it), then run `dc up -d --no-deps api`.

The worker needs no flag.

## 3. Make an organization eligible

- Put it on the pilot plan: `dc exec api npm run set-plan -- <orgId> pilot`
- The organization must also have verified its website. If it has not, the organization gets the message "Verify that you own your website first." with error code `site_not_verified` when it requests an audit.

## 4. Review

- See the audit: `dc exec api npm run research-show -- <auditId>`
- List audits waiting for review: `dc exec api npm run research-release -- --list`

Read the scores, the failed checks with their evidence and fixes, and the `?` lines. A `?` means a check could not run and is not counted in the score.

## 5. Release

`dc exec api npm run research-release -- <auditId>`

Only after this does the organization see scores and findings.

## 6. Turn it off

Set `RESEARCH_AUDIT_ENABLED=false` in `/opt/sector/.env`, then `dc up -d --no-deps api`. Audits already created stay in the database. Jobs already queued will still run, because the worker does not check the flag; turning the flag off only stops new audits being created.

## 7. Resource note

Research audits and full reports share one queue that runs one Chromium job at a time (the report worker has concurrency 1 and a 10-minute lock). A research audit therefore waits behind any full report, and a full report waits behind a research audit. One audit takes several minutes; a real test run on a 20-page NGO site took about 3 minutes. The worker container is capped at 2 GB on the shared 2 vCPU / 7.8 GB host.

## 8. Not included yet

Platform-specific fix steps, benchmark comparison, an AI-written summary, and a review and edit screen (Plans 3-6).
