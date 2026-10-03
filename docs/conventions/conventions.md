# SEctOr — Engineering Conventions

## Language and tooling

- TypeScript everywhere (`strict: true`, see `tsconfig.base.json`). No `any`
  without a comment explaining why.
- pnpm workspaces + Turborepo for the monorepo. New packages live under
  `apps/`, `packages/`, or `services/` per `docs/architecture/architecture.md`.
- Formatting/linting via Prettier + ESLint, run in CI, not bikeshedded in PR
  review.

## API conventions

- REST-ish JSON API in `apps/api`. Every route validates its input with a
  schema (Zod or equivalent) before touching the database.
- Every response error uses one shape: `{ error: { code, message, details? } }`.
  Never leak a raw database or provider error to the client.
- Every route that touches organization data resolves `organizationId` from
  the authenticated session, never from a client-supplied field, and every
  query includes it.

## Database conventions

- Prisma as the ORM/migration tool (PROPOSED — see ADR-0002). Every migration
  is reviewed for whether it can run against a live database without
  downtime before it ships.
- Every tenant-scoped table: `id`, `organizationId`, `createdAt`, `updatedAt`.
  Soft-delete (`deletedAt`) for anything a human might want to recover,
  hard-delete only where retention policy requires it.
- Every row that represents an external fact (an audit score, a connector
  status) carries enough evidence to answer "why does this row say what it
  says" — a source URL, a timestamp, a raw response reference. This is what
  makes the Experience Ledger and `RemediationLog` patterns actually work.

## Testing conventions

- Test pyramid: unit → integration → API/contract → end-to-end → manual
  verification. Use the smallest level that proves the behavior; don't skip
  integration tests for anything touching tenant isolation or money.
- Every PR touching business logic includes: happy path, at least one
  invalid-input case, and a cross-tenant access attempt that must fail.
- Connector tests run against a recorded fixture (VCR-style) by default, not
  a live external API, so CI doesn't depend on Google/Meta/LinkedIn uptime or
  spend real quota.

## Naming

- Domain terms match the skill files and product spec exactly
  (`Organization`, `Audit`, `Finding`, `RemediationLog`, `ConsentRecord`,
  `BrandKit`, `PlatformConnection`, `ResearchMatch`). Don't introduce a
  synonym for something that already has a name in `docs/product/product.md`.

## Commits and PRs

- Conventional-ish commit messages: `feat:`, `fix:`, `chore:`, `docs:`,
  `refactor:`. One logical change per PR where practical.
- PR description states what changed, why, and what was verified (tests run,
  manual check performed) — not just "implements ticket #12."
