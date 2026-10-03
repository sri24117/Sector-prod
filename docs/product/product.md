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
