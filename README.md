# SEctOr

NGO digital-growth and intelligence platform. For-profit, NGO/social-enterprise
clients, India-first go-to-market.

**Start here:** [`PROJECT.md`](./PROJECT.md) is the master handoff document —
what this is, why it's structured this way, what's real vs. scaffolding, and
what the dev team should build first. Read it before touching code.

**Engineering rules Claude (or any AI coding agent) must follow in this repo:**
[`CLAUDE.md`](./CLAUDE.md).

## Quick start (local dev)

```bash
cp .env.example .env        # fill in DATABASE_URL, POSTGRES_PASSWORD at minimum
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev                    # runs api + web + worker in parallel via Turborepo
```

See docs/runbooks/pilot-onboarding.md for env vars and pilot setup. Postgres and Redis are expected to be running (see `docker-compose.yml`, or
run them locally). The full stack, including the reverse proxy, runs via:

```bash
docker compose up -d --build
```

## Repository map

```
docs/          durable project knowledge (product, architecture, security, ADRs, plans, runbooks)
skills/        domain intelligence — how SEctOr reasons about SEO/GEO, Ad Grants, content, etc.
apps/web/      Next.js dashboard (NGO-facing + internal ops)
apps/api/      Fastify API
packages/      shared libraries: ai/, connectors/, skills/, content/, analytics/, shared/
services/      standalone processes: crawler/, social/, workers/
tests/         cross-cutting test conventions and fixtures
```

See `PROJECT.md` section "Proposed File Tree" for the full annotated tree.
