#!/usr/bin/env bash
# Where and how a business's iOS signing is kept, for fastlane match
# (src/client_app/ios/fastlane), written to $GITHUB_ENV:
#   MATCH_GIT_URL     the one certificates repo every business shares
#   MATCH_GIT_BRANCH  the business's branch in it: its slug
#   MATCH_PASSWORD    its passphrase: HMAC-SHA256(MATCH_MASTER_KEY, "match:<slug>"),
#                     so each business has its own and none is kept anywhere;
#                     a MATCH_PASSWORD already given (its environment's secret) wins
#
#   MATCH_MASTER_KEY=… MATCH_GIT_URL=… tenants/match-env.sh <slug>
#
# Without MATCH_GIT_URL nothing is written, and Fastlane keeps Chillax's
# certificates from before Ninja (Matchfile).
set -euo pipefail

slug="${1:-}"
if ! [[ "$slug" =~ ^[a-z0-9]([a-z0-9]|-[a-z0-9]){2,23}$ ]]; then
  echo "::error::'$slug' is not a business's slug"
  exit 1
fi
out="${GITHUB_ENV:-/dev/stdout}"

if [ -z "${MATCH_GIT_URL:-}" ]; then
  echo "No MATCH_GIT_URL: Fastlane signs with what its Matchfile names"
  exit 0
fi

password="${MATCH_PASSWORD:-}"
if [ -z "$password" ]; then
  if [ -z "${MATCH_MASTER_KEY:-}" ]; then
    echo "::error::Set the repository secret MATCH_MASTER_KEY (or a MATCH_PASSWORD in app-$slug)"
    exit 1
  fi
  password=$(SLUG="$slug" python3 -c 'import hashlib, hmac, os; print(hmac.new(os.environ["MATCH_MASTER_KEY"].encode(), ("match:" + os.environ["SLUG"]).encode(), hashlib.sha256).hexdigest())')
fi
if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::add-mask::$password"; fi

{
  echo "MATCH_GIT_URL=$MATCH_GIT_URL"
  echo "MATCH_GIT_BRANCH=$slug"
  echo "MATCH_PASSWORD=$password"
} >> "$out"
echo "Signing for $slug: branch $slug of $MATCH_GIT_URL"
