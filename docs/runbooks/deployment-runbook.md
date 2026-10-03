# Runbook: Deploy to the KVM VPS

## Preconditions
- Docker + Docker Compose installed on the VPS.
- `.env` populated on the server (never committed) — see `.env.example`.
- DNS pointed at the VPS IP for the domain(s) served by `infra/Caddyfile`.

## Steps
1. `git pull` on the server (or push via CI to a deploy target — CI/CD
   pipeline is HUMAN DECISION REQUIRED / not yet built, see Open Decisions
   in `PROJECT.md`).
2. `docker compose build`
3. `docker compose run --rm api pnpm db:migrate deploy` (never `db:migrate dev`
   against production — that can prompt destructively).
4. `docker compose up -d`
5. `docker compose ps` — confirm all services report healthy.
6. Hit `/health` on the API through the public domain to confirm the proxy
   and app are both up.

## Rollback
- `docker compose down` the new build; `git checkout` the previous tag;
  `docker compose up -d --build` again. Database migrations are the risk —
  never ship a migration that isn't backward-compatible with the previous
  application version until the old version is confirmed fully drained.

## Resource watch
Given the 16 GB budget, watch `docker stats` after any deploy that changes
the crawler or worker. If `postgres` or `redis` is ever OOM-killed, see
`docs/runbooks/incident-crawler-load.md` before increasing any container's
memory limit — the fix is almost always concurrency, not more RAM.
