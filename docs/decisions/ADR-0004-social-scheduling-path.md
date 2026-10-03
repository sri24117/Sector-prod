# ADR-0004: Direct per-platform APIs vs. an aggregator (Ayrshare) for Skill 3

## Status
HUMAN DECISION REQUIRED — carried forward from the master spec's open
decisions, not yet resolved

## Context
Skill 3 (Social Media Content Calendar) needs to publish/schedule to
LinkedIn, Instagram, Facebook, YouTube, and X. Direct integration means
clearing LinkedIn's Standard Tier approval (3-4 months) and Meta's App
Review + Business Verification (weeks, unpredictable) independently.
Ayrshare is a pragmatic aggregator alternative, but it is unconfirmed whether
its existing platform approvals actually extend to cover a reseller's
end-clients (i.e., whether SEctOr can publish on behalf of many NGOs under
Ayrshare's own approved app, or whether each NGO still needs its own
clearance underneath).

## Decision
Not yet made. Default assumption for `packages/connectors/*` in the interim:
build the connector interface (`connect/disconnect/health/fetch/publish/
schedule/analytics`) provider-agnostically enough that swapping a direct
integration for an Ayrshare-backed one later is a connector-internal change,
not an application-wide rewrite.

## What needs to happen before this is CONFIRMED
Direct outreach to Ayrshare to confirm the reseller-approval question. Until
answered, do not build client-facing copy that promises LinkedIn/Instagram
scheduling on any specific timeline.

## Consequences of deferring
`packages/connectors/linkedin`, `meta`, `youtube`, `x` currently ship as
interface stubs only (see each folder's README) — real implementation is
blocked on this decision plus the underlying platform approvals in
`docs/integrations/integrations.md`.
