# ADR-0001: Modular monolith, not microservices, for Phase 0-1

## Status
CONFIRMED

## Context
SEctOr has seven skills and will eventually integrate ~10 external providers.
It would be easy to reach for one service per skill. The AI Architecture
Protocol explicitly warns against this ("avoid building nine isolated agents
unless there is a real technical reason"), and the actual hosting budget is
one Docker VPS: 4 vCPU / 16 GB RAM / 200 GB NVMe.

## Decision
Build one API application, one web application, one worker process, one
Postgres database, one Redis instance. Domain separation happens through
`packages/*` boundaries in code, not through separate deployable services.
`services/crawler`, `services/social`, `services/workers` are process-level
separations only where a genuinely different runtime shape justifies it
(the crawler needs its own scaling story once headless rendering is
self-hosted; a worker pool needs to scale independently of the API's request
concurrency) — not a service-per-skill split.

## Alternatives considered
- Microservices per skill: rejected. No current evidence of independent
  scaling needs per skill, and it would not fit the 16 GB box even before
  accounting for a headless-browser pool.
- Serverless functions per endpoint: rejected for Phase 0-1. Adds cold-start
  and vendor-lock complexity without a clear win at this scale; revisit only
  if traffic patterns become genuinely spiky.

## Consequences
- Easier to reason about, cheaper to run, matches the hosting spec exactly.
- Requires discipline: a `packages/connectors/meta` import creeping into
  `apps/web` directly (bypassing `apps/api`) is the kind of boundary erosion
  this ADR is meant to prevent. Enforce via code review, not tooling, for now.
- Revisit this decision only with concrete evidence (a specific component
  needs independent scaling or independent deployment cadence), not
  preemptively.
