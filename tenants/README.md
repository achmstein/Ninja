# Tenant records for the native apps

One file per café whose customer app is built natively (D4 in
`docs/ninja-plan.md`): what a Flutter build of client_app is told about the
stack it talks to. The code carries no tenant of its own; a release build
without a record fails at first use and says which key is missing.

```
flutter build apk --release --dart-define-from-file=../../tenants/chillax.json
```

A platform tenant's record is neither written by hand nor committed: the build
fetches it from the control plane (`fetch-record.sh`, `GET
/api/control/tenants/{slug}/app-config`), made from the tenant's record and the
platform's settings as they are at that moment. It signs in as the
`app-builder` client of the `ninja` realm, whose one role, `AppBuilder`, reads
that and nothing else; `deploy-platform.yml` keeps the client and its secret,
the repository secret `APP_BUILDER_SECRET`. A business the control plane does
not have builds with its file committed here, as Chillax does until it moves
onto the platform; once it is on, that file can go. The tenant page's Customer
app row still offers App config, to read or to build with by hand.

`mobile-deploy.yml` passes the record named by its `tenant` input to the
customer app's builds. In debug, hosts default to the Aspire AppHost on the
dev machine and only the realm needs saying: `flutter run --dart-define=REALM=chillax`.

The till (`pos_app`) and the kitchen display (`kds_app`) take no record:
one generic build of each serves every café, and a tablet connects to its
own café from inside the app (the QR code on the admin's Apps page, or the
café's address typed). A record still pins them to one stack when that is
wanted, and then they never ask.

| Key | What |
|---|---|
| `API_URL` | The stack's gateway, `https://api.{slug}.{domain}` on the platform |
| `AUTH_URL` | Keycloak's public host, `https://auth.{domain}` |
| `REALM` | The tenant's realm, `{slug}` on the platform |
| `GOOGLE_SERVER_CLIENT_ID` | client_app only: the Web Client ID the realm's Google identity provider uses; leave out for no Google sign-in |
| `APPLE_ISSUER` | client_app only: `apple-app` for a business's own app (its id, `net.ninjapp.<business>`, set as "Own customer app" on the control plane's record, which gives its realm the `apple-app` provider for it); left out, `apple`, the shared build's |
| `REDIRECT_SCHEME` | client_app, own app only: its id, where a browser sign-in comes back to; the realm's `mobile-app` client takes `{id}://callback` once the id is on the record. Left out, `com.chillax.client`, what the folders declare |
| `APP_ID`, `APP_NAME`, `CUSTOMER_HOST`, `APPLE_TEAM_ID` | client_app, own app only: what `tool/stamp_tenant.dart` stamps into the native folders (the store id, the name under the icon, the App Links host, the team that signs it) |

A business's own app is published under its own Apple developer account
(App Store guideline 4.2.6), with Sign in with Apple on its own App ID, not
grouped with another: Apple gives a person's name once per app, on their
first sign-in, and grouped apps count as one. Its Play app is in its own Play
account too: many near-identical apps in one account is what Play's spam
policy takes down.

## A business's own app

The native folders carry Chillax's app. A record with an `APP_ID` is stamped
over them before the build (`src/client_app/tool/stamp_tenant.dart`, run by
`mobile-deploy.yml`; on a dev machine `git checkout -- android ios` undoes
it), and everything that signs and uploads comes from the GitHub environment
`app-<slug>`. Once per business:

1. **Its accounts.** The business enrols with Apple (an organisation needs a
   D-U-N-S number) and opens a Play Console account (an organisation one: a
   new personal account must run a 14-day closed test with 12 testers before
   it may publish), and invites us: Admin on App Store Connect, release
   rights on Play.
2. **Its apps in the stores.** In App Store Connect, the App IDs
   `net.ninjapp.<business>` (Sign in with Apple, Push Notifications,
   Associated Domains) and `net.ninjapp.<business>.ChillaxLiveActivity`, and
   the app on the first. In Play Console, the app with package
   `net.ninjapp.<business>`. Each store's listing, privacy and rating answers
   are filled in by hand the first time.
3. **Its app in Firebase and Google.** Android and iOS apps with that id in
   the platform's Firebase project, the one the notification service pushes
   with, which must be the Google Cloud project of the shared Google sign-in
   client (`GOOGLE_SERVER_CLIENT_ID`): Google's sign-in on Android also needs
   an Android OAuth client there with the package and the SHA-1 of Play's app
   signing key, and on iOS takes the iOS client the Firebase file names.
4. **The record.** "Own customer app" set to the id on the control plane,
   and the Apple team ID beside it (the business's developer account, under
   Membership); the build reads them from there. In this folder only
   `tenants/<slug>/icon.png` (1024x1024, no transparency) and, for Android's
   adaptive icon, `tenants/<slug>/icon-foreground.png` (the mark inside the
   middle two thirds); without an icon the build keeps the cup.
5. **The environment `app-<slug>`** in the repository's settings:

   | | Name | What |
   |---|---|---|
   | secret | `APP_STORE_CONNECT_API_KEY_ID`, `APP_STORE_CONNECT_API_ISSUER_ID`, `APP_STORE_CONNECT_API_PRIVATE_KEY` | An App Store Connect API key from its account (App Manager) |
   | secret | `GOOGLE_SERVICE_INFO_PLIST` | Its iOS app's Firebase file, as it is |
   | secret | `PLAY_STORE_SERVICE_ACCOUNT_JSON` | A service account with release rights on its Play account |
   | secret | `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `ANDROID_STORE_PASSWORD` | Its own upload key (`keytool -genkey`), kept somewhere safe besides |
   | secret | `GOOGLE_SERVICES_JSON` | Its Android app's Firebase file, as it is |

   The repository itself holds what every business shares: none of it is set
   per business. The stamp refuses a Firebase file that is not the
   business's, and the stores refuse another account's keys.
6. **Its iOS signing, nothing to do:** every business's distribution
   certificate and App Store profiles live in one private repo,
   `achmstein/ninja-certificates` (the repository variable `MATCH_GIT_URL`),
   a branch per business named by its slug. Its first build makes them there
   (Fastfile, lane `certificates`): one certificate on its team, and the
   app's and Live Activity's profiles named "Ninja AppStore <id>"; every build
   after reads them. Each branch is encrypted with the business's own
   passphrase, HMAC-SHA256 of the repository secret `MATCH_MASTER_KEY` and
   its slug (`match-env.sh`), so no passphrase is kept anywhere; a
   `MATCH_PASSWORD` in its environment would win. The repository secret
   `MATCH_GIT_BASIC_AUTHORIZATION` reads and writes that repo (base64 of
   `achmstein:<token>`, a fine-grained token with Contents read and write on
   it alone). The workflow Initialize Fastlane Match does the same ahead of a
   build. Apple allows a team a few distribution certificates: never delete a
   business's branch, or the next build makes another.
7. **The first build:** run Build and Deploy Mobile Apps with app
   `client_app` and tenant `<slug>`. iOS lands in TestFlight. Play refuses an
   API upload until the app's first bundle went in by hand: take
   `client-app-android-aab` from the run, upload it in Play Console, and the
   next runs upload by themselves (internal track, as a draft).
8. **Its QR codes opening the app.** The edge answers
   `/.well-known/assetlinks.json` and `/.well-known/apple-app-site-association`
   on the business's customer host (`{slug}.{domain}` or its own domain) from
   its record, through the control plane (the `app_links` snippet in
   `deploy/platform/Caddyfile`). iOS needs only the Apple team ID from step 4.
   Android needs the SHA-256 fingerprints of the certificates the app is signed
   with: once the first bundle is in Play, App integrity in Play Console shows
   the app signing key's (what installs from the store carry) and the upload
   key's (what the run's APK carries); paste both into "Android signing
   fingerprints" on the record. Until then a printed QR code opens the web app.
   Android checks the file when the app is installed, so a phone that
   installed it before keeps opening the browser until the app is updated or
   reinstalled; iOS fetches it through Apple's CDN, which can take a day.

The launch screen is plain white in every build.
