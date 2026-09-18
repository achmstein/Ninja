# Restore

What the nightly backup holds and how to put it back. Read `backup.sh` for
how it is taken.

## Where the backups are

- On the server: `/opt/chillax/backups/chillax-<UTC stamp>.tar.gz` (+ `.sha256`), the last 14 days, `latest.tar.gz` pointing at the newest. Taken by cron at 05:15 UTC (08:15 Cairo, the quietest hour); the log is `backups/backup.log`.
- Off the server: the `Backup` workflow (`.github/workflows/backup.yml`) runs every morning after the cron, checks the newest archive is fresh, and uploads it encrypted as a workflow artifact kept 30 days. Repository → Actions → Backup → the run → Artifacts. Decrypt with the `BACKUP_PASSPHRASE` repository secret:

  ```bash
  gpg --batch --passphrase "$BACKUP_PASSPHRASE" -d chillax-<stamp>.tar.gz.gpg > chillax-<stamp>.tar.gz
  ```

- Optionally a second copy wherever `RCLONE_REMOTE` points, if it was set in `/opt/chillax/backup.env` on the host.

## What one archive contains

```
chillax-<stamp>/
  MANIFEST                 when, which container/image/version, which databases
  postgres/<db>.dump       one pg_dump custom-format file per database
  postgres/globals.sql     roles (pg_dumpall --globals-only)
  keycloak-h2/             Keycloak's H2 files: realm, users, credentials
```

Take a backup by hand any time: `bash /opt/chillax/backup.sh`. Do it before every restore below, so the state being replaced is not lost.

## Restore one database

The common case: one service's data went wrong, everything else is fine. The APIs use EF migrations, so restore a dump taken by the same or an older build of that service; a newer build then migrates it forward on start.

```bash
cd /opt/chillax
tar -xzf backups/chillax-<stamp>.tar.gz -C /tmp
DB=salesdb            # the database
SVC=sales-api         # its service in docker-compose.yaml
PW=$(docker inspect chillax-postgres-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_PASSWORD=//p')

docker compose -f docker-compose.yaml -f docker-compose.caddy.yml stop $SVC
docker cp /tmp/chillax-<stamp>/postgres/$DB.dump chillax-postgres-1:/tmp/$DB.dump
# --clean drops and recreates every object in the dump before loading it
docker exec -e PGPASSWORD="$PW" chillax-postgres-1 pg_restore -U postgres -d $DB --clean --if-exists --no-owner /tmp/$DB.dump
docker exec chillax-postgres-1 rm /tmp/$DB.dump
docker compose -f docker-compose.yaml -f docker-compose.caddy.yml start $SVC
```

`pg_restore` prints a few "does not exist, skipping" notices under `--if-exists`; those are fine. Any other error, stop and read it before starting the service.

## Restore every database

A lost volume, a bad migration across services, a new server.

```bash
cd /opt/chillax
tar -xzf backups/chillax-<stamp>.tar.gz -C /tmp
PW=$(docker inspect chillax-postgres-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_PASSWORD=//p')

# Stop everything that writes; keep postgres up
docker compose -f docker-compose.yaml -f docker-compose.caddy.yml stop $(docker compose -f docker-compose.yaml ps --services | grep -v -e postgres -e eventbus)

docker cp /tmp/chillax-<stamp>/postgres chillax-postgres-1:/tmp/restore
docker exec -e PGPASSWORD="$PW" chillax-postgres-1 psql -U postgres -d postgres -f /tmp/restore/globals.sql
for f in /tmp/chillax-<stamp>/postgres/*.dump; do
  db=$(basename "$f" .dump)
  docker exec -e PGPASSWORD="$PW" chillax-postgres-1 psql -U postgres -d postgres -Atc "select 1 from pg_database where datname='$db'" | grep -q 1 \
    || docker exec -e PGPASSWORD="$PW" chillax-postgres-1 createdb -U postgres "$db"
  docker exec -e PGPASSWORD="$PW" chillax-postgres-1 pg_restore -U postgres -d "$db" --clean --if-exists --no-owner "/tmp/restore/$db.dump"
done
docker exec chillax-postgres-1 rm -rf /tmp/restore

docker compose -f docker-compose.yaml -f docker-compose.caddy.yml up -d
```

`globals.sql` prints `role "postgres" already exists`; that is expected, the role is the container's own. On a brand-new server run the normal deploy first (it creates the postgres container and the empty databases), then this.

Rehearsed 2026-09-18 on a throwaway container: backup, drop one database and restore it, drop every database and restore them all, retention. All passed.

## Restore Keycloak (users, credentials, realm settings)

Keycloak keeps everything in H2 files on its data volume. Replace them with the server stopped.

```bash
cd /opt/chillax
tar -xzf backups/chillax-<stamp>.tar.gz -C /tmp
docker compose -f docker-compose.yaml -f docker-compose.caddy.yml stop keycloak
docker run --rm --volumes-from chillax-keycloak-1 -v /tmp/chillax-<stamp>/keycloak-h2:/restore:ro alpine \
  sh -c 'rm -rf /opt/keycloak/data/h2 && cp -a /restore /opt/keycloak/data/h2 && rm -rf /opt/keycloak/data/tmp/kc-gzip-cache'
docker compose -f docker-compose.yaml -f docker-compose.caddy.yml start keycloak
```

The realm import in the compose file only runs on an empty data directory, so it does not overwrite the restored realm.

## Check a restore worked

- A database: `docker exec -e PGPASSWORD="$PW" chillax-postgres-1 psql -U postgres -d salesdb -Atc 'select count(*) from sales.tickets'` returns the expected count; the service's container logs show it started and applied no unexpected migration.
- Keycloak: sign in to admin_web; the Staff page lists the users.
- The whole site: open a shift on the till, place an order from the app, settle it.

## Rehearse it

Once a quarter, on the dev AppHost rather than the server: run `backup.sh` with `POSTGRES_CONTAINER` set to the dev container, drop one database, restore it from the archive with the single-database steps, and start the service. Ten minutes, and the day it matters nobody is reading this file for the first time.
