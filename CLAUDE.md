# CLAUDE.md — SEctOr engineering rules

Read this before touching code. If removing a rule below would not cause you
to make a mistake, it doesn't belong here — that test was applied when writing
this file, so keep it that way when editing it.

For methodology (how to work), see
`docs/methodology/AI_ARCHITECTURE_PROTOCOL.md` and
`docs/methodology/AI_ENGINEERING_HANDYBOOK.md`. This file is the short,
repo-specific rule set. It does not repeat that methodology.

## 1. What this is

SEctOr is a digital-visibility platform for NGOs and social enterprises
(India-first). Full context: `PROJECT.md`, `docs/product/product.md`.

## 2. Architecture principles

- Modular monolith. One API, one web app, one worker process, one Postgres,
  one Redis, deployed on a single Docker Compose host. Do not introduce a new
  service, a message bus, or a second database without an ADR — see
  `docs/decisions/`.
- Deterministic code for validation, thresholds, permissions, compliance
  checks with explicit rules, and status transitions. AI (LLM) for
  explanation, summarization, generation, and ambiguous reasoning. Never let
  an LLM output become a high-impact system action (publishing content,
  spending ad budget, deleting data) without a deterministic gate in between.
- Skill files (`skills/*.md`) are domain intelligence — how SEctOr reasons
  about SEO, Ad Grants, content, etc. They are not engineering rules and this
  file does not duplicate them. Read the relevant one before working on that
  domain.

## 3. Tenant isolation (non-negotiable)

Every table that holds organization data has an `organizationId` column.
Every query is scoped to the authenticated user's organization. Every OAuth
token, connector credential, and external-account link belongs to exactly one
organization and is never reused across organizations. If you cannot point to
the line that enforces this for a new query or endpoint, stop and fix that
first — this is the one class of bug this project cannot tolerate.

## 4. External integrations

- All provider-specific logic lives behind a connector in
  `packages/connectors/<provider>/`. Application code calls the connector's
  interface (`connect`, `disconnect`, `health`, `fetch`, `publish`,
  `schedule`, `analytics`), never a provider SDK directly.
- Assume every external call can time out, rate-limit, or fail partially.
  Every write to an external system (publish a post, mutate an ad campaign,
  send an email) must be idempotent — check `docs/architecture/architecture.md`
  §Idempotency before adding one that isn't.
- Several integrations are gated behind partner approval or a paid tier
  (LinkedIn Standard Tier, Meta App Review, Canva Enterprise, Google Ads API
  tier). Current status lives in `docs/integrations/integrations.md`, not in
  code comments — check it before assuming an integration is live.

## 5. Data and compliance

- SEctOr is very likely a DPDP Act Data Processor; each client NGO is the
  Data Fiduciary. Raw donor/beneficiary PII stays in India-hosted storage;
  only de-identified/aggregated data goes to non-Indian LLM APIs.
- Any feature touching a beneficiary photo, name, or quote requires a
  `ConsentRecord` check before that asset can be used or published. This is
  not optional polish — see `docs/security/security.md`.
- Never commit secrets, API keys, OAuth tokens, or `.env`. `.env.example` is
  the template; real values live only in the deployment environment.

## 6. Scope control

- Do the smallest useful change. Do not add a new abstraction, framework,
  service, or dependency because it seems like good practice — only when a
  concrete requirement needs it.
- Do not silently expand a task. "Add SEO audit" does not include "add a CMS"
  or "add a social scheduler." Log the idea in `docs/plans/` instead.
- Do not invent product requirements, business rules, API contracts, or
  database fields that aren't in a spec. Mark what's missing as `UNKNOWN` or
  `HUMAN DECISION REQUIRED` and stop.

## 7. Stop conditions

Stop and ask a human before proceeding when:

- Database schema or auth design needs to change in a way not already
  covered by an approved spec.
- Tenant isolation for a new feature is unclear.
- A destructive operation, a production migration, or a force-push is
  required.
- A new external service or a new architectural pattern seems necessary.
- Existing tests contradict the plan, or the approved plan turns out to be
  wrong mid-build.
- A product decision (pricing, what to promise a client, auto-remediation
  scope) is hiding inside what looks like an engineering task.

## 8. Testing and verification

- Every PR touching business logic includes tests for the happy path, at
  least one failure path, and unauthorized/cross-tenant access.
- "Tests pass" is not "feature works." For anything touching money (Ad
  Grants), publishing, or PII, verify the real workflow before calling it
  done, and say explicitly what was and wasn't verified.

## 9. Git workflow

- Never push to `main` directly. Feature branches, PR, review, then merge.
- Never force-push a shared branch. Never skip a pre-commit/CI hook to make a
  failing check disappear — fix the underlying issue.
- Keep diffs to the scope of the task. A diff review should not need to ask
  "why did this touch that file."

## 10. Source of truth, when things conflict

1. Explicit human decision (this conversation, an approved PR, an ADR marked
   `CONFIRMED`)
2. `docs/product/product.md`
3. `docs/architecture/architecture.md` and `docs/decisions/*.md`
4. This file
5. `skills/*.md`
6. Existing source code and tests
7. General engineering knowledge

Do not resolve a conflict by guessing. Surface it.
