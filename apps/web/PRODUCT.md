# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Primary: the one generalist comms/marketing person at a mid-size to upper-grassroots Indian NGO or social enterprise. Not an SEO or ad-ops specialist. Often opens an audit link on a phone first, frequently late after a full day of program work. They are handing FCRA/PAN details and WordPress admin credentials to a product they have likely never heard of.

Secondary: NGO leadership approving what gets published and what ad budget is used. Internal: SEctOr's ops team running the free-audit funnel and monitoring client accounts.

## Product Purpose
Make Indian NGOs visible in search and AI answer engines without an in-house marketing team. A visitor pastes a URL and within seconds gets a 0-100 visibility score with a plain-language breakdown; signed-in organisations get fixes applied, Ad Grants compliance monitoring, and consent-safe content drafts. Success for Phase 0-1 is the free audit converting into real next-step actions (connect intent), not audit volume.

## Positioning
Execution instead of advice: SEO/GEO fixes are applied live to the NGO's own WordPress site and re-verified by a re-crawl, rather than reported as a to-do list. Built around nonprofit-specific constraints (FCRA-gated Ad Grants, DPDP, beneficiary consent) that generic marketing tools ignore.

## Operating Context
Routes: `/` (free audit), `/signup`, `/login`, `/dashboard`, `/audits` (audit history, findings, WordPress connection, fixes), `/ad-grants` (FCRA-confirmed orgs only), `/content` (brand voice, consent records, AI drafts, approve/export). Roles: owner, staff, viewer.

## Capabilities and Constraints
- Audit checks: structured data, AI crawlers in robots.txt, llms.txt, heading hierarchy, FAQ pairs, front-loaded stat, freshness. Raw HTML only; JS-heavy sites may under-score, and the UI must say so.
- FCRA/PAN/12A/80G are self-declared and not verified by SEctOr; copy must never imply verification.
- Only the `schema` finding has a live WordPress fix; other findings get manual fix steps.
- Content export is blocked without an active consent record for every named beneficiary; drafts require human approval.
- Ad Grants live data is pending Google Ads API access; content generation is unavailable until an LLM provider is configured. Unavailable features say so plainly.

## Brand Commitments
Name is written "SEctOr". The binding visual system is `docs/design/design-system.pdf` (followed exactly, confirmed 2026-10-03). Voice: a careful, precise colleague, not a growth team. Buttons say exactly what happens ("Run free audit", "Apply fix to my WordPress site", "Record consent"). Errors state what happened and what to do, without apology or alarm. Never oversell.

## Evidence on Hand
No customers, testimonials, case studies, or benchmarks exist yet. Do not fabricate any.

## Product Principles
1. Trust before persuasion: every screen should make handing over credentials feel safe and competent.
2. The score is the moment: the audit result is the product's defining interaction.
3. Never half-finished: a gated or unbuilt capability is stated as unavailable, never implied.
4. Guidance, not alarm: a failing check is something to fix, not an emergency.

## Accessibility & Inclusion
WCAG AA contrast everywhere, visible keyboard focus on every interactive element, fully usable at 360px width, `prefers-reduced-motion` respected, and pass/fail never conveyed by colour alone.
