#!/usr/bin/env bash
# Writes tenants/<slug>.json, the record a business's customer app is built
# from, as the control plane has it now (GET /api/control/tenants/{slug}/app-config),
# signing in as the app-builder client, whose one role reads that and nothing
# else. A business the control plane does not have (404) builds with the record
# committed here, as Chillax does until it moves onto the platform.
#
#   APP_BUILDER_SECRET=… PLATFORM_DOMAIN=ninjapp.net tenants/fetch-record.sh <slug>
#
# Without APP_BUILDER_SECRET or PLATFORM_DOMAIN it keeps the committed record.
set -euo pipefail

slug="${1:-}"
if ! [[ "$slug" =~ ^[a-z0-9]([a-z0-9]|-[a-z0-9]){2,23}$ ]]; then
  echo "::error::'$slug' is not a business's slug"
  exit 1
fi
record="$(cd "$(dirname "$0")" && pwd)/$slug.json"

keep_committed() {
  if [ ! -f "$record" ]; then
    echo "::error::$1, and there is no tenants/$slug.json to build with"
    exit 1
  fi
  echo "$1: building with the committed tenants/$slug.json"
  exit 0
}

if [ -z "${APP_BUILDER_SECRET:-}" ] || [ -z "${PLATFORM_DOMAIN:-}" ]; then
  keep_committed "No APP_BUILDER_SECRET or PLATFORM_DOMAIN"
fi

token=$(curl -sS --fail-with-body --max-time 30 \
  -d grant_type=client_credentials -d client_id=app-builder --data-urlencode "client_secret=$APP_BUILDER_SECRET" \
  "https://auth.$PLATFORM_DOMAIN/realms/ninja/protocol/openid-connect/token" \
  | python3 -c 'import json, sys; print(json.load(sys.stdin)["access_token"])')
echo "::add-mask::$token"

answer=$(mktemp)
code=$(curl -sS --max-time 30 -o "$answer" -w '%{http_code}' -H "Authorization: Bearer $token" \
  "https://control.$PLATFORM_DOMAIN/api/control/tenants/$slug/app-config")
case "$code" in
  200)
    mv "$answer" "$record"
    echo "tenants/$slug.json from the control plane:"
    cat "$record"
    ;;
  404)
    rm -f "$answer"
    keep_committed "$slug is not on the platform"
    ;;
  *)
    echo "::error::The control plane answered $code for $slug's record"
    cat "$answer"
    exit 1
    ;;
esac
