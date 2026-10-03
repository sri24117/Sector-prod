# Feature: Organization onboarding + auth — Slice 2

Per `docs/plans/phase-0-1-roadmap.md` Slice 2. Confirms ADR-0002 (Postgres +
ORM — see its addendum: Drizzle, not Prisma, for sandbox-environment
reasons) and ADR-0005 (first-party session auth) as CONFIRMED, per explicit
go-ahead in conversation history ("continue slice 2").

## Goal
An NGO can create an account (self-declaring FCRA/PAN/12A/80G), and staff
can log in. Two organizations' staff can never see each other's data.

## What's built
- `packages/db`: schema (`organizations`, `organization_profiles`, `users`,
  `memberships`, `sessions`, `security_event_log`), migrated against a real
  Postgres.
- `scopedDb(organizationId)`: the centrally-enforced tenant-scoping
  mechanism security.md requires — hand-written, narrow, per-table methods
  rather than a generic wrapper, so every enforcement point is a reviewable
  line, not trusted to framework magic.
- `apps/api`: `POST /auth/signup` (org + owner user + profile in one
  transaction), `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`.
  argon2id password hashing, opaque server-side session tokens (SHA-256
  hash stored, raw token only in an httpOnly cookie), rate-limited signup/
  login, generic invalid-credentials message (no email-enumeration timing
  leak — a dummy hash is verified against on unknown-email login).
- `requireRole()` middleware exists and is ready, but nothing calls it yet
  — there's no role-gated business route in this slice, only auth itself.
  Wiring it up is trivial once Slice 3 adds one.
- `apps/web`: `/signup`, `/login`, `/dashboard` — real pages, not mocks.
- security.md's audit-logging requirement: every login/signup success and
  failure writes a `security_event_log` row.

## What's verified (not just typechecked)
- Real Postgres installed and migrated in the build sandbox specifically to
  verify this, not assumed correct.
- `packages/db` tenant-isolation test: **8/8 passing** against the live DB,
  including the roadmap's own named exit criterion — an IDOR check
  (org B given org A's real membership id gets `null`, not the row).
- `apps/api` auth tests: **9/9 passing** against the live DB — signup happy
  path, duplicate-email 409, short-password 400, wrong-password and
  unknown-email both 401 with an identical message, cross-tenant `/auth/me`
  (two real orgs, two real logins, each sees only its own org), logout
  actually invalidating the session.
- Manually curl-verified the same flows end-to-end against a running server
  as a second check, including confirming `security_event_log` rows were
  actually written.
- `apps/web` — real `next build` production build succeeds (not just
  `tsc --noEmit`); all 4 routes statically generated.

## Explicitly deferred (named, not forgotten)
1. **Brand-voice intake worksheet.** Roadmap lists it as a Slice 2
   capability, but it's a content-skill feature layered onto onboarding,
   not core to account/auth/tenant-isolation. Scope control per
   CLAUDE.md §6 — added when Skill 4/5 content work actually needs it.
2. **Multi-org-per-user.** Phase 0-1 simplification: exactly one
   `Membership` per `User`, enforced by `authenticate()` refusing (not
   guessing) if a user somehow has zero or more than one. No invite/
   org-switch flow exists. Revisit when a real workflow needs a staff
   member spanning two orgs.
3. **Postgres Row-Level Security as defense-in-depth.** `scopedDb()` is
   application-layer enforcement, matching what ADR-0002 itself specified
   ("enforced at the query layer... since Prisma does not do this
   automatically" — the intended mechanism was always query-layer, not
   RLS). RLS would be a stronger, DB-level backstop but is real added
   complexity (non-superuser app role, per-transaction session variables) —
   worth a follow-up ADR if/when the stakes justify it, not built here.
4. **Password reset / email verification.** No email-sending integration
   exists yet in this repo at all — out of scope until that's decided.
5. **Role UI.** `staff`/`viewer` roles exist in the schema and the auth
   context, but there's no invite-a-staff-member flow yet — signup only
   ever creates an `owner`.

## Testing
See "What's verified" above — automated tests exist at both layers
(`packages/db/test/tenant-isolation.test.ts`,
`apps/api/test/auth.test.ts`), not just manual verification, per
CLAUDE.md §8's requirement for happy path + failure path + cross-tenant
coverage on anything touching business logic.

## Risks
- [ ] `authenticate()` does a DB round-trip (session lookup + membership
      lookup) on every request. Fine at pilot scale; an in-memory session
      cache would matter before real concurrent load — not built now
      (same "don't solve a scale problem this pilot doesn't have"
      reasoning as the billing ADR).
- [ ] No account lockout after repeated failed logins beyond the route-
      level rate limit (5 signups / 10 login attempts per 10 minutes,
      per-IP). Worth revisiting if credential-stuffing becomes a real
      concern at higher scale.

## Rollback
New tables only (`organizations`, `organization_profiles`, `users`,
`memberships`, `sessions`, `security_event_log`) — nothing from Slice 1
was touched. Drop the migration to roll back; no data migration to reverse.
