#!/usr/bin/env bash
# Nightly backup of everything that holds state on the server: every
# application database in the postgres container (one custom-format dump per
# database, plus the cluster's roles) and Keycloak's H2 files (the users and
# their credentials live there, not in postgres). One dated archive per run,
# pruned after KEEP_DAYS. Installed as a cron job by deploy.yml; the
# backup.yml workflow checks the newest archive every morning and copies it
# off the machine. Restore: see restore.md next to this file.
#
# Environment (all optional):
#   BACKUP_DIR           where archives land          (default /opt/chillax/backups)
#   KEEP_DAYS            archives older are deleted   (default 14)
#   POSTGRES_CONTAINER   the postgres container       (default chillax-postgres-1)
#   KEYCLOAK_CONTAINER   the keycloak container       (default chillax-keycloak-1; skipped if absent)
#   RCLONE_REMOTE        an rclone remote:path to copy the archive to (off if empty)
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/chillax/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-chillax-postgres-1}"
KEYCLOAK_CONTAINER="${KEYCLOAK_CONTAINER:-chillax-keycloak-1}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"

stamp="$(date -u +%Y%m%d-%H%M%S)"
name="chillax-$stamp"
work="$BACKUP_DIR/$name"
archive="$BACKUP_DIR/$name.tar.gz"
in_container="/tmp/$name"

log() { echo "[$(date -u +%H:%M:%S)] $*"; }
die() { log "ERROR: $*"; exit 1; }

# `docker container inspect`, not `docker inspect`: the latter also matches
# images, networks and volumes (there is always a network called "none")
docker container inspect "$POSTGRES_CONTAINER" >/dev/null 2>&1 || die "postgres container '$POSTGRES_CONTAINER' not found"
mkdir -p "$work/postgres"

# A failed run leaves nothing behind: no half-built folder on the host, no
# dump folder in the container
cleanup() {
  docker exec "$POSTGRES_CONTAINER" rm -rf "$in_container" >/dev/null 2>&1 || true
  [ -d "$work" ] && rm -rf "$work"
  return 0
}
trap cleanup EXIT

# The password is the container's own, whatever the .env says today
pg_user="$(docker inspect "$POSTGRES_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_USER=//p')"
pg_user="${pg_user:-postgres}"
pg_password="$(docker inspect "$POSTGRES_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_PASSWORD=//p')"
[ -n "$pg_password" ] || die "POSTGRES_PASSWORD not set on '$POSTGRES_CONTAINER'"

pg() { docker exec -e PGPASSWORD="$pg_password" "$POSTGRES_CONTAINER" "$@"; }

# ── postgres: every database except the templates and the maintenance one ──
databases="$(pg psql -U "$pg_user" -d postgres -Atc "select datname from pg_database where not datistemplate and datname <> 'postgres' order by 1")"
[ -n "$databases" ] || die "no databases found"

# Dump inside the container (binary-safe, no pipe through the host shell),
# then copy the folder out in one go
pg mkdir -p "$in_container"
for db in $databases; do
  log "pg_dump $db"
  pg pg_dump -U "$pg_user" -Fc --no-owner -f "$in_container/$db.dump" "$db"
done
log "pg_dumpall --globals-only"
pg pg_dumpall -U "$pg_user" --globals-only -f "$in_container/globals.sql"
docker cp "$POSTGRES_CONTAINER:$in_container/." "$work/postgres/"

# ── keycloak: the H2 files under /opt/keycloak/data ──
# start-dev keeps the realm and its users in embedded H2; a second process
# cannot open the files while the server runs, so kc.sh export is out and
# the files are copied as they are. H2's store is append-only and
# crash-safe, so a copy taken mid-write opens on the last committed state.
if docker container inspect "$KEYCLOAK_CONTAINER" >/dev/null 2>&1; then
  log "keycloak h2"
  docker cp "$KEYCLOAK_CONTAINER:/opt/keycloak/data/h2" "$work/keycloak-h2"
else
  log "keycloak container '$KEYCLOAK_CONTAINER' not found - skipped"
fi

# ── one archive, a checksum, the newest marked ──
cat > "$work/MANIFEST" <<EOF
taken_at_utc=$stamp
postgres_container=$POSTGRES_CONTAINER
postgres_image=$(docker inspect "$POSTGRES_CONTAINER" --format '{{.Config.Image}}')
postgres_version=$(pg psql -U "$pg_user" -d postgres -Atc 'show server_version')
databases=$(echo $databases)
keycloak_included=$([ -d "$work/keycloak-h2" ] && echo yes || echo no)
EOF
# --force-local: a Windows path (C:/...) reads as a remote host to GNU tar
# otherwise; harmless on the server, needed to rehearse the script from Git Bash
tar --force-local -C "$BACKUP_DIR" -czf "$archive" "$name"
( cd "$BACKUP_DIR" && sha256sum "$name.tar.gz" > "$name.tar.gz.sha256" )
ln -sfn "$name.tar.gz" "$BACKUP_DIR/latest.tar.gz"
ln -sfn "$name.tar.gz.sha256" "$BACKUP_DIR/latest.tar.gz.sha256"

# ── retention ──
find "$BACKUP_DIR" -maxdepth 1 -name 'chillax-*.tar.gz*' -mtime "+$KEEP_DAYS" -print -delete | sed 's/^/pruned /' || true

# ── off-box copy, when a remote is configured on the host ──
if [ -n "$RCLONE_REMOTE" ]; then
  if command -v rclone >/dev/null 2>&1; then
    log "rclone copy -> $RCLONE_REMOTE"
    rclone copy "$archive" "$RCLONE_REMOTE" && rclone copy "$archive.sha256" "$RCLONE_REMOTE"
  else
    log "RCLONE_REMOTE set but rclone is not installed - archive stays on this host"
  fi
fi

log "done: $archive ($(du -h "$archive" | cut -f1))"
