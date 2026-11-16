# ADR-0005: First-party session auth for Phase 0-1

## Status
CONFIRMED (founder go-ahead given with "continue slice 2") — HUMAN DECISION REQUIRED to confirm before the first `User` table
migration ships

Reconfirmed 2026-11-16: stay on first-party auth for the MVP. Migrate to a
managed provider (Clerk) only when the Next.js upgrade is on the table and
managed verification, MFA, social login or enterprise SSO is actually needed.

## Context
SEctOr needs organization-scoped login for NGO staff plus internal
SEctOr-ops accounts. No prior spec commits to a specific auth approach.

## Decision (proposed default)
First-party email/password auth (argon2 password hashing), server-side
sessions or short-lived JWTs for API calls, role stored on the
`Membership` join table (`owner`, `staff`, `viewer`) per organization.

## Alternatives
- Managed auth provider (Clerk, Auth0, WorkOS): faster to stand up SSO/social
  login later, but adds a per-monthly-active-user cost and a new external
  dependency before there's evidence it's needed. Reconsider once the client
  base is large enough that self-managed auth becomes a real maintenance
  burden, or if an enterprise client demands SSO.
- Passwordless (magic link) only: reduces password-reset support burden, but
  adds an email-deliverability dependency on day one. Worth a fast-follow,
  not a blocker for the first pilot cohort.

## Consequences
Engineering owns password reset, session expiry, and brute-force protection
(rate-limit login attempts) in-house rather than delegating to a vendor.
Revisit if support load from auth issues becomes material.

Password-reset links are emailed through Resend
(`packages/connectors/email`, configured by `RESEND_API_KEY` + `EMAIL_FROM`);
delivery is the one part of reset that is not in-house. The ops script
(`apps/api/src/scripts/reset-link.ts --print`) is the fallback when Resend is
unavailable, so a mail-provider outage cannot lock users out of their accounts.
