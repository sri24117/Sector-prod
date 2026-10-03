# SEctOr — Security Model

## Authentication

HUMAN DECISION REQUIRED: session-based auth with a first-party login
(email/password + argon2 hashing, JWT for API calls) is the PROPOSED default
for Phase 0-1 because it's the smallest thing that works and costs nothing
per user. Alternative: a managed auth provider (Clerk, Auth0) trades
engineering time for a per-user cost and a new external dependency — worth
revisiting once user volume or SSO requirements make it clearly worthwhile,
not before.

## Authorization

Role-based, scoped to organization membership: `owner`, `staff`, `viewer` as
the Phase 0-1 role set (PROPOSED — extend only when a real workflow needs a
finer grain, e.g. a role that can approve Ad Grants spend but not publish
content). Every API route declares the roles allowed to call it; this is
checked in one shared middleware, not reimplemented per route.

## Tenant isolation

This is the single most important guarantee in the system. Every
tenant-scoped table carries `organizationId`. Every database query used by
application code is scoped to the authenticated user's organization —
enforced centrally (a Prisma middleware or equivalent query-scoping helper;
exact mechanism is HUMAN DECISION REQUIRED before the first tenant table
ships, see `docs/architecture/architecture.md` §9), not left to each
route author to remember. A cross-tenant data leak is a stop-everything bug,
not a backlog item.

## Secrets and credentials

- No secret, API key, OAuth client secret, or token is ever committed.
  `.env.example` documents required variables with empty values.
- OAuth tokens (Google, Meta, LinkedIn, X, YouTube) are stored encrypted at
  rest, one connection per organization per provider (see
  `docs/architecture/architecture.md` — `PlatformConnection`). Never reuse
  one organization's token for another organization's request, even
  accidentally via a shared client/cache key.
- Webhook payloads (Meta, Google, payment providers if added later) are
  verified against the provider's signature before being trusted. An
  unverified webhook is discarded, not processed "just in case."

## Sensitive data / DPDP Act

- SEctOr is very likely a **Data Processor**; each client NGO is the **Data
  Fiduciary**. A DPDP-aligned Data Processing Addendum must exist between
  SEctOr and each client — no government template exists to adopt off the
  shelf, so this is a drafting task, not a checkbox (owner: founder/legal,
  not engineering).
- Any beneficiary-identifying asset (photo, name, quote) requires a
  `ConsentRecord` (who consented, when, scope) before it can be used in
  Skill 3 or Skill 4 output. This is a hard gate in the content pipeline, not
  a UI reminder.
- Verifiable parental/guardian consent is required before processing a
  minor's personal data. Any workflow that could touch a beneficiary who is a
  minor needs this designed in, not bolted on later.
- Cross-border transfer: currently unrestricted by default (DPDP's blacklist
  model, nothing blacklisted yet), but the prudent default is: raw
  donor/beneficiary PII stays in India-hosted storage; only de-identified or
  aggregated data is sent to non-Indian LLM APIs.

## Audit logging

Every external action (publish, ad-campaign mutation, email send) and every
access to another organization's data attempt (even a blocked one) is logged
with: organization, user, action, provider, result, timestamp. Avoid logging
secrets or full PII payloads — log references (record IDs), not raw content.

## AI-specific boundaries

The LLM never becomes the source of truth for compliance facts (FCRA status,
Ad Grants CTR/QS), permissions, or financial calculations — those are
deterministic reads from Postgres/connector data. An LLM-drafted piece of
content that names or shows a beneficiary is blocked at the `ConsentRecord`
gate before publish, the same as a human-drafted one.

## FCRA gate (Ad Grants specifically)

Skill 7 (Ad Grants), including read-only compliance monitoring, must never
activate for an organization whose FCRA status is not confirmed true. This is
enforced as a hard check at the start of every Ad Grants workflow, not a
UI-level hide.
