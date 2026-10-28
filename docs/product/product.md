# SEctOr — Product Specification

Status: PROPOSED (synthesized from prior research and founder decisions; not
yet reviewed line-by-line against this exact template by the founder — treat
content as CONFIRMED, format as PROPOSED).

## Problem

Indian NGOs and social enterprises are largely invisible in search and AI
answer engines, and cannot afford or justify an in-house marketing team to
fix it. The Digital for Nonprofits "State of Nonprofits Digitization Report
2025" found an average nonprofit digital-maturity score of 5/10, with over
80% of nonprofits struggling with digital readiness, and only 17% using free
Google Ad Grants budget (leaving an estimated ~₹1 crore per nonprofit in
forfeited grant value annually). Existing agencies and generic marketing
tools are built for commercial businesses, not for the specific compliance,
trust, and resource constraints of a registered nonprofit.

## Users

- **Primary**: comms/marketing staff (often one generalist person, not a
  specialist) at a mid-size to upper-grassroots Indian NGO — resourced enough
  to act on a tool's output, below the threshold where they have in-house SEO
  or ad-ops capacity. This is SEctOr's addressable band; the largest ~200
  NGOs already have agencies, and the smallest, most numerous tier may lack
  budget for any paid tool at all.
- **Secondary**: NGO leadership/founders approving what gets published and
  what budget gets spent (Ad Grants, boosted posts).
- **Internal**: SEctOr's own ops/success team, monitoring client accounts and
  running the free-audit funnel.

## Goals (Phase 0-1)

1. Prove the free audit funnel converts to real next-step actions
   (connect-intent rate), not just audit volume.
2. Ship a genuinely non-half-finished v1: every capability that ships either
   has zero external dependency, or its dependency is confirmed cleared —
   never a silently-promised feature behind an unmet gate.
3. Establish the "execution instead of advice" moat (Skill 2: SEO/GEO fixes
   applied live, not just reported) as the wedge that differentiates SEctOr
   from a generic AI chatbot giving marketing advice.

## Non-goals (Phase 0-1)

- Global/non-India market support (see `docs/decisions/` — India-first is a
  confirmed founder decision; global research exists as pre-work only).
- Full social-scheduling coverage on every platform on day one — LinkedIn and
  Meta are gated behind partner approval processes measured in weeks to
  months; see `docs/integrations/integrations.md`.
- Canva-based design generation — deferred in favor of AI image generation +
  internal brand-token templating (Canva Enterprise gating applies to both
  SEctOr and every client NGO; see ADR and skills/brand-visual-designer.md).
- A general-purpose CRM, billing system, or mobile app.
- Auto-remediation on a live, connected Ad Grants account — ships as
  alert-plus-one-click-apply in Phase 1; full silent auto-fix is a deliberate
  later decision (trust/liability), not a default.

## Core capabilities (the seven skills)

| # | Skill | One-line role |
|---|---|---|
| 1 | Audit Engine | Free, always-on crawl + score of an NGO's search/AI visibility |
| 2 | SEO/AIO/GEO Implementor | Applies the fix live on the client's site (the moat) |
| 3 | Social Media Content Calendar | Plans, schedules, and risk-manages organic social |
| 4 | Content Creator for Communications | Generates PR, reports, case studies, decks, proposals |
| 5 | Brand and Visual Designer | Generates brand-aligned visuals without a Canva Enterprise dependency |
| 6 | Researcher | Surfaces grants, RFQs, events, accelerators and feeds Skills 4/5 |
| 7 | Ad Grants | Claims and continuously monitors Google Ad Grants compliance |

Full detail for each: `skills/*.md`. Cross-cutting shared models
(`ConsentRecord`, `BrandKit`, `PlatformConnection`, `ResearchMatch`,
`RemediationLog`): `docs/architecture/architecture.md` §Data model.

## User workflows (illustrative, not exhaustive)

1. **Free audit funnel**: NGO enters a URL → Audit Engine crawls → score +
   findings shown → CTA to connect an account / book a call / refer someone.
2. **Onboarding**: NGO signs up → FCRA/PAN/12A/80G self-declared → platform
   detected (WordPress/Wix/Webflow/manual) → brand-voice intake worksheet.
3. **Remediation loop**: Audit finds a gap → Skill 2 proposes and (where
   platform allows) applies a fix → re-crawl verifies → `RemediationLog`
   entry shows before/after score.
4. **Content request**: staff asks for a case study / press release / social
   post → Skill 4 (or 3) generates from the brand-voice worksheet, gated by
   `ConsentRecord` if it names or shows a beneficiary.
5. **Grant/event match**: Skill 6 surfaces a relevant grant or conclave →
   spawns a task in Skill 4 (write the application/pitch) or Skill 5 (design
   the accompanying visual).
6. **Ad Grants**: NGO's FCRA status confirmed → guided MCC-invitation
   onboarding → compliance monitor runs on a schedule → alerts, human clicks
   apply.

## Success metrics

- **Top-level (Phase 0 gate)**: connect-intent rate — of audited orgs, what
  fraction take a real next step. Not audit volume.
- Per-skill metrics: audit-score delta per fix (Skill 2), publish success
  rate per platform not just scheduled-vs-published (Skill 3), match-to-action
  conversion rate (Skill 6), account-health trend not just connected-or-not
  (Skill 7).

## Constraints

- FCRA-gated: Ad Grants (Skill 7) must never activate or tease a benefit for
  an org whose FCRA status isn't confirmed true.
- DPDP Act: SEctOr is very likely a Data Processor; each client NGO is the
  Data Fiduciary. Verifiable parental consent required before processing a
  minor's data. See `docs/security/security.md`.
- Hosting: Phase 0-1 runs on a single 4 vCPU / 16 GB RAM Docker VPS. This
  caps concurrent headless-browser rendering and argues for an external
  managed service (Browserless.io) over self-hosting Playwright at this
  stage — see `docs/decisions/ADR-0003-hosting-topology.md`.

## Pricing and plans

**Status: CONFIRMED by the founder, 2026-10-28.** Enforced in code by one shared table
(`packages/shared/src/plans.ts`); the API refuses a locked feature with
`403 plan_required`, and the web app shows a locked state.

### Prices

Rs, quoted "+ GST" (exclusive of 18% GST).

| Plan | Monthly | Annual |
|---|---|---|
| Free | 0 | 0 |
| Starter | 5,999 | 53,999 |
| Growth | 12,999 | 1,16,999 |
| Pro | 21,999 | 1,97,999 |

- Free and Starter launch for real. **Growth and Pro are a founding-member
  waitlist**, not self-serve: ops assigns them by hand, and founding members
  keep their price for 12 months.
- Payments are **manual invoicing only** (ADR-0006). Ops sets the plan with
  `apps/api/src/scripts/set-plan.ts` after invoicing. There is no billing
  code, no Razorpay and no pricing page.
- There are **no monthly report counts**. Caps follow marginal cost, so only
  AI-generated content has an allowance.

### What each plan includes

| Feature | Free | Starter | Growth | Pro |
|---|---|---|---|---|
| Audit score and findings (public audit needs no sign-in); manual fix steps | yes | yes | yes | yes |
| Full report: search and AI visibility, website health, accessibility, social links, action plan, PDF | locked | yes | yes | yes |
| Live WordPress fixes (connect + schema fix) | locked | yes | yes | yes |
| Brand kit, consent records, generated content | locked | yes, 15 pieces a month | yes, no cap yet | yes, no cap yet |
| Researcher (grants and tenders watchlist) | no | no | coming soon | coming soon |
| Manual content calendar: dates, channels, objectives, responsible person, linked draft and readiness | no | yes | yes | yes |
| Automatic social publishing and advanced assisted posting | no | no | coming soon | coming soon |
| Ad Grants monitoring (account link, compliance checks, alerts) | locked | locked | locked | yes |
| Periodic human review by the SEctOr team | no | no | no | coming soon |

- Each plan includes everything in the plan before it. **Pro is everything that is
  live, including new features as they ship.**
- Ad Grants stays behind the existing ops-confirmed FCRA gate, and also needs Google
  Ads API access, which is not yet applied for. Pro does not bypass either.
- Automatic posting to Facebook and Instagram happens only when SEctOr's own
  platform approval clears. LinkedIn is included in Growth once its approval clears.
  No dates are promised. Social scheduling is promised only "as platform approvals clear".
- The generated-content allowance is Starter 15 a month (calendar month, Asia/Kolkata).
  Manual and generated drafts both use the existing piece allowance; edits and repeat downloads do not create extra pieces.
  **TODO (founder):** the Growth and Pro allowances are undecided until real AI cost is
  known. They are unset, meaning no cap, in the table; do not invent a number.
- Legacy plan names `pilot` and `paid` are aliases for Starter, so existing
  organizations keep their access.

### Standalone (a la carte) prices: recorded, not built

Bundles only for now. For reference, monthly, + GST:

| Skill | Price | Notes |
|---|---|---|
| Audit | free always | |
| SEO/GEO Implementor | 4,999 | WordPress only |
| Social Content Calendar | 5,999 | plus a Rs 2,999 LinkedIn add-on for standalone buyers only; hidden or "coming soon" until approval clears |
| Content Creator | 4,999 | 15 pieces a month |
| Brand and Visual Designer | 3,999 | 25 images a month |
| Researcher | 2,499 | |
| Ad Grants | 9,999 | FCRA-registered organizations only |

The seven sum to Rs 32,494 a month; Pro is about 32% off that.

### Coming soon (not built, or manual)

Researcher, automatic posting, image generation (Skill 5) and the
human review. These are labelled "coming soon" and have no gating in code.

### Not built in this decision

Billing, a pricing page, per-skill purchases, per-skill entitlements. Future ideas
are logged in `docs/plans/future-ideas-2026-10.md`.
