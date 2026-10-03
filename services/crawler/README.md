# services/crawler — Audit Engine (Skill 1)

> **Reconstruction note**: the original `audit-engine.js` prototype (built
> and fixture-validated in an earlier working session) is not present in
> this workspace snapshot. `src/audit.ts` below is a faithful
> reconstruction of its documented design (same 7 checks, same weights,
> same cheerio-based approach) written fresh in TypeScript for this
> monorepo. **If the founder still has the original `audit-engine.js` file
> (it was delivered directly as a download earlier), diff it against this
> reconstruction and prefer the original's exact logic** — this version has
> not been re-run against the original synthetic test fixtures.

Implements the checks specified in `skills/audit-engine.md`: schema (20pts),
robots.txt AI-crawler blocking (15pts), llms.txt (5pts), heading hierarchy
(15pts), FAQ pairs (20pts), front-loaded stat (15pts), freshness (10pts).

## Usage

```bash
pnpm --filter @sector/crawler dev -- https://example-ngo.org
pnpm --filter @sector/crawler dev -- --batch urls.csv --out results.json
```

## What's NOT in this reconstruction yet

- The Playwright/Browserless.io JS-render fallback (see
  `docs/decisions/ADR-0003-hosting-topology.md`) — this file only implements
  the cheerio/static-HTML tier. Wire the fallback per that ADR before
  running this against a real, unknown NGO site population, since a
  meaningful fraction will be JS-dependent.
- The BullMQ queue wrapper for multi-tenant async runs (see
  `skills/audit-engine.md` §3) — this is currently a synchronous CLI, same
  as the original v0. `services/workers` is where the queue-backed version
  should live once built.
- Postgres persistence of `Audit`/`Finding` rows — currently prints
  JSON/CSV to stdout or a file, matching the original v0's behavior.
