# ADR-0003: Headless browser rendering stays external (Browserless.io), not self-hosted, for Phase 0-1

## Status
PROPOSED — HUMAN DECISION REQUIRED to finalize (cost vs. control tradeoff)

## Context
The confirmed hosting spec for Phase 0-1 is one KVM VPS: 4 vCPU / 16 GB RAM /
200 GB NVMe / 16 TB bandwidth, Docker-based. Skill 1 (Audit Engine) already
specifies a two-tier fetch strategy: cheap `cheerio` parse first, escalating
to a full headless-browser render (Playwright/Chromium) only for JS-dependent
pages. A single headless Chromium render can use several hundred MB of RAM
per concurrent page context. `docker-compose.yml` already budgets ~6.9 GB of
the 16 GB for Postgres/Redis/API/web/worker, leaving real but not unlimited
headroom.

## Decision
For Phase 0-1, do not run a self-hosted Playwright/Chromium pool on the same
box as the application. Use Browserless.io (or an equivalent managed
headless-browser service) as an external dependency, called from
`services/crawler` only for pages detected as JS-dependent. This keeps a
crawl spike (a batch re-audit hitting many JS-heavy sites at once) from
starving Postgres or Redis on the box actually serving customers.

## Alternatives
- Self-host Playwright + `@sparticuz/chromium` on the same box: rejected for
  Phase 0-1 — the RAM budget doesn't comfortably support both the app stack
  and a browser pool at the same time, and a crawl spike becoming a customer-
  facing outage is a bad trade for saving a ~$25-140/mo Browserless bill.
- Self-host on a second, separate box dedicated to crawling: viable later,
  not justified yet at pilot client volume.
- AWS Lambda/Fargate for the crawler specifically: the original Skill 1 spec
  flags this as a later option once volume justifies the ops overhead. Not
  Phase 0-1.

## Consequences
- Adds a paid external dependency and its own failure mode (Browserless
  outage/rate-limit) — `services/crawler` must treat it like any other
  external call (timeout, retry, surface failure), not assume it always
  succeeds.
- Re-budget `docker-compose.yml` and re-open this ADR the day self-hosting is
  reconsidered — don't add a `browser` service to the compose file without
  updating the memory limits of every other service first.

## Human decision required
Confirm the Browserless.io tier (Prototyping $25/mo/20k units vs. Starter
$140/mo/180k units) once real crawl volume from the first pilot NGOs is
known — do not pre-pay for a tier without that data.
