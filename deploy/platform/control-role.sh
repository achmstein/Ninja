#!/bin/bash
# The control plane's own database role. On a fresh box the init script
# creates it with the databases; on a box that predates it, the deploy
# workflow runs this once (it is idempotent) against the running Postgres:
# the role, controldb handed over to it (the database, then every table,
# sequence and type inside, which the migrations made as the superuser),
# and the password kept in step with .env.
#
#   CONTROL_DB_PASSWORD=... bash control-role.sh      (inside the postgres container, as postgres)
#
# Mounted under /docker-entrypoint-initdb.d as zz-control-role.sh, so the
# entrypoint runs it after the databases are created on a fresh box.
set -eu

if [ -z "${CONTROL_DB_PASSWORD:-}" ]; then
    echo "CONTROL_DB_PASSWORD is empty: the control role is not created"
    exit 0
fi
: "${POSTGRES_USER:=postgres}"

# The password is not a valid identifier position: it goes in through psql's -v, quoted by :'pw'
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" -v pw="$CONTROL_DB_PASSWORD" --dbname postgres <<'EOSQL'
SELECT format('CREATE ROLE control LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE', :'pw')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'control')\gexec
ALTER ROLE control WITH LOGIN PASSWORD :'pw';
ALTER DATABASE controldb OWNER TO control;
REVOKE ALL ON DATABASE controldb FROM PUBLIC;
GRANT ALL ON DATABASE controldb TO control;
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname controldb <<'EOSQL'
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT nspname FROM pg_namespace WHERE nspname NOT IN ('pg_catalog', 'information_schema') AND nspname NOT LIKE 'pg\_%' AND pg_get_userbyid(nspowner) <> 'control' LOOP
    EXECUTE format('ALTER SCHEMA %I OWNER TO control', r.nspname);
  END LOOP;
  FOR r IN SELECT n.nspname, c.relname, c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg\_%' AND c.relkind IN ('r', 'p', 'v', 'm', 'S') AND pg_get_userbyid(c.relowner) <> 'control' LOOP
    EXECUTE format('ALTER %s %I.%I OWNER TO control', CASE r.relkind WHEN 'v' THEN 'VIEW' WHEN 'm' THEN 'MATERIALIZED VIEW' WHEN 'S' THEN 'SEQUENCE' ELSE 'TABLE' END, r.nspname, r.relname);
  END LOOP;
  FOR r IN SELECT n.nspname, t.typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
           WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg\_%' AND t.typtype IN ('e', 'd') AND pg_get_userbyid(t.typowner) <> 'control' LOOP
    EXECUTE format('ALTER TYPE %I.%I OWNER TO control', r.nspname, r.typname);
  END LOOP;
END $$;
EOSQL
echo "controldb belongs to role control"
