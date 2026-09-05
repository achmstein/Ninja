# Chillax POS (`pos_app`)

The till as a native Android-tablet app: the same screens as `src/pos_web`
(React + shadcn/ui), built on Forui so the look matches by construction, plus
what a browser cannot do — ESC/POS printing over the café LAN, a cash-drawer
kick, a locked-down (kiosk) tablet, and later an offline sales queue.

Forked from `src/admin_app` (Riverpod, GoRouter, dio, signalr_netcore, ARB
l10n in Egyptian Arabic); the till-specific parts live under
`lib/features/{floor,sale,ticket,tickets,shifts,receipts}`.

## Backend it needs

Sales and Ordering from this branch: Sales idempotency on every mutation
(`x-requestid`), the backdated settle with a provisional receipt number
(Sales migration `TicketProvisionalReceipt`), and the replayed POS order
path in Ordering. Deploying the till before those means offline sales
cannot be replayed.

## Run it

Landscape tablets only. Create one once:

```
flutter emulators --create --name pos_tablet   # Pixel Tablet profile
flutter emulators --launch pos_tablet
```

### Design-time (no backend)

```
flutter run --dart-define=POS_DEMO=true
```

A signed-in cashier, two branches, a menu, tables and a floor of sample
bills — the whole floor → pad → charge → settle loop runs with no backend,
so screens can be compared against pos_web and shot for the store listing.
Add `--dart-define=POS_DEMO_LOCALE=ar` to start in Arabic.

### Against the local AppHost

The app talks to `localhost:5000` (mobile-bff) and `localhost:8080`
(Keycloak) in debug builds. Forward both from the emulator so the token
issuer matches what the APIs validate:

```
adb reverse tcp:5000 tcp:5000
adb reverse tcp:8080 tcp:8080
flutter run
```

Sign in with a staff account that holds the `Cashier`, `Admin` or `Owner`
role (the backend's `Pos` policy). The Keycloak client is `pos-app`
(`chillax-realm.json`; upserted on prod by `deploy.yml`).

## Printer and cash drawer

Settings (header menu → Settings) takes the address of an 80 mm network
thermal printer on the café LAN; it is spoken to on the raw ESC/POS port
(9100) with no driver. Receipts are rendered as an image
(`lib/features/receipt/receipt_sheet.dart`, painted off screen by
`lib/core/printing/widget_rasterizer.dart`) so Arabic and the layout come out
identically on any make. A cash settle prints the receipt and kicks the
drawer through the printer's RJ11 port; Print on a settled bill reprints it.
"Test print" and "Open drawer" in Settings check the wiring.

## Offline sales

When the backend cannot be reached, a counter sale is still rung up and
paid: the pad prices it with the branch's cached VAT rules, the settle
dialog takes cash, card or InstaPay (an account tab needs the server), the
receipt prints with a temporary number (`P-0001`, …) and the sale waits on
the till. The header shows "Offline · N sales waiting"; the moment any call
gets through again the queue replays in order — the POS order dated when it
was sold and confirmed on arrival, then the settle dated the same, carrying
the temporary number so the two receipts match. A sale the server refuses
stays in Settings → Offline sales with its reason, to retry or discard.
Everything else (tickets on the floor, shifts, refunds, rooms) needs the
network and says so.

To walk the flow without pulling a cable:

```
flutter run --dart-define=POS_DEMO=true --dart-define=POS_DEMO_OFFLINE=true
```

## Kiosk (locked-down tablet)

Settings → Kiosk mode pins the app with Android lock-task: Home, Recents
and the notification shade are gone until the till unpins, and the choice
is re-applied on every resume. It is silent and complete only when the app
is the tablet's device owner, which takes a one-time provisioning on a
freshly reset device (no Google account added yet):

```
adb shell dpm set-device-owner com.chillax.pos/.PosDeviceAdminReceiver
```

then install the release build from the Play internal track and turn on
Kiosk mode in Settings. Without device-owner rights the same switch only
shows Android's screen-pinning prompt, and a swipe can leave.

To inspect the bytes without a printer, point the address at the dev
machine and listen there: `nc -l 9100 > receipt.bin`; `xxd receipt.bin |
head` shows `1b 40` (reset), `1d 76 30` (raster bands), `1d 56 01` (cut) and,
for cash, `1b 70 00 19 fa` (drawer).

## Layout

- `lib/core/` — auth (Keycloak password grant), `ApiClient` (api-version,
  `X-Branch-Id`, `x-requestid` idempotency), SignalR, theme (Forui slate,
  Inter + Cairo), router, the header, keypad and toast; `printing/` — ESC/POS
  builder, 1-bit raster, LAN printer, off-screen rasterizer, print service
  and the persisted printer address.
- `lib/features/tickets/` — Sales.API models and repository (open tickets,
  ticket, ticket-by-order, open, settle, discard).
- `lib/features/floor/` — the floor: the places column (rooms, tables, new
  tab) beside the open bills by last activity.
- `lib/features/sale/` — the item pad and the running sale; charging posts a
  POS order and lands on the ticket it opened.
- `lib/features/ticket/` — the ticket screen (merged and per-customer lines,
  select → assign customer / move lines, sticky total), the settle, discard,
  void, refund and move-target dialogs.
- `lib/features/shifts/` — the drawer shift: header chip and panel (with
  the taking-orders / taking-reservations pause switches), open, pay in /
  pay out, close with the Z, history and detail, the printed X/Z.
- `lib/features/receipts/` — closed bills by receipt number, back to any
  one of them to reprint or refund.
- `lib/features/orders/` — app orders waiting for a tap (the floor strip,
  the ticket's box, the detail dialog); `service_requests/` — room
  requests waiting on staff. Both ring the chime when one arrives.
- `lib/features/rooms/` — the room panel (walk-in, reservation, session
  controls, members, player mode), the session bar on a room bill, the
  floor's reservations row.
- `lib/features/availability/` — sold-out switches per branch.
- `lib/features/catalog/`, `tables/`, `customers/` — the read models and
  calls behind the pad and the floor.
- `lib/features/receipt/` — the printable sheets; `settings/` — the printer.
- `lib/l10n/` — ARB files; keys mirror `pos_web/src/lib/i18n.ts`.

## Verify

```
flutter analyze
flutter test
```
