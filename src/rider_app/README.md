# ninja Rider (rider_app)

The business's own riders, on their phones: the deliveries the till gives
them, the way to each door, and the cash to collect. Android only, on
Forui, forked from `src/kds_app` (same connect screen, sign-in, theme,
live hub and self-update).

What a rider does in it:

- **On duty / off duty** in the header. While on duty the app tells the
  till so every few minutes (`PUT /api/orders/riders/me`), and the till's
  rider picker lists riders on duty first.
- **To deliver**: each delivery given to them, oldest first, with the
  customer, the address and the note that finds the door, the bag's
  contents, the cash to collect, **Navigate** (Google Maps) and **Call**,
  and one big button: **I'm on the way**, then **Delivered** (asked once,
  since it hands over the cash).
- **Delivered today**, and the cash in their pocket until the till takes it
  in (the till's **Take cash** settles the bill).

## Backend it needs

- `GET /api/orders/deliveries/mine`, `PUT /api/orders/{id}/delivery/out`,
  `PUT /api/orders/{id}/delivery/delivered`, `PUT /api/orders/riders/me`,
  all under the **Rider** policy (Admin, Owner or Rider, with the branch in
  `X-Branch-Id`).
- Live updates: the `/hub/notifications` hub puts every connection in its
  account's `user:{sub}` group, where `DeliveryChanged` is sent.
- Push: `POST/DELETE /api/notifications/subscriptions/rider-deliveries`,
  on the `high_priority_channel` the app creates.
- Sign-in: the password grant against the Keycloak client `rider-app`,
  added to the realm template and to existing realms at their next
  upgrade. The owner adds riders on admin_web's Staff page (role **Rider**)
  and gives each their branches.

## Push needs Firebase

The repo's Firebase project has no Android app for `com.ninja.rider` yet.
Register one in the Firebase console and drop its `google-services.json` in
`android/app/` (or let CI write it): until then the app builds and runs
without pushes or crash reports, and the hub and a 30-second poll bring the
deliveries.

## Run it

```
flutter run --dart-define=REALM=chillax
```

against the local AppHost (with `adb reverse tcp:5000 tcp:5000` and
`adb reverse tcp:8080 tcp:8080`), or connect to a business the way a phone
would, from its address or the code on the admin's Apps page.

## Icons

The launcher icon is the platform's N on a teal tile (`#0D9488`, so a
rider's phone shows its own at a glance), and the splash the `ninja | RIDER`
lockup. Both come from `src/scripts/generate-app-icons.mjs`, then
`dart run flutter_launcher_icons && dart run flutter_native_splash:create`.

## Delivery is an add-on

A business buys delivery from the platform. Where it has not (or the owner
switched it off), the app says the business does not deliver and asks for
nothing.
