#!/bin/bash
# Reset catalog, ordering, and spaces data (keeps identity, accounts, loyalty, notifications)
# Usage: ./reset-data.sh
#
# This script:
# 1. Drops catalogdb, orderingdb, spacesdb databases
# 2. Recreates them empty
# 3. Restarts the affected services so EF Core migrations + seeders run automatically

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Load env vars
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-postgres}"
DBS_TO_RESET="catalogdb orderingdb spacesdb accountsdb loyaltydb notificationdb"

echo "=== Chillax Data Reset ==="
echo "Databases to reset: $DBS_TO_RESET"
echo "Keycloak users will NOT be affected."
echo ""
read -p "Are you sure? (y/N) " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Cancelled."
  exit 0
fi

echo ""
echo ">> Stopping affected services..."
docker compose stop catalog-api ordering-api spaces-api accounts-api loyalty-api notification-api

echo ""
echo ">> Dropping and recreating databases..."
for db in $DBS_TO_RESET; do
  echo "   Resetting $db..."
  docker compose exec -T postgres psql -U "$POSTGRES_USER" -c "
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$db' AND pid <> pg_backend_pid();
  " > /dev/null 2>&1 || true
  docker compose exec -T postgres psql -U "$POSTGRES_USER" -c "DROP DATABASE IF EXISTS $db;"
  docker compose exec -T postgres psql -U "$POSTGRES_USER" -c "CREATE DATABASE $db;"
done

echo ""
echo ">> Restarting services (migrations + seeders will run automatically)..."
docker compose start catalog-api ordering-api spaces-api accounts-api loyalty-api notification-api

echo ""
echo "=== Done! All data has been reset and reseeded (Keycloak users preserved). ==="
