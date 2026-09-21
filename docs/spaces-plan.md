# Spaces — Reservations apart from stays

**Goal:** a café can take a booking on any place — a PlayStation room with a clock, or a plain table with none — and the thing that is booked is not the thing that is billed.

**Status:** decided and built 2026-09-21; the module split and the owner's reservation history the same day.

---

## 1. Where we were

A *hold* was a `Stay` that had not started: born `Held` with a ten-minute expiry, then `Running`, then `Ended`. Every stay carried a `Tariff` snapshot, so only a timed place could be reserved (`Place.CanReserve => IsTimed && IsActive`), and only for *now* — there was no way to book for later, and no way to book a table that only takes orders.

The control plane sold this as the **Spaces** module, but every café has places (tables, QR codes) whatever its plan: `PlanCatalog.Routes` had to carve `/api/places` out of the module and block seven routes by hand.

## 2. Decisions

**D1 — A `Reservation` is a promise; a `Stay` is a clock.** Two aggregates in the Spaces service, no new context.

| | `Reservation` | `Stay` |
|---|---|---|
| Meaning | A party will occupy a place | Metered time at a timed place |
| Needs a tariff | No | Yes (snapshot) |
| Life | `Requested → Confirmed → Seated` · `Cancelled` · `Expired` | `Running → Ended` · `Cancelled` |
| Made by | a customer from the app, or the till for a party at the counter or on the phone | a walk-in, or a seated reservation |

`For` is nullable: null is "now" — the customer is on the way and has ten minutes (`HoldMinutes`) to arrive, exactly the old hold; a time is a booking for later, which keeps the place from that time and lapses thirty minutes after it (`GraceMinutes`) if nobody is seated. Staff-made reservations never lapse. Two reservations on one place closer than two hours (`SlotMinutes`) collide; a reservation for now also needs the place free now. No duration on a reservation: a slot is enough for v1, and nothing in the model forbids adding one.

**Seat** is the join. At a timed place it creates the stay (`Stay.FromReservation`), starts the clock at the option the till names — else the one the customer asked for, else the tariff's default — and puts the reserving customer in the party; at a plain table the reservation simply closes and the ticket on the table does the rest. **Confirm** acknowledges a reservation and, where the customer asked for start-on-confirm at a timed place, seats them in the same tap — so the till's two buttons mean what they always did.

**D2 — `Place.Reservable` is the owner's switch.** Booking is a property of the place, not of its tariff: a plain table can take reservations without a clock, a timed place can stop taking them. Giving a place a tariff opts it in, since timed places always booked; the owner may switch it off afterwards. Default off for a plain table, so a café that only seats people sees nothing change.

**D3 — Two modules: Reservations and Time billing.** What a café buys is one or both: a restaurant books tables and never runs a clock; a walk-in PlayStation café runs clocks and takes no bookings; Chillax does both. `Module.Reservations` gates `/api/reservations/*`, `/api/places/available`, `/{id}/reservable` and `/{id}/reservations`; `Module.TimeBilling` gates `/api/stays/*`, `/{id}/tariff`, `/{id}/walk-in`, `/{id}/join` and `/{id}/stays`; `/api/places` itself is every plan's. Starter includes both. A tenant who had bought Spaces as an add-on has both add-ons now (Control.API migration `ReservationsAndTimeBilling`); a stack's `SpacesEnabled/Entitled` became `TimeBilling*` with `Reservations*` copied from it (Branch.API migration of the same name), and the next entitlements push settles each on its own. The features object the surfaces read is `{ reservations, timeBilling, loyalty, … }`.

What each switch gates on the surfaces: **reservations** — the till's reserved strip, the customer's book tab; **timeBilling** — the Room filter, the stays list, the time-by-place chart, "places in use"; the Rooms & Tables page, service requests, "tables in use" and the live floor are every café's (a plain table has a bill, a QR and a waiter to call whatever the plan).

## 3. What changed

- **Spaces.Domain:** `ReservationAggregate` (`Reservation`, `ReservationStatus`, `IReservationRepository`), `ReservationRequested/Seated/Cancelled` domain events. `Stay` loses `Held`, `ExpiresAt`, `StartOnConfirm`, `RequestedOptionCode`, `Start()`, `Confirm()`; gains `ReservationId` and `FromReservation`. `StayStatus` keeps its numbers (`Running = 2`), so the apps' constants stand. `Place.Reservable`, `SetReservable`.
- **Spaces.Infrastructure:** `reservations` table (`reservationseq`), `Reservable` on places, `ReservationId` on stays, `StartedAt` not null. Migration `Reservations` moves every stay that never ran across, id and all — a hold still waiting becomes `Requested`, one given up `Cancelled`, one that lapsed `Expired` — and pushes the sequence past the inherited ids.
- **Spaces.API:** `api/reservations` (`POST /` reserve, `/my`, `/open`, `/{id}`, `/{id}/confirm`, `/{id}/seat`, `/{id}/assign-customer`, `/{id}/cancel`, `/my/{id}/cancel`); `api/stays` keeps the clock (`/{id}/start`, `/{id}/confirm`, `/my/{id}/cancel` are gone); `PUT /api/places/{id}/reservable`; `/api/places/available` is every reservable free place. `ReservationExpiryService` replaces `HoldExpirationService`. `PlaceViewModel.CurrentReservation` beside `CurrentStay`; the scan answers `Reservation` beside `Stay`.
- **Events:** `PlaceReserved` carries the reservation's id and now `For` and `PartySize`. `ReservationCancelled` is raised for a reservation given up (`ReservationId` is the reservation's, `WasRunning` false) and for a running stay cut short (`ReservationId` is the stay's — the session Sales opened a ticket for — `WasRunning` true); Sales acts only on the second, since the two ids come from different sequences. `SessionStarted` and the rest are the stay's, as before.
- **Gateway:** `/api/reservations/{*any}` → spaces (AppHost and the stamped compose); the plan table is per module as D3 says; `/api/places/{id}/hold` is gone.
- **History:** `GET /api/reservations/history` (branch, paged, by place and the day it was for) and `GET /api/places/{id}/reservations`; the owner's Reservations page beside Time history, and past reservations under each place in the detail panel. A reservation sits with the day it was *for*, not the day it was made.
- **Surfaces:** pos_web, pos_app, admin_web, client_web and client_app read `/api/reservations/open` or `/my` for what used to be held stays; the floor's reserved strip shows a reservation due later with its time; a plain table somebody reserved opens its panel to seat them and then its bill; admin's place dialog has the *Takes reservations* switch; the customer's list is every bookable place, and the start-on-confirm row only shows where there is a clock.

## 4. Left for later

- A duration or slot length per branch, once overlapping bookings on one place are wanted.
- A push to the customer when the café confirms a booking for later (no integration event on Confirm yet).
