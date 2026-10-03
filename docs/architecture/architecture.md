# SEctOr — Architecture Specification

Status: PROPOSED. Stack choices below are marked individually; nothing here
should be read as CONFIRMED unless tagged so.

## 1. System boundaries

SEctOr is one product experienced as one system by the user, built as a
**modular monolith**: one API application, one web application, one worker
process, one Postgres database, one Redis instance, sharing a single Docker
Compose deployment on one VPS for Phase 0-1. Domain separation happens in
code (packages), not in network topology (services). This is a direct
consequence of two things pointing the same direction: the AI Architecture
Protocol's own preference ("modular monolith over premature microservices"),
and the literal hosting budget (4 vCPU / 16 GB RAM) which cannot comfortably
run a distributed system.

```
                         ┌─────────────┐
                         │   Caddy      │  reverse proxy + TLS
                         └──────┬───────┘
                    ┌───────────┴───────────┐
              ┌─────▼─────┐           ┌─────▼─────┐
              │  apps/web │           │  apps/api │
              │  (Next.js)│──────────▶│ (Fastify) │
              └───────────┘           └─────┬─────┘
                                             │
                        ┌────────────────────┼─────────────────────┐
                        │                    │                     │
                  ┌─────▼─────┐        ┌─────▼─────┐        ┌──────▼──────┐
                  │ Postgres  │        │   Redis    │        │  worker     │
                  │ (state)   │        │ (queue)    │◀──────▶│ (BullMQ)    │
                  └───────────┘        └────────────┘        └──────┬──────┘
                                                                     │
                                          ┌──────────────────────────┼──────────────────────────┐
                                          │                          │                          │
                                   ┌──────▼──────┐          ┌────────▼────────┐        ┌────────▼────────┐
                                   │ services/    │          │ packages/        │        │ external:        │
                                   │ crawler      │          │ connectors/*     │        │ Browserless.io   │
                                   └─────────────┘          └─────────────────┘        │ (headless render) │
                                                                                          └───────────────────┘
```

## 2. Major components

| Component | Responsibility | Status |
|---|---|---|
| `apps/web` | NGO-facing dashboard + internal ops views | PROPOSED: Next.js |
| `apps/api` | HTTP API, auth, org/tenant logic, orchestrates skills | PROPOSED: Fastify + TypeScript |
| `packages/ai` | LLM call wrapper, prompt templates per skill, output validation | PROPOSED |
| `packages/skills` | Loads `skills/*.md` as retrievable domain context for the AI layer | PROPOSED |
| `packages/connectors/*` | One folder per external provider; isolates provider-specific logic | CONFIRMED pattern (see AI Architecture Protocol §13) |
| `packages/content` | Content-generation orchestration for Skill 4 | PROPOSED |
| `packages/analytics` | Reads GA4/Search Console/Ads metrics into a common shape | PROPOSED |
| `packages/shared` | Shared types, validation schemas, utilities | PROPOSED |
| `services/crawler` | Audit Engine (Skill 1) crawl workers | CONFIRMED — extends the already-validated `audit-engine.js` prototype |
| `services/social` | Publishing/scheduling workers per platform | PROPOSED |
| `services/workers` | Generic BullMQ worker process entrypoint (crawl, publish, report jobs run here) | PROPOSED |

## 3. Data flow (one example: the audit funnel)

```
NGO enters URL (web)
  → api validates + enqueues crawl job (Redis/BullMQ)
    → services/crawler fetches (cheerio; escalates to Browserless.io only if JS-dependent)
      → runs the 7 checks (see skills/audit-engine.md)
        → writes an Audit row + Finding rows (Postgres)
          → api pushes result to web
            → web renders score + findings + CTA
```

Every arrow that crosses an external boundary (Browserless.io) must handle
timeout, rate-limit, and failure — see §7.

## 4. Integration boundaries

All external API calls go through `packages/connectors/<provider>`, exposing
only: `connect()`, `disconnect()`, `health()`, `fetch()`, `publish()`,
`schedule()`, `analytics()`. Application code never imports a provider SDK
directly outside that provider's connector folder. See
`docs/integrations/integrations.md` for the live gate-status of each.

## 5. AI boundaries

- Skill files (`skills/*.md`) = how SEctOr reasons about a domain. Loaded as
  context, never treated as executable code.
- NGO knowledge = what SEctOr knows about a specific org (Postgres rows).
- LLM = reasoning/generation engine, called through `packages/ai`.
- Deterministic rules = business logic, thresholds, compliance checks,
  written in TypeScript, not delegated to a prompt.
- Experience Ledger = what happened and what worked (see §6).

**The LLM is never the source of truth for**: database state, business
rules, compliance facts (e.g., FCRA status, Ad Grants CTR), permissions, or
financial calculations. An LLM can draft the explanation of a finding; it
cannot decide whether an account is compliant.

## 6. Experience Ledger

A `RemediationLog`-style pattern generalized across skills:
`Problem → Recommendation → Action → Before Metric → After Metric → Outcome
→ Evidence → Confidence`. Build this incrementally per skill (Skill 2 already
specifies `RemediationLog`); do not build a general recommendation engine on
top of it before the underlying evidence is reliable.

## 7. Failure handling / idempotency

Every external write (publish a post, mutate an Ad Grants campaign, send an
email) follows: `Request → Validate → Idempotency check → Execute → Record
result → Retry if appropriate → Surface failure`. If a new external write
can't answer "what happens if this runs twice," it is not ready to ship.

## 8. Security boundaries

See `docs/security/security.md` for the full model. Summary: every table
holding org data has `organizationId`; every OAuth token/connector credential
belongs to exactly one org; secrets never committed; webhook payloads
verified against the provider's signature before being trusted.

## 9. Tenancy model

Single-database, shared-schema multi-tenancy with an `organizationId` column
on every tenant-scoped table, enforced at the query layer (Prisma
middleware or an equivalent query-scoping helper — HUMAN DECISION REQUIRED on
the exact enforcement mechanism before the first tenant-scoped table is
written). Row-level security in Postgres is a defensible upgrade once the
team has bandwidth; do not block Phase 0-1 on it.

## 10. Deployment model

Single Docker Compose stack on one KVM VPS (4 vCPU / 16 GB RAM / 200 GB NVMe
/ 16 TB bandwidth). See `docker-compose.yml` for the actual service/resource
budget and `docs/decisions/ADR-0003-hosting-topology.md` for why the headless
browser is external rather than self-hosted at this stage. Revisit this
entire section (and consider Fargate/ECS per the original Skill 1 spec) only
once client volume or headless-render volume actually pressures the 16 GB
budget — not before.

## 11. Data model (conceptual — see ADR-0002 before writing migrations)

```
Organization
  ├── User / Membership (role: owner, staff, viewer)
  ├── OrganizationProfile (FCRA/PAN/12A/80G self-declared, platform detected)
  ├── Program → Goal → KPI → Target → Actual → Evidence
  ├── PlatformConnection (per provider: status, gate status, tokens)
  ├── Audit → Finding (Skill 1)
  ├── RemediationLog (Skill 2)
  ├── ContentAsset, ContentPillar, CalendarItem (Skills 3/4)
  ├── ConsentRecord (linked to any beneficiary-identifying asset)
  ├── BrandKit (DTCG-compatible token store; Skills 4/5)
  ├── ResearchMatch (Skill 6 → Skill 4/5 task)
  ├── AdGrantAccount (Skill 7)
  └── ExperienceLedgerEntry
```

Do not add an entity without a concrete consumer. This list already reflects
every skill file's stated data needs — extend it there first, then here.
