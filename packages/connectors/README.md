# packages/connectors

One folder per external provider. Each implements `Connector` from
`src/types.ts`. Application code (`apps/api`, `services/*`) imports a
provider's connector by name and never imports a provider SDK directly
outside that provider's own folder — this is what makes it possible to swap
Ayrshare for direct APIs later (see `docs/decisions/ADR-0004-...`) without an
application-wide rewrite.

Before implementing a connector beyond the stub, check
`docs/integrations/integrations.md` — most of these are gated behind a
partner approval or paid tier that has nothing to do with engineering effort.
Implementing a connector against a gate that hasn't cleared just produces
code that can't be exercised; update the tracker first, or build against a
recorded fixture / sandbox account in the meantime.

| Folder | Status |
|---|---|
| `google-ads/` | Stub — see skills/ad-grants.md |
| `google-analytics/` | Stub |
| `search-console/` | Stub |
| `meta/` | Stub — gated, App Review + Business Verification |
| `linkedin/` | Stub — gated, Standard Tier, 3-4 months |
| `x/` | Stub — no gate, real pay-per-use cost |
| `youtube/` | Stub — gated, 100-channel cap pre-verification |
| `email/` | Stub — pick a provider (SES/Postmark/Resend) — HUMAN DECISION REQUIRED, not yet chosen |
