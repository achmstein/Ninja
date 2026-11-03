#!/usr/bin/env bash
# Puts in place what a business's own app is signed and uploaded with, as the
# control plane keeps it (GET /api/control/tenants/{slug}/app-kit, the App tab
# of the business's page), signing in as the app-builder client like
# fetch-record.sh. Run from anywhere; paths are the repository's.
#
#   APP_BUILDER_SECRET=… PLATFORM_DOMAIN=ninjapp.net tenants/fetch-kit.sh <slug> android|ios
#   APP_BUILDER_SECRET=… PLATFORM_DOMAIN=ninjapp.net tenants/fetch-kit.sh <slug> report
#
# android: android/app/google-services.json, the upload keystore and
#   android/key.properties, the Play service account (PLAY_STORE_JSON_KEY_PATH)
# ios: ios/Runner/GoogleService-Info.plist, the App Store Connect key (API_KEY_PATH)
# both: tenants/<slug>/icon.png and icon-foreground.png, which tool/stamp_tenant.dart reads
#
# Each item written is said in $GITHUB_ENV (KIT_FIREBASE, KIT_SIGNING,
# KIT_PLAY, KIT_ASC = 1), and the workflow's own steps that would write it from
# the GitHub environment's secrets skip it; an item the kit lacks is left to
# them. Without APP_BUILDER_SECRET or PLATFORM_DOMAIN, or for a business not on
# the platform, nothing is written.
#
# report: after a build, gives the control plane a JKS upload key's
# fingerprints (keytool -list -v), which it cannot read itself; only when the
# kit said they were not known (KIT_FINGERPRINTS_KNOWN=false).
set -euo pipefail

slug="${1:-}"
mode="${2:-}"
if ! [[ "$slug" =~ ^[a-z0-9]([a-z0-9]|-[a-z0-9]){2,23}$ ]]; then
  echo "::error::'$slug' is not a business's slug"
  exit 1
fi
if [[ "$mode" != "android" && "$mode" != "ios" && "$mode" != "report" ]]; then
  echo "::error::Say android, ios or report, not '$mode'"
  exit 1
fi
repo="$(cd "$(dirname "$0")/.." && pwd)"
app="$repo/src/client_app"
env_file="${GITHUB_ENV:-/dev/null}"

if [ -z "${APP_BUILDER_SECRET:-}" ] || [ -z "${PLATFORM_DOMAIN:-}" ]; then
  echo "No APP_BUILDER_SECRET or PLATFORM_DOMAIN: the build keeps its environment's secrets"
  exit 0
fi

python=$(command -v python3 || command -v python)
# A platform deploy restarts the control plane for about a minute: a build started then waits it out
# (502s and refused connections tried again for two minutes) rather than failing at its first step
RETRY="--retry 8 --retry-delay 15 --retry-connrefused"
token=$(curl -sS --fail-with-body --max-time 30 $RETRY \
  -d grant_type=client_credentials -d client_id=app-builder --data-urlencode "client_secret=$APP_BUILDER_SECRET" \
  "https://auth.$PLATFORM_DOMAIN/realms/ninja/protocol/openid-connect/token" \
  | "$python" -c 'import json, sys; print(json.load(sys.stdin)["access_token"])' | tr -d '\r')
if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::add-mask::$token"; fi
control="https://control.$PLATFORM_DOMAIN/api/control/tenants/$slug"

if [ "$mode" = "report" ]; then
  if [ "${KIT_FINGERPRINTS_KNOWN:-true}" != "false" ] || [ ! -f "$app/android/key.properties" ]; then
    echo "The upload key's fingerprints are known: nothing to report"
    exit 0
  fi
  # key.properties is what the kit wrote; keytool reads JKS and PKCS12 alike
  listing=$(cd "$app/android" && "$python" - <<'PY'
import subprocess
props = dict(l.split("=", 1) for l in open("key.properties").read().splitlines() if "=" in l)
print(subprocess.run(["keytool", "-list", "-v", "-keystore", "app/" + props["storeFile"], "-storepass", props["storePassword"], "-alias", props["keyAlias"]],
                     capture_output=True, text=True, check=True).stdout)
PY
)
  body=$(printf '%s' "$listing" | "$python" -c '
import json, re, sys
text = sys.stdin.read()
sha1 = re.search(r"SHA1:\s*([0-9A-F:]{59})", text)
sha256 = re.search(r"SHA256:\s*([0-9A-F:]{95})", text)
if not sha1 or not sha256: sys.exit("keytool did not show the fingerprints")
print(json.dumps({"sha1": sha1.group(1), "sha256": sha256.group(1)}))')
  code=$(curl -sS --max-time 30 $RETRY -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $token" -H 'Content-Type: application/json' \
    -d "$body" "$control/app-kit/report")
  echo "The upload key's fingerprints, given to the control plane: $code"
  [ "$code" = "200" ] || exit 1
  exit 0
fi

answer=$(mktemp)
trap 'rm -f "$answer"' EXIT
code=$(curl -sS --max-time 30 $RETRY -o "$answer" -w '%{http_code}' -H "Authorization: Bearer $token" \
  -H "X-Build-Run: ${GITHUB_REPOSITORY:-local}/${GITHUB_RUN_ID:-0}" \
  "$control/app-kit?platform=$mode")
case "$code" in
  200) ;;
  404)
    echo "$slug is not on the platform: the build keeps its environment's secrets"
    exit 0
    ;;
  *)
    echo "::error::The control plane answered $code for $slug's kit"
    exit 1
    ;;
esac

# The secrets are masked before anything could print them, line by line as GitHub masks; then written
KIT="$answer" APP="$app" TENANTS="$repo/tenants" SLUG="$slug" MODE="$mode" ENV_FILE="$env_file" \
TEMP_DIR="${RUNNER_TEMP:-$(dirname "$answer")}" ACTIONS="${GITHUB_ACTIONS:-}" "$python" - <<'PY'
import base64, json, os

kit = json.load(open(os.environ["KIT"]))
app, tenants, slug, mode, temp = (os.environ[k] for k in ("APP", "TENANTS", "SLUG", "MODE", "TEMP_DIR"))
secret_keys = ["keystore", "keyAlias", "keyPassword", "storePassword", "playServiceAccountJson", "ascPrivateKey"]
if os.environ["ACTIONS"]:
    for key in secret_keys:
        for line in (kit.get(key) or "").splitlines():
            if line.strip(): print(f"::add-mask::{line.strip()}")

said = []
env = []
def write(path, data, binary=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with (open(path, "wb") if binary else open(path, "w", newline="\n")) as f: f.write(data)

if mode == "android":
    if kit.get("googleServicesJson"):
        write(f"{app}/android/app/google-services.json", kit["googleServicesJson"])
        env.append("KIT_FIREBASE=1"); said.append("google-services.json")
    if kit.get("keystore") and kit.get("storePassword"):
        write(f"{app}/android/app/upload-keystore.jks", base64.b64decode(kit["keystore"]), binary=True)
        write(f"{app}/android/key.properties",
              f"storePassword={kit['storePassword']}\nkeyPassword={kit.get('keyPassword') or kit['storePassword']}\nkeyAlias={kit['keyAlias']}\nstoreFile=upload-keystore.jks\n")
        env += ["KIT_SIGNING=1", f"KIT_FINGERPRINTS_KNOWN={'true' if kit.get('fingerprintsKnown') else 'false'}"]
        said.append("the upload key")
    if kit.get("playServiceAccountJson"):
        path = f"{temp}/play-store-key.json"
        write(path, kit["playServiceAccountJson"])
        env += ["KIT_PLAY=1", f"PLAY_STORE_JSON_KEY_PATH={path}"]; said.append("the Play service account")
else:
    if kit.get("googleServiceInfoPlist"):
        write(f"{app}/ios/Runner/GoogleService-Info.plist", kit["googleServiceInfoPlist"])
        env.append("KIT_FIREBASE=1"); said.append("GoogleService-Info.plist")
    if kit.get("ascPrivateKey"):
        path = f"{temp}/api_key.json"
        write(path, json.dumps({"key_id": kit["ascKeyId"], "issuer_id": kit["ascIssuerId"], "key": kit["ascPrivateKey"], "in_house": False}))
        env += ["KIT_ASC=1", f"API_KEY_PATH={path}"]; said.append("the App Store Connect key")

if kit.get("icon"):
    write(f"{tenants}/{slug}/icon.png", base64.b64decode(kit["icon"]), binary=True); said.append("icon.png")
if kit.get("iconForeground"):
    write(f"{tenants}/{slug}/icon-foreground.png", base64.b64decode(kit["iconForeground"]), binary=True); said.append("icon-foreground.png")

with open(os.environ["ENV_FILE"], "a") as f:
    for line in env: f.write(line + "\n")
print(f"From the control plane for {slug} ({mode}): " + (", ".join(said) if said else "nothing yet; the environment's secrets are used"))
PY
