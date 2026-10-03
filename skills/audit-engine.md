# Skill 1: Audit Engine

Status: free tier, always-on, the front door of the product. Already exists as a working prototype (`audit-engine.js`, verified against synthetic fixtures, not yet against a live NGO site, see the separate audit-engine handoff for that gap — a reconstructed version lives in `services/crawler/`). This document specs what it takes to go from that local script to a production, multi-tenant Phase 1 capability.

## 1. Role and scope

The Audit Engine answers one question, cheaply and repeatably: how visible is this organization's website to search engines and AI answer engines, right now. It does not fix anything (that is Skill 2). It does not require login for the free single-URL version, and it becomes the data source every other skill reads from once an org is onboarded (Skill 2 needs its findings to know what to fix, Skill 4 needs its findings to know what content gaps to write into, Skill 6 cross-references it when matching an org to grant/accelerator criteria that mention digital readiness).

Explicit non-goals: it does not crawl paid ad accounts (that is the Ad Grants skill), it does not judge writing quality or brand voice (that is Skill 4), and it does not generate the fix itself (Skill 2).

## 2. What it checks (unchanged from the validated v0)

Grounded in `ngo-marcomm-toolkit/references/blog-seo-geo.md`, already implemented and fixture-tested in the original `audit-engine.js`:

1. JSON-LD schema presence (Organization/NGO, Article/BlogPosting, FAQPage)
2. robots.txt AI-crawler blocking (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot)
3. llms.txt presence at site root
4. True H1/H2/H3 hierarchy (catches the WordPress/Elementor title-as-H2 bug)
5. 3-6 genuine FAQ-style Q&A pairs (schema-first, heuristic fallback)
6. A concrete stat/figure in the first 30% of visible content
7. Freshness signal (`<time>` tag, visible "last updated" text, Last-Modified header as a weaker fallback)

**Correction to carry into the build**, from research: do not market llms.txt as a meaningful GEO lever. Ahrefs' 2026 analysis of 137,000 domains found 97% of published llms.txt files receive zero AI-system requests; Google has stated publicly it does not support the file; only Perplexity is a confirmed consumer. Keep the check (it is free to run and free to fix) but weight it low and describe it internally as hygiene, not a growth lever, the current 5/100-point weighting in the v0 scorer is already about right, do not raise it.

Weights: schema 20, robots.txt 15, llms.txt 5, heading hierarchy 15, FAQ pairs 20, front-loaded stat 15, freshness 10 = 100.

## 3. New for Phase 1: multi-tenant, always-current, not single-shot

The v0 script runs once, on demand, against one URL, from a machine with real internet access. Phase 1 needs:

- **A crawl queue and worker pool**, not a synchronous CLI call, one org's audit should not block another's, and a batch re-audit of an entire client base (weekly, to catch regressions and feed the "freshness" trend the dashboard shows) needs to run unattended.
- **A two-tier fetch strategy**: cheap static HTTP fetch + `cheerio` parse first (works for the majority of NGO sites, which are still server-rendered WordPress/Webflow/Wix), escalating to a headless-browser render only when the page is detected as JS-dependent (near-empty initial HTML, SPA framework signatures in the source). This matters for cost: a full headless Chromium render costs several hundred MB of RAM per page, and most NGO sites do not need it — see `docs/decisions/ADR-0003-hosting-topology.md` for why this fallback is an external managed service (Browserless.io) rather than self-hosted, given the 16 GB hosting budget.
- **Storage of every audit run**, not just the latest, so score-over-time and "did our fix actually land" tracking is possible (this feeds Skill 2's remediation-verification loop directly).

## 4. Stack, specs, connectors, APIs

| Component | Recommendation | Why / source |
|---|---|---|
| HTML parsing | `cheerio` (already in use, proven) | Fast, no browser overhead, sufficient for server-rendered pages |
| JS-rendering fallback | Playwright (headless Chromium) | 2026 tooling consensus favors Playwright over Puppeteer for new crawling infra (better multi-browser support, larger ecosystem) |
| Managed headless-browser hosting | Browserless.io, Prototyping ($25/mo, 20k units) or Starter ($140/mo, 180k units, 40 concurrent) tier to start | Avoids owning a browser-pool fleet in Phase 1; revisit self-hosted Fargate/ECS only once volume justifies the ops overhead |
| Self-hosted alternative (later) | `@sparticuz/chromium` + Playwright on AWS Lambda (small scale) or Fargate/ECS (larger scale) | Lambda has a ~250MB deployment-package ceiling and cold-start cost; Fargate avoids that ceiling at the cost of managing containers |
| Crawl queue | BullMQ (Redis-backed) | Standard pattern; lets audits run async and be retried/rate-limited independently per host — already the queue used by `services/workers` |
| Crawl etiquette | Custom identifying User-Agent + contact URL; respect `robots.txt` Crawl-delay (default ~1 req/sec/host if unspecified); cap concurrency at 1-2 connections per host, scale by adding hosts not pressure per host; exponential backoff on 429/5xx honoring `Retry-After` | Keeps SEctOr from getting IP-blocked by the very NGO sites it is trying to help, and is table-stakes good citizenship for a crawler hitting hundreds of small, often fragile hosting setups |
| Storage | Postgres (`Audit`/`Finding` entities), one row per audit run, not an overwrite | Enables score-over-time and remediation-verification |

## 5. What is buildable on day one vs. what needs a later decision

**Buildable now, no external gate**: everything above except the Browserless.io account itself (a commercial signup, not an approval process). This is why Audit Engine is correctly the free, always-on front door, it is the one skill in this list with the least external dependency risk.

**Flagged, not a blocker but worth deciding**: whether the batch weekly re-crawl runs against every onboarded org regardless of plan tier (cost scales with client count) or only for paying/connected clients, with free-tier users getting on-demand audits only. This is a cost/product decision, not a technical one, surface it to the founder before the dev team assumes an answer.

## 6. Success metric

Not "audits run." The metric that matters, per the existing Phase 0 gate, is the **connect-intent rate**: of the orgs that get an audit, what fraction take the next real step (connect an account, book a call, refer someone). The Audit Engine's job is to produce a finding sharp enough that this number is non-zero and improving, not to maximize audit volume for its own sake.
