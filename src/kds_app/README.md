# Chillax Kitchen (kds_app)

The kitchen display as a native Android-tablet app: the same board as
`src/kds_web`, on Forui, forked from `src/pos_app`. New orders land on the
board the moment they are confirmed, **Ready** takes a card off it and into
the day's **History** behind the clock icon in the header, and **Bring
back** from there puts a card bumped too early on the board again. A
confirmed order chimes.

Why native rather than the web board on a tablet: the app locks the tablet
into the board (kiosk mode), plays the chime without a first tap, keeps the
screen awake, and signs in once.

## Backend it needs

Nothing new. The board is `GET /api/orders/kitchen` (branch-scoped by
`X-Branch-Id`) and the taps are `PUT /api/orders/{orderId}/ready`
with an `x-requestid` per tap; live updates come from the same
`/hub/notifications` hub kds_web joins (`JoinAdminGroup`). Sign-in is the
password grant against the Keycloak client `kds-app` (added to
`chillax-realm.json` and created on the server by `deploy.yml`); any
account with the Admin, Owner or Cashier role may run it.

Who may work where travels in the token: the owner assigns each Admin or
Cashier its branches on admin_web's Staff page (a `branches` claim), and
every service refuses a request naming another branch. Owners hold every
branch. An account with no branch assigned sees a blocking screen until the
owner assigns one; a changed assignment applies on the next token refresh.

## Run it

Landscape tablet only. The `pos_tablet` AVD (Pixel Tablet, 1280×800 dp) is
the reference device:

```
flutter emulators --launch pos_tablet
```

Against the local AppHost, keep localhost on both sides so Keycloak's issuer
matches, then sign in with a Cashier, Admin or Owner account:

```
adb reverse tcp:5000 tcp:5000
adb reverse tcp:8080 tcp:8080
flutter run --dart-define=REALM=chillax
```

The realm is the AppHost's tenant one; the code has none of its own. A
release build is told everything by a record instead
(`--dart-define-from-file=../../tenants/chillax.json`, see `tenants/README.md`).

If the local Keycloak volume already holds the realm, the new `kds-app`
client is not re-imported: add it in the admin console (clone `pos-app`) or
reset the volume.

Demo mode needs neither backend nor Keycloak — a signed-in kitchen, two
branches, a board of sample orders and one in the history:

```
flutter run --dart-define=KDS_DEMO=true
flutter run --dart-define=KDS_DEMO=true --dart-define=KDS_DEMO_LOCALE=ar
flutter run --dart-define=KDS_DEMO=true --dart-define=KDS_DEMO_EMPTY=true
```

## The board

One grid, as many cards across as the screen fits, oldest order first. A
card shows the order number, where it goes (room, table, counter or
pickup), who it is for, a clock running from confirmation (the time it was
finished, in the history), the lines with their customizations and
instructions, and the customer's note. The clock and border turn amber
after 5 minutes and red after 10, the same tiers as kds_web. A tap moves
the card at once and the board refetches once the server has answered; a
refusal puts it back with the server's reason in a toast.

Theme defaults to dark. Language, theme, settings and sign-out live behind
the header menu.

## Kiosk

Settings → Kiosk mode pins the app so Home, Recents and the notification
shade are out of reach. Silent and complete once the tablet is provisioned
with this app as device owner; otherwise Android shows its screen-pinning
prompt and a swipe can leave. To provision, on a freshly reset tablet with
no Google account added yet:

```
adb shell dpm set-device-owner com.chillax.kds/.KdsDeviceAdminReceiver
```

then install from Play and start kiosk mode from Settings. The choice is
remembered and re-applied on every resume and reboot.

## Layout

```
lib/
  core/
    auth/        Keycloak password grant, token refresh, role gate
    config/      URLs, client id, scopes, poll interval
    network/     dio client (api-version, X-Branch-Id, x-requestid, 401 refresh)
    services/    SignalR, chime, kiosk (platform channel), branches
    providers/   locale, branch
    theme/       Forui slate theme, Inter + Cairo, semantic colours
    widgets/     header, shell, toast, branch switcher
    demo/        the sample board behind --dart-define=KDS_DEMO=true
  features/
    auth/        login screen
    kitchen/     model, repository, provider (poll + optimistic taps),
                 status (urgency + clock), board screen, order card,
                 card grid, history dialog
    settings/    kiosk card
  l10n/          ARB sources (EN + Egyptian Arabic); keys mirror
                 kds_web/src/lib/i18n.ts
android/app/src/main/kotlin/com/chillax/kds/
  MainActivity.kt          lock-task channel
  KdsDeviceAdminReceiver.kt device-owner component
```

## Verify

```
flutter analyze
flutter test
```

Release builds go through `.github/workflows/mobile-deploy.yml`
(`app: kds_app`), which needs the `ANDROID_KDS_*` keystore secrets and a
Play Console app for `com.chillax.kds`.
