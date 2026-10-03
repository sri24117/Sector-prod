# Runbook: uptime alerts and database backups

Both were blocking items in `go-live-checklist.md` Phase 3. Real organisation data (FCRA numbers, encrypted WordPress credentials) must have a backup and someone must hear when the site is down.

## Backups

**What runs:** the `backup` service in `docker-compose.yml` runs `infra/backup.sh`, which takes a `pg_dump` (custom format, compressed) every day at 21:30 UTC (03:00 IST) into `./backups/` on the server and deletes dumps older than 14 days (`BACKUP_KEEP_DAYS`). A file only gets its final name once the dump finished, so a half-written file never looks like a good backup.

**Check it's working:**
```bash
docker compose logs backup | tail -5      # expect a "backup ok: sector-...dump" line per day
ls -lh backups/
```

**Take a backup now** (do this before every deploy that includes a migration):
```bash
docker compose exec backup /bin/sh /backup.sh --once
```

**Restore** (stop the app first so nothing writes during the restore):
```bash
docker compose stop api worker
docker compose exec backup pg_restore --clean --if-exists --no-owner -d sector /backups/sector-<stamp>.dump
docker compose start api worker
```
Practise once on a scratch database before you need it for real:
```bash
docker compose exec postgres psql -U sector -d postgres -c 'CREATE DATABASE restore_test'
docker compose exec backup pg_restore --no-owner -d restore_test /backups/<file>.dump
docker compose exec postgres psql -U sector -d postgres -c 'DROP DATABASE restore_test'
```

### Off-server copy (HUMAN DECISION REQUIRED)

`./backups` lives on the same disk as the database, so it does not survive losing the server. Pick one and set it up on day one:

1. **Your hosting provider's snapshots/backups**, if your plan includes them. Zero setup, but restores the whole server, not one database.
2. **rclone to cloud storage** (Google Drive, Backblaze B2, S3). After `rclone config` creates a remote called `offsite`, add a host cron entry:
   ```
   45 21 * * * rclone copy /opt/sector/backups offsite:sector-backups --max-age 48h
   ```
3. **Pull from another machine you control**, e.g. a nightly `scp` or `rsync` from your own PC.

Also store `CREDENTIAL_ENCRYPTION_KEY` outside the server. Without it the backups restore, but every stored WordPress connection is unreadable.

## Uptime alerts

`GET https://api.<domain>/health` answers `200 {"status":"ok","database":"ok"}` only when the API can query Postgres. It returns `503` with `"status":"degraded"` when the database is unreachable. Docker also health-checks the `api` and `web` containers every 30 seconds (`docker compose ps` shows `healthy` / `unhealthy`).

A check running on the server cannot tell you the server is down, so alerting comes from outside. **Set up a free external monitor** (for example UptimeRobot or Better Stack):

| Monitor | URL | Check |
|---|---|---|
| API and database | `https://api.<domain>/health` | HTTP 200 and keyword `"status":"ok"` |
| Web app | `https://app.<domain>/login` | HTTP 200 |

Use a 5-minute interval, and send alerts to email plus a phone channel you actually watch. When an alert fires: `docker compose ps`, then `docker compose logs --tail 100 api` (or `web`), then `docs/runbooks/incident-crawler-load.md` if the box is under load.

## Ops commands inside the containers

The API image is a slim production build (no repo checkout, no pnpm), so every ops task runs through `npm run` in the `api` container:

| Task | Command |
|---|---|
| Apply migrations | `docker compose run --rm api npm run migrate` |
| Confirm an org's FCRA status | `docker compose exec api npm run confirm-fcra -- <organizationId>` |
| Issue a password reset link | `docker compose exec api npm run reset-link -- <email>` |
| List reset requests | `docker compose exec api npm run reset-link -- --pending` |
| Funnel report | `docker compose exec api npm run funnel` |
