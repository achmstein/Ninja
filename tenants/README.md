# Tenant records for the native apps

One file per café whose customer app is built natively (D4 in
`docs/ninja-plan.md`): what a Flutter build of client_app is told about the
stack it talks to. The code carries no tenant of its own; a release build
without a record fails at first use and says which key is missing.

```
APP_BUILDER_SECRET=… PLATFORM_DOMAIN=ninjapp.net tenants/fetch-record.sh chillax
flutter build apk --release --dart-define-from-file=../../tenants/chillax.json
```

The record is fetched, never committed (`tenants/*.json` is written by the
build and left out of git): a stale one would ship an app pointing at a host
that no longer answers.

A platform tenant's record is neither written by hand nor committed: the build
fetches it from the control plane (`fetch-record.sh`, `GET
/api/control/tenants/{slug}/app-config`), made from the tenant's record and the
platform's settings as they are at that moment. It signs in as the
`app-builder` client of the `ninja` realm, whose one role, `AppBuilder`, reads
that and nothing else; `deploy-platform.yml` keeps the client and its secret,
the repository secret `APP_BUILDER_SECRET`. A business the control plane does
not have would build with a file committed here; Chillax is on the platform
now, so there is none, and a build that cannot fetch the record stops. The tenant page's Customer
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
| `GOOGLE_MAPS_ANDROID_KEY`, `GOOGLE_MAPS_IOS_KEY` | client_app only: the platform's Maps SDK keys, as saved on the control panel's Platform page, Google Maps tab, in the record only when the business has Google Maps on (the switch on its record) and the tab has the key. The record is read at build time, so a key changed on the tab reaches the phones only with their next build. Android's goes into the manifest at build time (`android/app/build.gradle.kts` reads it from the defines), iOS's is handed to the SDK at the first map (`ios/Runner/AppDelegate.swift`). Each business's app id (and Android signing SHA-1) must be on the key's restrictions in Google Cloud. Left out, the free OpenFreeMap map |
| `APPLE_ISSUER` | client_app only: `apple-app` for a business's own app (its id, `net.ninjapp.<business>`, set as "Own customer app" on the control plane's record, which gives its realm the `apple-app` provider for it); left out, `apple`, the shared build's |
| `REDIRECT_SCHEME` | client_app, own app only: its id, where a browser sign-in comes back to; the realm's `mobile-app` client takes `{id}://callback` once the id is on the record. Left out, `com.chillax.client`, what the folders declare |
| `APP_ID`, `APP_NAME`, `CUSTOMER_HOST`, `APPLE_TEAM_ID` | client_app, own app only: what `tool/stamp_tenant.dart` stamps into the native folders (the store id, the name under the icon, the App Links host, the team that signs it) |

A business's own app is published under its own Apple developer account
(App Store guideline 4.2.6), with Sign in with Apple on its own App ID, not
grouped with another: Apple gives a person's name once per app, on their
first sign-in, and grouped apps count as one. Its Play app is in its own Play
account too: many near-identical apps in one account is what Play's spam
policy takes down.

## Google Maps

Ninja's Google Maps keys are one set for every business, entered on the
control panel's Platform page, Google Maps tab (kept encrypted in controldb,
shown again only by their last four characters): the server key (Places API
(New) only, restricted to the box's IP) for each stack's address search, the
browser key (Maps JavaScript API only, restricted to `https://*.{domain}/*` and
the businesses' own domains listed on the tab) for the web's Google map while
"web tiles" is on, and the Android and iOS keys (Maps SDK only, restricted to
the apps' packages and signing SHA-1s, and bundle IDs) for the records above.
A business uses them only with Google Maps switched on on its record. Saving a
server key, browser key, web tiles or referrer change re-stamps every business
it reaches (a `maps` job each); the phone keys reach the apps at their next
build. Locally the AppHost's own stack reads the user secrets `Maps:ServerKey`,
`Maps:BrowserKey` and `Maps:WebDomains` instead, since the control plane does
not stamp it.

## A business's own app

The native folders carry Chillax's app. A record with an `APP_ID` is stamped
over them before the build (`src/client_app/tool/stamp_tenant.dart`, run by
`mobile-deploy.yml`; on a dev machine `git checkout -- android ios` undoes
it), and everything that signs and uploads comes from
the business's record on the control plane, its **App** tab (`GET
/tenants/{slug}/app-kit`, put in place by `tenants/fetch-kit.sh`). Nothing is
set per business in GitHub. Once per business:

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
3. **The record.** "Own customer app" set to the id on the control plane,
   and the Apple team ID beside it (the business's developer account, under
   Membership); the build reads them from there. The business's page then
   has an **App** tab.
4. **The App tab**, one card each, every key kept encrypted and never shown
   again:

   | Card | What |
   |---|---|
   | Android upload key | **Generate** for a new app (RSA 2048, 25 years, PKCS12), or **Import existing** for an app already on Play (its keystore, alias and passwords). Its SHA-256 joins the record's Android signing fingerprints by itself. A JKS key cannot be read by the server: its first build reports its fingerprints. Replacing a key asks first, since Play refuses another until it is reset in Play Console |
   | Play Console access | The key file of a service account with release rights on its Play account |
   | App Store Connect key | An API key from its account (App Manager): key ID, issuer ID and the .p8 |
   | Icons | 1024x1024 PNG without transparency, and Android's adaptive foreground (the mark inside its middle two thirds); without an icon the build keeps the cup |
   | Firebase | **Link in Firebase** finds or makes its Android and iOS apps in the platform's Firebase project (the service account on the Platform page's Firebase tab, Firebase Admin on the project, which must be the Google Cloud project of the shared Google sign-in client `GOOGLE_SERVER_CLIENT_ID`), gives Android the upload key's SHA-1 and SHA-256 and the record's fingerprints, and keeps both config files |

   **Check all** tries everything from the server: Apple finds the app with
   the key, Play opens (and drops) an edit with the service account, the
   Firebase files name the app, and the record has the team and Play's
   fingerprint. Google's sign-in OAuth clients (an Android one with Play's
   app signing SHA-1, the iOS one the Firebase file names) are not made by
   the API: check them in Google Cloud the first time.
5. **Kept before the App tab:** a business set up with a GitHub environment
   `app-<slug>` is carried once with the workflow Carry App Secrets (tenant
   `<slug>`): only empty slots on the record are filled, never one already
   set. Its builds then read the record; the environment's secrets stay as a
   fallback for anything the record lacks (the kit's items skip the steps
   that would write them), until deleted by hand. Every read of the kit is
   in the business's audit.
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
   `deploy/platform/Caddyfile`). iOS needs only the Apple team ID from step 3.
   Android needs the SHA-256 fingerprints of the certificates the app is signed
   with: once the first bundle is in Play, App integrity in Play Console shows
   the app signing key's (what installs from the store carry) and the upload
   key's (what the run's APK carries). The upload key's is on the record
   already (step 4); paste the app signing key's into "Android signing
   fingerprints", then press Link again on the App tab so Firebase has it too. Until then a printed QR code opens the web app.
   Android checks the file when the app is installed, so a phone that
   installed it before keeps opening the browser until the app is updated or
   reinstalled; iOS fetches it through Apple's CDN, which can take a day.

The launch screen is plain white in every build.
