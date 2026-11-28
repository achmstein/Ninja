# Live delivery card for the customer

## Context

A customer who orders delivery gets three separate pushes today (on the way, delivered, not delivered) and nothing to act on. The owner wants one live, interactive notification instead: a card that stays on the phone for the whole order, moves as the order moves, and has buttons.

Decisions taken with the owner (2026-11-28):

- **One card, updated in place**, with the café's logo riding a track. Sound only at pickup and when the rider is near.
- **Rider's live location is in version 1.** The rider app is installed as an APK directly, so there is no Play review in the way.
- **Call button rings the rider** (or the courier company's driver), from pickup until hand-over.
- **iPhone works the way the room card does today**: the app starts and updates it; no Apple push key in this version.
- First step of the build: save this plan as `docs/delivery-live-card-plan.md`, so a fresh session starts from it.

## What exists today (checked in the code)

- **Stages** are `Waiting, Assigned, OnTheWay, Delivered, Failed, Returned`, computed from timestamps (`src/Ordering.Domain/AggregatesModel/OrderAggregate/Delivery/Delivery.cs`). There is no "nearby" stage.
- **Every step publishes `OrderDeliveryChangedIntegrationEvent`**, handled in `src/Notification.API/IntegrationEvents/EventHandling/OrderDeliveryChangedIntegrationEventHandler.cs`. It pushes signed-in buyers only, on OnTheWay, Delivered and Failed, as a visible FCM notification. Guests get no push.
- **Pushes go through FCM only** (`src/Notification.API/Services/FcmService.cs`); it already has a data-only sender. One token per customer (`NotificationSubscription`, type `UserOrderNotification`), with no platform recorded.
- **The room card is the pattern to copy**:
  - Android: `SessionFcmService.kt`, `SessionNotificationHelper.kt` (ongoing notification, action buttons, `SessionActionReceiver` posting to the server with the access token kept in shared preferences).
  - iPhone: extension target `ios/ChillaxLiveActivity` (`SessionLiveActivity`, `SessionActivityAttributes`, `SessionActionIntent`), started by the app in `Runner/SessionNotificationHelper.swift`. Tenant builds, signing and App IDs already cover this target; a second widget inside it needs no kit change.
- **Customer app** follows an order on the dock (`src/client_app/lib/features/cart/services/checkout_flow.dart`), fed by SignalR `OrderStatusChanged` and an 8 second poll. No tracking screen, no map. Taps on `order_on_the_way` / `order_delivered` pushes go nowhere (`lib/core/services/firebase_service.dart`).
- **Rider app** (`src/rider_app`, Android only) sends one GPS fix at hand-over (`hand_over_locator.dart`), polls its list every 30 s, and hears from the server by FCM and SignalR `DeliveryChanged`.
- **Minutes** are the zone's fixed `EtaMinutes`; distance is straight-line (`Geo.cs`). No routing service.
- **The customer's order view has no rider phone** (`src/Ordering.API/Application/Queries/OrderViewModel.cs`). Where a rider's own number is kept has not been found yet: settle this first in step 2.
- **Rating exists** (`POST api/orders/{id}/rating`, `rating_dialog.dart`). Reorder does not exist.

## The card

| State | Shows | Buttons | Sound |
|---|---|---|---|
| Accepted / preparing | Track at stop 1 or 2, "about N min" | none | no |
| Ready, rider assigned | Track at stop 2, rider's name | none | no |
| On the way | Logo moving along the track, minutes left, rider's name | Call rider, I'm coming down | yes, once |
| Near (under ~300 m) | "Almost there" | Call rider, I'm coming down | yes, once |
| Delivered | "Delivered" | Rate (opens the rating in the app) | no |
| Not delivered | What happened | Call the café | yes |

The card leaves by itself 30 minutes after Delivered, or when rated. Wording says "item", never "dish".

## Steps

### 1. Doc and mock-up
- Save this plan to `docs/delivery-live-card-plan.md`.
- Mock-up of the card in every state, Android notification and iPhone lock screen, Arabic and English: `C:\Users\Admin\OneDrive\Desktop\ninja-delivery-card-mockup.html`. Owner approves before code.

### 2. Server: Ordering
- `Delivery`: add `CustomerComingAt` and `NearbyAt`. These change once per order.
- The rider's last spot goes in a table of its own, `RiderSpot` (one row per rider: `RiderUserId`, latitude, longitude, `At`, and the progress last told for each delivery that is out), **not on the order**. A report every 20 seconds must never write the order's row: that would bump its version and collide with the till editing the same order. The order is written only when near is first reached.
- One migration for both.
- `PUT api/orders/{id}/delivery/coming`: the buyer says "I'm coming down"; allowed only while OnTheWay; once per order.
- `PUT api/riders/me/location` (beside `riders/me` in `Deliveries/Endpoints/DeliveryApi.cs`): stored in `RiderSpot`, read against the rider's deliveries that are OnTheWay. From it the server works out:
  - **progress** = 1 − remaining ÷ `DistanceMeters`, straight-line with `Geo`;
  - **minutes left** = zone minutes × remaining share, shown as "about";
  - **near** = first time under 300 m, sets `NearbyAt`.
- `OrderDeliveryChangedIntegrationEvent` gains (additive): `EtaMinutes`, `RiderPhone`, `Progress`, `Nearby`, `CustomerComing`. A location report raises it only when progress moved 10 points or more, or on near, so the customer's phone gets a handful of updates, not one every few seconds.
- Customer order view gets `riderPhone` (or the courier driver's) only while Assigned or OnTheWay, plus `progress` and `nearby`. The customer never receives coordinates.

### 3. Server: Notification
- `SubscribeRequest` and `NotificationSubscription` gain optional `Platform` (`android` / `ios`). Old app builds send nothing and keep today's behaviour.
- In `OrderDeliveryChangedIntegrationEventHandler`:
  - **Android with the card**: a data-only message `type=delivery_card` on every customer-facing change (stage, rider, progress, near), carrying stage, minutes, progress, rider name and phone, version. No visible notification, so nothing doubles.
  - **iPhone**: today's three visible pushes stay as the safety net, plus the same data message with `content-available` so a live app updates the card.
  - **Rider**: `customer_coming` push and SignalR nudge when the customer taps the button.
- `OrderStatusChanged` to the open app carries progress and near, so the dock moves too.
- New texts in `NotificationMessages` (Arabic through `TenantArabic`).

### 4. Rider app
- While it holds a delivery that is OnTheWay: a foreground location service (ongoing "On a delivery" notification), reporting about every 20 s or 50 m to `riders/me/location`. Stops when nothing is out. Reuse `hand_over_locator.dart`'s permission handling.
- "Customer is coming down" banner on that delivery (from the push and from SignalR), with a sound.

### 5. Customer app, Android
- `DeliveryNotificationHelper.kt` beside `SessionNotificationHelper.kt`; `SessionFcmService.kt` routes `delivery_card` to it, so the card updates with the app closed.
- Quiet channel for updates, a sounding one for pickup, near and not delivered. Progress track with the tenant's logo as the marker (`NotificationCompat.ProgressStyle` where the phone supports it, plain progress bar otherwise).
- Buttons: Call rider (dial intent), I'm coming down (receiver posting to the server as `SessionActionReceiver` does; if the saved token is refused, open the app on the order), Rate (opens the app on the rating).
- Flutter: `checkout_flow.dart` starts the card when a delivery order is confirmed; the subscription sends `platform`; taps on any order push or the card open the order (`firebase_service.dart` tap routing).

### 6. Customer app, iPhone
- In `ios/ChillaxLiveActivity`: `DeliveryActivityAttributes`, `DeliveryLiveActivity` (lock screen and Dynamic Island), `DeliveryActionIntent` for "I'm coming down" (iOS 17 and later; older opens the app). Registered in `ChillaxLiveActivityBundle`.
- Started by the app when the order is confirmed, updated from SignalR while open and from the data push in the background, as the room card is. Check first how the room card's silent push wakes the app, since `Info.plist` lists no background mode.
- A stale time on each update: if nothing arrives for 10 minutes the card says to open the app for the latest. With the app force-quit the card stops updating; the visible pushes still arrive. That limit is Apple's and is lifted only by the later Apple key step (`docs/live-activity-push-to-start.md`).

### 7. Release
- Backend tag, Deploy Platform, then the owner's Upgrade all with that tag.
- Customer app builds per café (`mobile-deploy.yml` with `tenant`), Android and iOS.
- Rider app APK.
- Old customer builds keep working: they never send `platform`, so they get today's pushes.

## Load
- The only new steady load is the rider's report, about one small write every 20 seconds per rider with an order out, on that café's own stack. It goes to `RiderSpot`, never to the order.
- The customer's phone gets about ten updates per delivery: one per stage, one per 10 points of progress, one at near.
- The till, kitchen and web receive none of the location updates.
- The rider's phone runs GPS only while an order is on the way.

## Not in this version
- Apple push key so the iPhone card updates with the app closed.
- A map of the rider.
- Guests (no push token today), customer web (web push is wired for rooms only), order again.
- Showing "customer is coming" at the till.

## Branch
`one-order-screen` is what is live and holds migrations `main` lacks, so this starts on a new branch cut from `one-order-screen`. Say so if it should go elsewhere.

## Checks
- Ordering: unit tests for coming-down rules, progress, near (once only), event raised only on a 10 point move. Notification: handler tests for Android data-only, iPhone visible plus data, old builds unchanged, rider `customer_coming`. Runner flags as in the `dotnet-test-runner-flags` note.
- `flutter analyze` and `flutter test` in `src/client_app` and `src/rider_app`.
- On real phones, by the owner: place a delivery order, walk it through assign, out, near, delivered from the till and the rider app; watch the card on Android with the app closed and on an iPhone with the app in the background; tap each button. iPhone cards cannot be tried on a simulator with pushes.
