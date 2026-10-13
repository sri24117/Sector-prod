# Runbook — research audit (rules layer)

Run every command on the server inside `/opt/sector`, with the same `dc` alias used in the deployment runbook:
`alias dc='docker compose -f docker-compose.yml -f infra/compose.coolify.yml'`

## 1. What it is and what it is not

The research audit checks an organization's own website against a fixed set of rules for four areas: search (SEO), AI answer engines (AIO), user experience (UI/UX) and brand. It is the rules layer only.

- There are no reference-library or peer benchmarks yet, so every score comes from the rules alone.
- Nothing is shown to the organization until you release it. A finished audit waits in `in_review`.
- There is no review or edit screen yet. You read the audit in the terminal (section 4), then release it or not.

## 2. Turn it on

1. Set `RESEARCH_AUDIT_ENABLED=true` in `/opt/sector/.env`. Edit the file without printing it (never `cat` it).
2. Build and restart: the worker needs no flag but must be running the new image.
   `dc build worker api` then `dc up -d worker api`
3. Apply migration 0005: `dc exec api npm run migrate`
4. Pick up the flag: `dc up -d --no-deps api`

## 3. Make an organization eligible

- Put it on the pilot plan: `dc exec api npm run set-plan -- <orgId> pilot`
- The organization must also have verified its website.

## 4. Review

- See the audit: `dc exec api npm run research-show -- <auditId>`
- List audits waiting for review: `dc exec api npm run research-release -- --list`

Read the scores, the failed checks with their evidence and fixes, and the `?` lines. A `?` means a check could not run and is not counted in the score.

## 5. Release

`dc exec api npm run research-release -- <auditId>`

Only after this does the organization see scores and findings.

## 6. Turn it off

Set `RESEARCH_AUDIT_ENABLED=false` in `/opt/sector/.env`, then `dc up -d --no-deps api`. Audits already created stay in the database, and jobs already queued still run.

## 7. Resource note

One audit takes several minutes of Chromium on the shared 2 vCPU / 7.8 GB host, and it queues behind any full report. The worker container is capped at 1.5 GB.

## 8. Not included yet

Platform-specific fix steps, benchmark comparison, an AI-written summary, and a review and edit screen (Plans 3-6).
