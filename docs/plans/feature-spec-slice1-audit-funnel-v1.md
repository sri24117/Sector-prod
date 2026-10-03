# Feature: Audit funnel — v1 (synchronous, no persistence)

> **Update:** the "no persistence / no queue" limits below describe the anonymous public `/audit` endpoint, which is unchanged. Logged-in orgs now get persisted audits (`POST /audits`, Slice 3) and ADR-0002 is confirmed. The BullMQ queue for audits remains unwired (still a pilot-scale shortcut).

Scoped per `docs/plans/phase-0-1-roadmap.md` Slice 1, deliberately narrowed
to the part of Slice 1 that doesn't require a human decision first. See
"Explicitly not in this increment" below.

## Goal
Prove the free-audit funnel end to end: a visitor enters an NGO's URL,
sees the site crawled and scored live, and sees a connect-intent CTA.

## User
Anonymous visitor (prospective NGO) landing on the SEctOr marketing site.

## Why
This is the entire top of funnel — nothing else in the roadmap can be
validated against a real org until this works.

## Current behavior
`apps/web` shows a static placeholder page. `apps/api` has only `/health`.
`services/crawler/src/audit.ts` has real, working check logic but only a
synchronous CLI entrypoint (`services/crawler/src/index.ts`) — nothing
calls it over HTTP yet.

## Desired behavior
Visitor submits a URL on the homepage, sees a loading state, then sees the
score (0-100), a pass/fail breakdown of the 7 checks with the human-readable
`detail` string already produced by `audit.ts`, and a "Talk to us" /
connect-intent CTA.

## User flow
1. Visitor lands on `/`, sees a single URL input + submit button.
2. Submit calls `POST /audit` on `apps/api` with `{ url }`.
3. API validates the URL (zod), calls `@sector/crawler`'s `runAudit(url)`
   directly (in-process — no queue yet, see below), returns the
   `AuditResult` JSON or a typed error.
4. Web renders the result: score, per-check pass/fail + detail, CTA.
5. Failure (unreachable URL, timeout, invalid input) renders a plain-language
   error, not a stack trace, and does not crash the form.

## Functional requirements
- [x] `POST /audit` on `apps/api`, zod-validated `{ url: string }` body.
- [x] Route calls `runAudit` from `@sector/crawler` and returns its result.
- [x] `apps/web` replaces the placeholder page with a real client form that
      calls the API and renders results (score + 7 checks + CTA).
- [x] Basic request timeout / clear error surfaced to the user for
      unreachable or invalid URLs.

## Non-functional requirements
Single synchronous request is fine at this scale (manual pilot testing, low
concurrency) — see "Explicitly not in this increment."

## Data requirements
**None.** No table is created or touched. Audit results are computed and
returned in the HTTP response only; nothing is persisted. This is
intentional, not an oversight — see below.

## API requirements
`POST /audit`
- Request: `{ "url": string }` (must parse as a URL)
- 200: `AuditResult` (`url`, `score`, `runAt`, `checks[]`) — same shape
  `services/crawler/src/audit.ts` already produces.
- 400: `{ "error": "invalid_url", "message": string }`
- 502: `{ "error": "crawl_failed", "message": string }` — target unreachable,
  timed out, or returned a non-HTML/error response.

## AI requirements
None. Every check in `audit.ts` is deterministic, no LLM involved, per
CLAUDE.md §2.

## Integration requirements
None beyond the target NGO site itself. No connector, no Browserless.io
call in this increment (see below) — cheerio/static-HTML tier only, same
scope `services/crawler/README.md` already documents as what's built.

## Edge cases
- [ ] URL with no scheme (`example.org` vs `https://example.org`) — normalize
      by prepending `https://` if parsing without one fails.
- [ ] Target site times out — bound the crawler's `undici` request with a
      timeout (10s) so one slow site can't hang the API process.
- [ ] Target site blocks the audit bot's user-agent / returns 403 — surface
      as `crawl_failed` with that detail, not a generic 500.
- [ ] JS-heavy site with an empty static HTML shell — score will be
      artificially low. Known limitation (Browserless.io fallback is
      explicitly out of scope below); surface a soft warning in the UI, not
      a silent wrong score. Test against a fixture before calling this
      increment done, per the roadmap's own stated Slice 1 risk.

## Security
No auth, no tenant data — anonymous, unauthenticated, no PII collected.
Rate-limit the route in a later increment to prevent it being used as an
open web-scraping proxy (`UNKNOWN` — not built here; flagging so it isn't
silently forgotten).

## Acceptance criteria
- Given a real, reachable static-HTML NGO URL, when submitted, then a score
  and 7 check results render within a few seconds, and the score matches
  running `pnpm --filter @sector/crawler dev -- <url>` directly (same
  underlying function).
- Given an unreachable URL, when submitted, then a plain-language error
  renders and the form remains usable (no crash, no infinite spinner).
- Given a JS-heavy site, when submitted, then a result still renders (does
  not crash) — the UI must show a "results may be incomplete for
  JavaScript-heavy sites" note (see freshness/schema checks reading an
  empty shell).

## Testing
`services/crawler` already has `test/audit.test.ts` (existing, not touched
here). Add to `apps/api`: happy-path test (mocked `runAudit`) and a failure
path (crawl throws → 502, not a 500 with a stack trace leaked to the
client).

## Risks
- [ ] Static-HTML-only crawling will under-score JS-rendered sites until
      ADR-0003's Browserless.io fallback is wired — this is a known,
      disclosed limitation of this increment, not a bug to silently patch
      around.
- [ ] Running the crawl in-process in the API's request/response cycle
      (rather than via the BullMQ/worker queue already scaffolded in
      `services/workers`) will not survive real concurrent load. Fine for
      a pilot; must move to the queue before any real traffic — tracked as
      a known follow-up, not solved here.

## Rollback
Stateless — no migration, no data written. Revert the two commits (API
route + web page) to roll back.

## Definition of done
A visitor can type a real NGO URL into the homepage and see a live,
correct 0-100 audit score with a per-check breakdown and a CTA, with no
database or queue involved yet.

---

## Explicitly not in this increment (and why)

Per `PROJECT.md` §2 and `CLAUDE.md` §7 (stop conditions), the following
roadmap-listed Slice 1 capabilities are deliberately **not** built here,
each because building it would mean making a decision that's marked
`PROPOSED` / `HUMAN DECISION REQUIRED` rather than `CONFIRMED`:

1. **Postgres `Audit`/`Finding` persistence.** ADR-0002 (Prisma as ORM,
   and by extension the schema itself) is `PROPOSED`, not `CONFIRMED`.
   Writing migrations now would be inventing schema ahead of that
   decision — exactly what `PROJECT.md` §2 already flagged as
   deliberately not done. This increment returns the result in the HTTP
   response only.
2. **BullMQ job enqueue / `services/workers` wiring.** No architectural
   decision blocks this one, but it's more than "the smallest useful
   change" (CLAUDE.md §6) needed to prove the funnel end-to-end for a
   pilot. Flagged as a named risk above, not silently dropped.
3. **Browserless.io JS-render fallback.** ADR-0003 recommends it but the
   tier is explicitly listed in `PROJECT.md` §15 as still needing a human
   decision. Static-HTML-only for now, with the limitation surfaced in the
   UI rather than hidden.

If the intent was actually to greenlight ADR-0002 (Prisma/Postgres schema)
and/or ADR-0003 (Browserless.io tier) right now, say so explicitly and
they can be built next — that's a one-line decision, not a re-architecture.
