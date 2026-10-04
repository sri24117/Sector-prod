# ADR-0007: Self-hosted Chromium in the worker for paid full reports

## Status
CONFIRMED (product owner, 2026-10-04: "with the help of free or opensource web scraping tools like playwright")

Supersedes ADR-0003 **for the full-report feature only**. The free taster and in-app audits still use the cheap HTTP + cheerio crawler; whether those audits get a JS-render fallback is still governed by ADR-0003.

## Context
Paid organizations need a detailed SEO, website-health, UI/accessibility and social report. Lighthouse, axe-core and screenshots all need a real browser. ADR-0003 proposed renting one (Browserless.io) to protect the shared box's memory. The owner chose free and open-source tooling instead. Production is a 2 vCPU / 7.8 GB host shared with other apps (Coolify, Leadsprint), not the 16 GB box ADR-0003 assumed.

## Decision
- **Where it runs:** Playwright's Chromium runs inside the existing `worker` process. No new service is added, so the modular monolith holds (ADR-0001).
- **One report at a time:** reports run on their own BullMQ queue with concurrency 1, a 4-minute timeout per report, and a hard cap of 20 pages.
- **Memory:** the worker container keeps a memory limit (1.5 GB in compose), so a runaway render cannot starve the other apps.
- **Network:** all browser traffic goes through an in-process forward proxy built on `@sector/shared/net-guard`. Browsers resolve DNS themselves, so this proxy is what keeps SSRF protection intact for sub-resources and Lighthouse.
- **Image size:** the worker image moves to Debian slim, because Playwright does not support Alpine. It grows by roughly 450 MB; api and web are unaffected.

## Consequences
- Throughput is low by design: a few reports per hour, which is right for a manual-invoice pilot. Revisit (Browserless, or a separate render box) if reports queue for more than 10 minutes.
- There is no third-party cost or data processor for page rendering, which is simpler for DPDP.
- Firecrawl was rejected: AGPL-3.0, and a heavy self-hosted stack.
