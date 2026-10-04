# Full report: SEO, website health, UI/accessibility, social and sharing

Date: 2026-10-04 · Status: approved in conversation · Decision record: ADR-0007

## Intent

Paid and pilot organizations (NGOs, CSR teams, foundations, social enterprises) get a detailed, plain-language report on **their own verified website** that they can act on and show to funders. The free taster audit on the homepage stays unchanged and public. Random domains such as google.com can never get a full report.

## Access rules

| Who | Free taster (homepage) | In-app audit | Full report |
|---|---|---|---|
| Anyone | yes, unchanged | no | no |
| Signed-in organization, `free` plan | yes | own profile website only | locked card |
| `pilot` / `paid`, website **not verified** | yes | own website only | verification card |
| `pilot` / `paid`, website **verified** | yes | own website only | **create, view, download** |

- **In-app audits are limited to the organization's own website** (profile `websiteUrl`). The API no longer accepts an arbitrary `url` from signed-in users. This removes "audit any site" from accounts without breaking the first-audit-after-signup flow.
- **Plans:** `organizations.plan` is `free`, `pilot` or `paid`, default `free`. Ops set it after invoicing with `npm run set-plan -- <orgId> <plan>`. There is no payment code, matching the manual-invoicing decision in ADR-0006.
- **Organization type:** signup adds a required "Organization type" (NGO / Trust / Section 8, CSR team, Foundation, Social enterprise), stored on `organization_profiles.org_type`. `set-plan` prints it so ops confirm eligibility before upgrading anyone.

## Website ownership verification

`site_verifications` (one per org): `host` (from the profile website, lower-cased, with `www.` stripped), `token` (random), `method`, `verified_at`. `POST /site-verification/check` tries, in order:

1. **WordPress:** a stored WordPress connection whose site host equals `host`.
2. **Meta tag:** the homepage contains `<meta name="sector-site-verification" content="<token>">`.
3. **DNS:** a TXT record `sector-site-verification=<token>` on `host`.

All fetches go through the existing SSRF guard. Changing the profile website resets verification.

## The report

Created with `POST /reports` (owner or staff; plan `pilot`/`paid`; website verified; at most one report queued or running per org, and 10 per org per day). It runs on the BullMQ queue `report` in the existing worker, **one at a time**, with a timeout of 4 minutes per report.

1. **Crawl:** Playwright (Chromium) loads the homepage and follows same-site links breadth-first, up to **20 pages**, with a 15-second timeout per page. It uses a small built-in crawler rather than Crawlee, which keeps the worker lean.
2. **Per page:** title, meta description, canonical, `h1`/`h2` counts, structured-data types, image alt coverage, word count, status code, and broken internal links found.
3. **Lighthouse** (mobile) on the homepage plus up to 2 key pages: performance, SEO, accessibility and best-practices scores, LCP / CLS / TBT, and the top failed audits.
4. **axe-core** on the homepage: accessibility violations by impact, with counts.
5. **Screenshots:** homepage on desktop and mobile, as small JPEGs embedded in the report.
6. **Social and sharing:** profile links found on the site (Facebook, Instagram, LinkedIn, YouTube, X, WhatsApp); share-preview tags (`og:title`, `og:description`, `og:image`, `twitter:card`); and whether each profile link answers. Follower counts and engagement need each platform's permission and are stated as not included.
7. **Action plan:** every issue becomes an action with impact (high / medium / low), effort (in plain words) and owner ("you", "your web person", "SEctOr on WordPress"), sorted into "Do first", "This month" and "Later".

**Output:** a self-contained HTML report in the SEctOr design system (cover with score and three biggest wins, plain-language summary, the sections, then the action plan), plus a PDF of the same HTML rendered by Playwright (A4, page numbers). Both are stored on the `reports` row (`status`, `error`, `summary` jsonb, `html`, `pdf` bytea). The web app lists reports and polls status. "View" opens the HTML (served with a strict CSP and no scripts) and "Download PDF" streams the PDF. Every query is tenant-scoped.

## Security

- **All browser traffic goes through a local forward proxy** (`--proxy-server`, `<-loopback>` bypass removed) that resolves each host itself and refuses private or reserved addresses using `@sector/shared/net-guard`. This covers Playwright, every sub-resource, and Lighthouse's own Chrome, so a verified site cannot make SEctOr's browser reach internal addresses.
- Chromium runs only in the worker, which has a memory limit; report concurrency is 1.
- Report HTML escapes all scraped text and is served with `Content-Security-Policy: default-src 'none'; img-src data:; style-src 'unsafe-inline'`.

## Infrastructure

The worker image moves from Alpine to Debian slim with Playwright's Chromium and the system dependencies it needs. This is expected to add about 450 MB to the worker image only; api and web are unchanged. Migration `0003` is additive: `organizations.plan`, `organization_profiles.org_type`, `site_verifications`, and `reports`.

## Out of scope

Payments and self-serve upgrades; follower and engagement metrics; scheduled or recurring reports; emailing reports; competitor audits.

## Build order and tests

1. Schema and migration, `set-plan`, org type at signup. Tests: plan defaults; org type required.
2. Verification API with the three methods. Tests: WordPress match, meta tag (mock site), wrong token, other host refused, reset on website change.
3. In-app audit limited to the own website. Test: a signed-in arbitrary `url` is refused.
4. Reports API (gating, limits, tenancy, HTML/PDF serving). Tests: free plan 403, unverified 403, cross-tenant 404, CSP header.
5. Report engine (worker): proxy guard, crawler, page facts, social extraction, action plan, HTML builder, PDF. Unit tests for the proxy refusing private targets, extraction, ranking and escaping; one real end-to-end run against a public site.
6. Web: plan, verification and report cards on Audits; org type at signup. Screenshots at 1280 and 360px.
7. ADR-0007; DESIGN.md unchanged (the report reuses the existing tokens).
