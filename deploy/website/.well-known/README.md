# App Links / Universal Links association files

These let an installed app open `chillax.site/room/{id}` and
`chillax.site/table/{id}` directly, instead of bouncing through the browser to
`app.chillax.site`. Without them the redirect in the Caddyfile still works, so
QR codes keep functioning — the app just does not intercept them.

Both files must be served over HTTPS from the apex domain, with no redirect.

## `assetlinks.json` (Android) — needs one value filled in

`sha256_cert_fingerprints` must list the SHA-256 fingerprint of the certificate
that actually signs the installed APK.

If the app is distributed through Google Play, that is **Play's** signing
certificate, not your local keystore:

> Play Console → your app → Test and release → Setup → App signing →
> "App signing key certificate" → copy the SHA-256 fingerprint

For a locally signed release build:

```bash
keytool -list -v -keystore <release.keystore> -alias <alias> | grep SHA256
```

List both fingerprints if you sideload locally signed builds *and* ship through
Play. Add the debug keystore's fingerprint too if you want links to verify on
debug builds.

## `apple-app-site-association` (iOS) — complete

Team ID `NT4VMTB8MK` and bundle id `com.chillax.client` are taken from the Xcode
project. No file extension, and Caddy serves it as `application/json` — both are
required by Apple.

## Verifying after deploy

```bash
curl -s https://chillax.site/.well-known/assetlinks.json
curl -sI https://chillax.site/.well-known/apple-app-site-association | grep -i content-type
```

Android verification status on a device:

```bash
adb shell pm get-app-links com.chillax.client
```

Android re-checks the file when the app is installed or updated, so fix the
fingerprint before shipping a build if you want links verified on first install.
