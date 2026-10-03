#!/bin/sh
# Nightly Postgres backup for the single-VPS deploy (docs/runbooks/uptime-and-backups.md).
# Runs inside the `backup` service (postgres:16-alpine, so pg_dump matches the server).
#   default: loop forever, one dump per day at BACKUP_HOUR_UTC:30
#   --once:  take one dump now and exit (manual backup, or before a risky deploy)
# Dumps are pg_dump custom format (compressed, restorable with pg_restore), written
# to a temp name first so a half-written file never looks like a good backup.
set -eu

DIR=/backups
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
HOUR_UTC="${BACKUP_HOUR_UTC:-21}"   # 21:30 UTC = 03:00 IST

dump() {
  stamp=$(date -u +%Y-%m-%dT%H%MZ)
  file="$DIR/sector-$stamp.dump"
  pg_dump --format=custom --no-owner --file="$file.tmp"
  mv "$file.tmp" "$file"
  echo "$(date -u +%FT%TZ) backup ok: $(basename "$file") ($(du -h "$file" | cut -f1))"
  find "$DIR" -name 'sector-*.dump' -mtime +"$KEEP_DAYS" -print -delete | sed 's/^/pruned: /'
}

mkdir -p "$DIR"
if [ "${1:-}" = "--once" ]; then dump; exit 0; fi

echo "backup service: daily at ${HOUR_UTC}:30 UTC, keeping ${KEEP_DAYS} days in $DIR"
while true; do
  now=$(date -u +%s)
  next=$(date -u -d "$(date -u +%F) ${HOUR_UTC}:30:00" +%s 2>/dev/null || echo 0)
  [ "$next" -le "$now" ] && next=$((next + 86400))
  sleep $((next - now))
  dump || echo "$(date -u +%FT%TZ) BACKUP FAILED" >&2
done
