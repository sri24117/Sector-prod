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
3. `docker compose exec backup /bin/sh /backup.sh --once` (once the stack
   has run before), then `docker compose run --rm api npm run migrate`, which
   applies the committed Drizzle migrations in `packages/db/drizzle/`. Never
   run `pnpm db:generate` against production; generate migrations locally
   and commit them. Backups, uptime monitoring and the other in-container ops
   commands: `docs/runbooks/uptime-and-backups.md`.
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

## Variant: a host that already runs Coolify (Traefik owns 80/443)

Production (`194.238.23.243`, `app.jyutrix.io` / `api.jyutrix.io`) shares the box
with Coolify and other apps. Coolify's Traefik (`coolify-proxy`, network
`coolify`) already owns ports 80/443, so SEctOr runs **without** its own Caddy
and Traefik routes to it. Use the override file on every command:

```bash
alias dc='docker compose -f docker-compose.yml -f infra/compose.coolify.yml'
dc build
dc run --rm api npm run migrate
dc up -d
```

`infra/compose.coolify.yml` leaves the bundled Caddy off, publishes no host ports
for Postgres/Redis (so nothing clashes with other apps' databases), and labels
`web`/`api` for Traefik with HTTPS via its `letsencrypt` resolver, plus an
HTTP->HTTPS redirect. `.env` must set `APP_DOMAIN` and `API_DOMAIN`. Certificates
are issued on the first request once DNS points at the server. Tested against
`traefik:v3.6` with Coolify's entrypoint/provider flags.
