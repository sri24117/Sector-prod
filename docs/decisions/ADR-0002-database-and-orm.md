# ADR-0002: PostgreSQL + Prisma

## Status
CONFIRMED (founder go-ahead given with "continue slice 2") (Postgres is effectively CONFIRMED by every prior spec; Prisma
specifically as the ORM is the part that's genuinely open)

## Context
The data model (`docs/architecture/architecture.md` §11) is relational:
organizations, users, programs, audits, findings, content, connections, all
with real foreign-key relationships, filtering, and reporting needs. No
requirement in any prior spec calls for graph or document storage.

## Decision
PostgreSQL 16 as the primary datastore (already assumed throughout every
skill file, e.g. `SEOAudit` storage in skills/audit-engine.md). Prisma as the
ORM/migration tool, for schema-as-code, generated types, and a migration
history the whole team can read.

## Alternatives
- Document/JSON store (Mongo, DynamoDB): rejected — the data is relational
  and needs constraints, joins, and aggregation (score-over-time, match-to-
  action conversion). JSON columns inside Postgres cover the genuinely
  flexible fields (BrandKit tokens, findings detail) without giving up
  relational integrity everywhere else.
- Drizzle ORM instead of Prisma: a reasonable alternative (lighter runtime,
  closer to raw SQL). PROPOSED default is Prisma for developer experience and
  ecosystem maturity; swap is cheap this early if the team prefers Drizzle.
- A graph database for the Researcher (Skill 6) matching logic: rejected per
  the Protocol's own guidance — no evidence yet that relational queries can't
  express the match logic (org attributes × grant/event criteria).

## Consequences
- Migrations are the single source of truth for schema; no manual DDL against
  production.
- Row-level tenant isolation must be enforced at the query layer (see
  `docs/security/security.md`) since Prisma does not do this automatically.

## Addendum (Slice 2 build)
Swapped Prisma → **Drizzle ORM** during implementation. Reason: Prisma's CLI
(`generate`, `migrate dev`) requires downloading a native engine binary from
`binaries.prisma.sh` at install/build time — not an npm registry package, a
separate CDN. The sandbox this was built in only allow-lists npm/pip/apt
mirrors, so every `prisma generate` call failed with `403 Forbidden` on that
binary fetch, including with the WASM/driver-adapters preview feature (the
CLI itself still needs the binary, only the generated client's runtime engine
is swappable). That meant zero ability to verify anything Prisma-based —
not even a typecheck, since `@prisma/client`'s types don't exist until
`generate` succeeds.

This is very likely a sandbox-specific network restriction, not a real
production/dev-machine problem — Prisma would probably work fine in a normal
environment with unrestricted internet. But per CLAUDE.md §8 ("tests pass is
not feature works, verify the real workflow"), shipping Prisma code that
couldn't be generated, typechecked, or run wasn't acceptable just because it
was probably fine elsewhere. Drizzle needs no native binary — pure TS, works
with the `pg` driver directly, fully verified end-to-end (real migration,
real queries, real cross-tenant-isolation test) in the same sandbox.
Postgres itself (the actual ADR-0002 decision) is unchanged.

If Prisma is genuinely preferred, this is cheap to revert in a normal
network environment — the schema shape (see `packages/db`) ports directly.
