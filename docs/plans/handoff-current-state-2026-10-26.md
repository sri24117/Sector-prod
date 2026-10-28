# Engineering handoff: current state corrections (2026-10-26)

The founder's "Engineering Handoff: Pricing, Plans and Build Essentials"
(prepared 26 October 2026) sets the right product direction, but its build
status describes the repo as it was around 17 September. Read this note
alongside it. Where the two disagree on what exists, this note wins, because
every line below was checked against `main` at commit `cd3caee`
(PR #21 merged).

This note changes no decisions. Strategy, pricing hypotheses, gates and the
open-decisions list in the handoff still stand, except where a CONFIRMED ADR
already says otherwise (CLAUDE.md §10).

## 1. What actually exists on main

| Area | Handoff says | Actually on main | Where |
|---|---|---|---|
| API | `/health` only | Auth, free audit, signed-in audits, WordPress remediation, Ad Grants (alert-only), content + consent, site verification, full reports, funnel events | `apps/api/src/routes/*.ts`, `apps/api/src/lib/funnel.ts` |
| Web | Placeholder page | Free audit home, signup, login, forgot/reset password, dashboard, audits (findings, WordPress connect, fixes, full report), Ad Grants, content | `apps/web/src/app/*/page.tsx` |
| Database | No migrations; schema typed in `packages/shared` only | Postgres with Drizzle ORM, 4 migrations (`0000`–`0003`), tenant-scoped access via `scopedDb` | `packages/db/src/schema.ts`, `packages/db/drizzle/`, `packages/db/src/tenant-scope.ts` |
| ORM | Prisma (PROPOSED) | Drizzle; swapped during Slice 2 | ADR-0002 "Addendum (Slice 2 build)" |
| Auth | Not built; open decision | First-party: argon2id passwords, opaque server-side sessions (SHA-256 stored, 30 days), roles owner/staff/viewer, ops-issued password reset links | ADR-0005 (CONFIRMED), `apps/api/src/auth/` |
| Billing | Not built | Manual: `organizations.plan` is `free` / `pilot` / `paid`, set by ops with `set-plan`; `pilot` and `paid` unlock the full report | `apps/api/src/scripts/set-plan.ts`, `apps/api/src/routes/reports.ts` |
| Audit engine | Reconstruction, never run on a real NGO site | Same 7 checks (schema 20, AI crawlers in robots.txt 15, llms.txt 5, headings 15, FAQ pairs 20, front-loaded stat 15, freshness 10), now with SSRF guards, redirect handling and a per-process concurrency cap. **There is no record in the repo of it being validated against real NGO sites.** | `services/crawler/src/audit.ts`, `services/crawler/test/` |
| Batch mode | Exists | Exists: `--batch <urls.csv>` reads one URL per line, not "org,url" | `services/crawler/src/index.ts` |
| Headless rendering | Browserless.io, self-hosting would eat RAM | Playwright Chromium runs inside the worker, for paid full reports only: one at a time, 20-page cap, 8-minute limit, 2 GB container limit, seccomp profile. Browserless is not used anywhere in the code. The free audit still uses plain HTTP + cheerio | ADR-0007 (CONFIRMED), `services/workers/src/report/`, `infra/seccomp/` |
| Connectors | All stubs | WordPress is real (Application Passwords + `sector-companion` plugin, https-only). Google Ads, GA4, Search Console, Meta, LinkedIn, X, YouTube, email are still stubs | `packages/connectors/src/`, `plugins/wordpress/sector-companion/` |
| Ad Grants | Gated | Built and tested against fixtures only. Live gateway is `unavailableGateway` until Google Ads API access exists. Never mutates the account | `packages/ad-grants/`, `apps/api/src/routes/ad-grants.ts` |
| Content (Skill 4) | Build now | Built: brand voice, consent records, drafts, approval, export blocked without active consent. Returns 501 until an LLM provider is configured. No image generation (Skill 5) | `apps/api/src/routes/content.ts`, `packages/ai/` |
| Funnel measurement | To build | `audit_run`, `signup_from_audit`, `fix_clicked`, `connect_cta_clicked`, plus a weekly report script | `apps/api/src/lib/funnel.ts`, `apps/api/src/scripts/funnel-report.ts` |
| Ops | Not designed | Nightly `pg_dump` (14 days, same disk), `/health` checks Postgres, deploy runbook, Coolify/Traefik override, pilot onboarding runbook | `docs/runbooks/` |
| Deployment | Caddy domains are placeholders | Served at jyutrix.io behind Coolify's Traefik | `docs/runbooks/deployment-runbook.md`, PR #12 |
| CI/CD | Not designed | Still not designed (go-live checklist: not needed for 0→5 NGOs) | `docs/runbooks/go-live-checklist.md` |

## 2. Tool stack rows to correct

- **ORM:** Drizzle, not Prisma (ADR-0002 addendum).
- **Headless rendering:** self-hosted Chromium in the worker for full reports
  (ADR-0007, CONFIRMED). ADR-0003's Browserless proposal now covers only a
  possible JS-render fallback for the free/in-app audit, and is still
  PROPOSED. The handoff's Browserless costs (§3.4) do not apply today.
- **Hosting:** the handoff assumes a Hostinger KVM 4 (4 vCPU / 16 GB).
  ADR-0007 records production as **2 vCPU / 7.8 GB, shared with Coolify and
  Leadsprint**. HUMAN DECISION REQUIRED: confirm which box production runs on
  and in which country. The legal drafts (PR #20) need the provider and
  region too.
- **Auth:** first-party, CONFIRMED (ADR-0005). Not an open decision.

## 3. Handoff statements that conflict with the code or with each other

1. **FCRA gate field.** The handoff (§3.5.6) gates Ad Grants on a
   self-declared `fcraRegistered` field set at intake. The code gates on
   `organizationProfiles.fcraConfirmedAt`, set only by ops
   (`confirm-fcra` script), never on the self-declaration. Keep the code's
   behaviour: it is stricter, and it matches `docs/security/security.md`.
2. **"Do not start with auth or the schema" / "no login for Phase 0"** (§7).
   Already superseded: both exist. The free audit itself still needs no login.
3. **Free audit cost.** The handoff says each run costs Browserless units and
   LLM tokens (§3.5.7). It costs neither today: HTTP fetch only, no LLM.
   What exists: per-IP rate limit (10 per 10 minutes) and a shared
   concurrency cap. What does not: a per-domain limit or a result cache.
4. **Plans include unbuilt skills.** Starter includes Skill 6 (Researcher),
   Growth adds Skill 3 (social) and Skill 5 (images). None is built, and the
   go-live checklist lists all three as "don't build for 0→5". Under the
   handoff's own rule ("never sell a capability whose flag is off"), pilot
   plans can only contain: free audit, signed-in audits, WordPress schema
   fix (other findings get manual steps), full report, content drafts once
   the LLM is configured, and Ad Grants alerts once Google Ads API access
   lands. HUMAN DECISION REQUIRED: what the pilot plans actually contain.
5. **Ad Grants benchmark card for every visitor** (§7.1) versus "the module
   never renders, with no teaser" (§3.5.6) and PRODUCT.md "never oversell".
   The "Rs 1 crore per year forfeited per organisation" figure assumes the
   full $10,000/month is used. HUMAN DECISION REQUIRED: whether the card
   ships, its exact wording, and the cited source. It must say "estimate".
6. **Batch input format.** The handoff says CSV of org and URL in. The CLI
   reads one URL per line. Fine for the validation run; extend only if the
   founder's 1,000-nonprofit file needs it.

## 4. Still true and still the priority

These handoff items are unchanged by anything built so far:

- Run the crawler on 5 to 10 real NGO URLs and compare with what a person
  sees. Not recorded anywhere in the repo as done.
- File the Google Ads API application (go-live checklist Phase 4).
- Show one real buyer a price before writing more pricing logic. The plan
  and entitlement config tables, metering of LLM calls, and the sponsor/seat
  model are reasonable next designs, but each needs a spec in `docs/plans/`
  first (CLAUDE.md §6), and none should hard-code the handoff's prices.
- Legal minimum before real org data: drafts are in PR #20, waiting on a
  lawyer and the placeholders listed there.
- `docs/integrations/integrations.md` is stale (Google Ads shows NOT STARTED
  with no note that the connector side is built; WordPress and the LLM
  provider have no rows). Already on the go-live checklist, Phase 4.
