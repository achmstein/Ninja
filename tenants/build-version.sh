#!/usr/bin/env bash
# The customer app's build number and version for this run, for both stores (mobile-deploy.yml,
# run from src/client_app). The number is the run's, offset by 1000 (Chillax's builds from before
# Ninja went up to 183), or the one given in the run's form (GIVEN). The version is pubspec's
# first two parts and that number, 1.1.<number>: Apple closes a version to new builds once it
# has approved it, so each build is a version of its own and a release never waits for a
# pubspec bump. Raise pubspec's first two parts when the app itself moves on.
set -euo pipefail

number="${GIVEN:-$((GITHUB_RUN_NUMBER + 1000))}"
case "$number" in
  ''|*[!0-9]*) echo "::error::The build number is digits only, not '$number'"; exit 1 ;;
esac

series=$(sed -nE 's/^version:[[:space:]]*([0-9]+\.[0-9]+).*/\1/p' pubspec.yaml)
if [ -z "$series" ]; then
  echo "::error::pubspec.yaml has no version to name the build after"
  exit 1
fi

echo "CLIENT_BUILD_NUMBER=$number" >> "$GITHUB_ENV"
echo "CLIENT_BUILD_NAME=$series.$number" >> "$GITHUB_ENV"
echo "Build $number, version $series.$number"
