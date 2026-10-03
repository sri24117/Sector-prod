# SEctOr — Project Handoff

This is the one file to read before opening anything else in this repo. It
exists so the full-stack team has a single, current source for what SEctOr
is, what's actually built versus scaffolded, what's decided versus still
open, and what to build first.

## 0. A direct note on how this repo came to exist

The founder's own `SEctOr_Claude_Project_Structure_and_Spec_Prompt.docx`
designs a deliberate two-pass process: Pass 1 is architecture exploration and
proposal only, no code; a human reviews and approves it; only then does
Pass 2 implement the knowledge/specification layer (`CLAUDE.md`, `docs/`,
templates, ADRs) — and that document says explicitly, twice, "do not
implement application features" and "do not write production application
code."

What got asked for in the same breath as "align to that document" was the
opposite of its own process: the full repo, ready for the team to add code
and start implementing, in one pass, no review gate in between. That's a
real compression of a process the founder designed carefully, not a
technicality. Rather than silently comply with either the letter or refuse
the spirit, here's what actually happened: this repo does Pass 1 and Pass 2
in full (architecture decisions below, `docs/`, `CLAUDE.md`, `skills/`, all
real and ready to review), plus a genuinely useful **scaffold** — folder
structure, config, connector interfaces, a working reconstruction of the
audit engine — but it deliberately stops short of building real application
*features* (auth, tenant-scoped business routes, the actual audit-funnel UI).
Section 14 below (the roadmap) is what Pass 3 looks like, and it should go
through the founder's own Explore → Plan → Human Gate → Build cycle per
feature, not be assumed pre-approved because a scaffold exists.

If "add codes and initiate implementation" meant something more literal —
hand the team a finished MVP — say so directly, and the honest answer is
that wasn't reviewable in one pass without skipping the review gate the
founder's own process exists to enforce.

## 1. What SEctOr is (one paragraph)

A digital-visibility and marketing-automation platform for Indian NGOs and
social enterprises (NGO track first), for-profit with a cause embedded in
the business model. Free audit funnel earns the right to sell deeper
automation. Full product spec: `docs/product/product.md`. Full domain detail:
`skills/*.md` (seven skills — see `skills/README.md`).

## 2. What's real vs. what's scaffolding — read this before assuming anything works

| Layer | Status |
|---|---|
| `docs/`, `CLAUDE.md`, `skills/*.md`, ADRs | **Real, complete, ready to review and use as-is.** This is genuine engineering/product knowledge, not placeholder text. |
| `docker-compose.yml`, Dockerfiles, `package.json`s, `tsconfig`s | **Real, working configuration**, sized specifically to the confirmed KVM hosting spec (§5). Not yet run end-to-end in this session — verify with `docker compose build` before trusting it blindly. |
| `services/crawler/src/audit.ts` | **Real, runnable logic** — a reconstruction of the previously-validated Skill 1 audit checks (schema, robots.txt, llms.txt, headings, FAQ pairs, front-loaded stat, freshness). See the reconstruction note in `services/crawler/README.md`: if the founder still has the original `audit-engine.js` file, diff against it and prefer the original. |
| `apps/api`, `apps/web` | **Boots, has one real route (`/health`) and one real page.** No auth, no database calls, no business logic. This is intentionally a skeleton — Slice 1 in `docs/plans/phase-0-1-roadmap.md` is what fills it in. |
| `packages/connectors/*` | **Real interface, stub implementations.** Every method throws `NotImplementedError` with a pointer to why (usually a partner-approval gate, see `docs/integrations/integrations.md`). Nothing here can actually call Google/Meta/LinkedIn yet. |
| `packages/ai`, `packages/content`, `packages/analytics` | **Real types and structure, no working generation/analytics logic yet.** |
| Database schema / migrations | **Not created.** The conceptual model is in `docs/architecture/architecture.md` §11 — no Prisma schema or migration exists yet. This is deliberate: writing real migrations before ADR-0002 and ADR-0005 are confirmed would be inventing schema ahead of a human decision. |
| Auth | **Not implemented.** ADR-0005 proposes an approach; nothing is built. |

If anyone on the team assumes more of this works than the table above says,
that's the single most likely source of wasted time in week one.

## 3. Reconciling this against everything that came before

Three prior work streams feed this repo, and none of them are duplicated
here wholesale — each is referenced from the right place:

- **The seven-skill architecture** (Audit Engine, SEO/AIO/GEO Implementor,
  Social Content Calendar, Content Creator, Brand/Visual Designer,
  Researcher, Ad Grants) — reconciled against the founder's own uploaded
  Protocol's illustrative 10-file skill sketch in `skills/README.md`. The
  seven-skill version is what was actually researched and scoped; keep it.
- **The India NGO landscape and Global companion research** — not
  reproduced here; both live in the claude.ai project as
  `claude/india-ngo-market-regulatory-research.md` and
  `claude/global-ngo-market-regulatory-research.md`, and their product-facing
  synthesis (India-first go-to-market, DPDP Act obligations, the
  addressable-market band) is folded into `docs/product/product.md` and
  `docs/security/security.md`.
- **The AI Architecture Protocol and Engineering Handybook** — copied
  verbatim into `docs/methodology/`, not paraphrased, since they're
  methodology documents meant to be followed exactly, not summarized.

## 4. Stack decisions (with status — see each ADR for the full reasoning)

| Decision | Status | ADR |
|---|---|---|
| Modular monolith, one Docker Compose stack, not microservices | CONFIRMED | ADR-0001 |
| PostgreSQL 16 | CONFIRMED | ADR-0002 |
| Prisma as ORM | PROPOSED | ADR-0002 |
| TypeScript everywhere, pnpm workspaces + Turborepo | PROPOSED | — |
| Fastify for the API | PROPOSED | — |
| Next.js for the web app | PROPOSED | — |
| Redis + BullMQ for the job queue | CONFIRMED (already specified in skills/audit-engine.md) | — |
| Headless-browser rendering via Browserless.io, not self-hosted | PROPOSED, HUMAN DECISION REQUIRED on tier | ADR-0003 |
| Direct social APIs vs. Ayrshare aggregator | **HUMAN DECISION REQUIRED, unresolved** | ADR-0004 |
| First-party session auth vs. managed provider (Clerk/Auth0) | PROPOSED, HUMAN DECISION REQUIRED | ADR-0005 |
| Email provider (SES/Postmark/Resend) | **HUMAN DECISION REQUIRED, not yet proposed even** | — |
| CI/CD pipeline | **Not designed yet** | — |

## 5. Hosting topology — sized to the actual box, not a guess

Confirmed spec: **4 vCPU / 16 GB RAM / 200 GB NVMe / 16 TB bandwidth,
Docker-based KVM VPS** (~₹1,099/mo intro, ₹2,399/mo renewal per the plan
shown to build this against). `docker-compose.yml` budgets services against
this exactly:

```
proxy (Caddy)   ~0.25 GB
postgres        ~2.0 GB
redis           ~0.6 GB
api             ~1.5 GB
web             ~1.0 GB
worker          ~1.5 GB
                --------
reserved        ~6.9 GB   (of 16 GB — ~9 GB headroom for OS/build/burst)
```

**The one real architectural risk tied to this box**: a self-hosted headless
browser pool for JS-rendering (Playwright/Chromium) would eat several
hundred MB per concurrent page and can starve Postgres/Redis during a crawl
spike. ADR-0003 resolves this by keeping that piece external
(Browserless.io) for Phase 0-1. Don't add a `browser` service to
`docker-compose.yml` without re-reading that ADR and re-budgeting every
other service's memory limit first — see
`docs/runbooks/incident-crawler-load.md` for what it looks like when this
goes wrong.

This constraint is actually good news, not a limitation to route around: it
forces the exact "modular monolith, not microservices" architecture the
founder's own Protocol already prefers. The hosting budget and the
architectural philosophy point the same direction.

## 6. Domain architecture (the seven skills)

See `skills/README.md` for the index and `docs/product/product.md` §Core
capabilities for the one-line summary of each. Full technical detail for
each skill (per-CMS mechanisms, platform gating tables, compliance rules,
data models) lives in the skill file itself — this file does not repeat it.

## 7. AI / Skill architecture

Skill files = domain reasoning (loaded as LLM context via `packages/skills`).
NGO knowledge = Postgres rows about a specific org. Rules = deterministic
TypeScript. LLM = `packages/ai`, used only for explanation, generation, and
ambiguous reasoning — never the source of truth for compliance facts,
permissions, or money. Full detail: `docs/architecture/architecture.md` §5.

## 8. Connector architecture

One folder per provider under `packages/connectors/`, all implementing the
same interface (`connect/disconnect/health/fetch/publish/schedule/
analytics`). Every provider currently throws `NotImplementedError` — see §2.
Gate status per provider (what's blocked, on what, for how long): the living
table in `docs/integrations/integrations.md`.

## 9. Data architecture

Conceptual model in `docs/architecture/architecture.md` §11. No migrations
exist yet — that's ADR-0002 + a real Slice 2 task
(`docs/plans/phase-0-1-roadmap.md`), not something to improvise per-feature.
Tenant isolation (`organizationId` on every tenant table, enforced centrally)
is the one rule in this entire repo marked non-negotiable — see
`docs/security/security.md`.

## 10. Security architecture

Full model: `docs/security/security.md`. Two things that are product/legal
decisions dressed as engineering, called out explicitly so they don't get
silently decided by whoever writes the first migration: the DPDP Data
Processing Addendum (needs drafting, no template exists — owner: founder/
legal) and the FCRA gate on Ad Grants (already a hard rule, not a UI hide).

## 11. Development workflow

Follow `CLAUDE.md` and `docs/methodology/AI_ARCHITECTURE_PROTOCOL.md`
exactly: Explore → Plan → (Human Gate for auth/tenant/destructive/new-
external-service decisions) → Build → Test → Review → Verify → PR → Ship →
Learn. Use `docs/templates/feature-spec.md` before starting a feature, not
after.

## 12. Phase 0-1 roadmap

Five vertical slices, in order, each running through the full workflow
above before the next starts. Full detail: `docs/plans/phase-0-1-roadmap.md`.

1. Audit funnel (URL → crawl → score → findings shown)
2. Organization onboarding + auth
3. Remediation on WordPress (the moat, proven end to end)
4. Ad Grants claim + compliance monitor
5. Content generation + brand visuals, gated by `ConsentRecord`

**Do not build these in parallel or out of order.** Slice 3 needs Slice 1's
output to remediate against; Slice 2 gates everything that needs to know
which organization a request belongs to.

## 13. Source-of-truth map

| Information | Source of truth |
|---|---|
| Engineering rules | `CLAUDE.md` |
| Methodology (how to work) | `docs/methodology/` |
| Product strategy | `docs/product/product.md` |
| Architecture | `docs/architecture/architecture.md` + `docs/decisions/*.md` |
| Domain methodology per skill | `skills/*.md` |
| Integration/gate status | `docs/integrations/integrations.md` (keep this updated as applications are filed) |
| India/global market research | claude.ai project docs (`claude/india-ngo-market-regulatory-research.md`, `claude/global-ngo-market-regulatory-research.md`) |
| NGO-specific facts | Organization data (Postgres, once it exists) |
| Business rules | Application code + feature specs |
| Past outcomes | Experience Ledger (not yet built — see `docs/architecture/architecture.md` §6) |

## 14. AI context strategy (what to load Claude/an agent with, per task type)

- **UI task**: `CLAUDE.md` + `docs/conventions/conventions.md` + the
  relevant feature spec + the actual UI files.
- **Database task**: `CLAUDE.md` + `docs/architecture/architecture.md` +
  ADR-0002 + the relevant schema.
- **A specific skill's feature** (e.g. Ad Grants): `CLAUDE.md` + the feature
  spec + `skills/ad-grants.md` + `packages/connectors/google-ads/`.
- **Security-sensitive task**: `CLAUDE.md` + `docs/security/security.md` +
  `docs/architecture/architecture.md` + the relevant code.

Minimum context that allows a correct decision — not the whole repo, per the
Handybook's own §2/§20.

## 15. Open decisions requiring the founder (consolidated)

1. Auth approach — first-party vs. managed provider (ADR-0005).
2. Social scheduling — direct APIs vs. Ayrshare, pending the reseller-
   approval question being asked directly (ADR-0004).
3. Canva Enterprise — buy in, or stay on AI-image-gen (skills/brand-visual-
   designer.md §6). Current default: stay on AI-image-gen.
4. Ad Grants auto-remediation — alert-only in v1 (recommended) or ship
   direct auto-fix (skills/ad-grants.md §7).
5. Batch re-audit cost policy — weekly for every org regardless of tier, or
   paying/connected clients only (skills/audit-engine.md §5).
6. Email provider — not yet even proposed.
7. CI/CD pipeline — not yet designed.
8. Browserless.io tier — defer until real crawl volume from pilot NGOs is
   known (ADR-0003).

None of these block starting Slice 1. Several (auth, email) block Slice 2.

## 16. Risks worth naming plainly

- **LinkedIn's Standard Tier approval (3-4 months) is the single highest-
  risk external dependency in the whole build.** File it in week one,
  independent of engineering progress on anything else.
- **The Google Ads API access model changed 10 September 2026** — a week
  before the Ad Grants skill spec was written. Re-verify against Google's
  live docs before scoping that work; anything found elsewhere describing
  "developer token tiers" is describing the old model.
- **The 16 GB hosting budget is real, not generous.** A self-hosted headless
  browser pool is the most likely way to blow it — see §5.
- **This repo's `skills/seo-geo-aio-implementor.md`,
  `social-content-calendar.md`, `content-creator-comms.md`,
  `brand-visual-designer.md`, and `researcher.md` are reconstructions**, not
  the exact originally-delivered files (the working session that produced
  the originals had its local files reset). If the founder still has the
  original downloads, diff and reconcile before treating these as final.

## 17. Recommended next step

Read `docs/plans/phase-0-1-roadmap.md` Slice 1 in full, write the feature
spec for it using `docs/templates/feature-spec.md`, and run it through the
approval gate before writing the first line of `apps/web` or `apps/api`
business logic. In parallel (doesn't block engineering): file the Google Ads
API application and the LinkedIn Standard Tier application — both have
multi-week-to-multi-month clocks that should start now, not after Slice 1
ships.
