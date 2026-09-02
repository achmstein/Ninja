# Chillax POS — Analysis & Plan

**Goal:** replace Loyverse (Open Tickets for rooms + counter sales) with a POS built into Chillax, handling both **live orders** from the customer apps and **direct orders** taken at the counter.

**Status:** proposed 2026-08-29; revised 2026-09-02 — D5 decided (POS is a separate app). Remaining open questions at the bottom.

> **Naming note (2026-09-01):** `Rooms.API` / `Rooms.Domain` / `Rooms.Infrastructure` are now
> `Spaces.API` / `Spaces.Domain` / `Spaces.Infrastructure`, since the service owns café tables
> alongside rooms. The database is `spacesdb` and the schema is `spaces`. Public routes are
> unchanged (`/api/rooms`, `/api/sessions`, plus the new `/api/tables`). Paths below predate the
> rename.

> **Update (2026-09-02):** the table-QR + guest-ordering batch (`cdb83cc..e303a5b`) landed several
> things this plan had scheduled for Phase 0. Section 1 and the phases are edited in place; landed
> work is marked *(done 2026-09-01)*.

---

## 1. Where we are today

The painful part of the current setup is **double entry**. Staff already run the whole café inside Chillax admin — sessions, orders, requests — and then re-key everything into Loyverse:

- The rooms screen deliberately shows **hours only, no money** (`admin_web/src/features/rooms/components/room-detail-panel.tsx` — "Billed hours in POS quarter-hour steps — no money"). Staff read `End Session · 2.5h` and type it into a Loyverse open ticket.
- Confirming an order logs *"Order confirmed and sent to POS"* (`ConfirmOrderCommandHandler`) — but there is no integration; a human keys the items into Loyverse.

### What already exists (more than expected)

| Capability | Where | State |
|---|---|---|
| **Time-billing engine** (the Open Ticket core) | `Rooms.Domain/…/Reservation.cs` | Done. Walk-ins, rate-locked segments, mid-session Single↔Multi switching, per-mode quarter-hour rounding, `TotalCost` frozen on end. |
| Cashier session control | `Rooms.API/Apis/RoomsApi.cs` | Done. start/end/cancel/change-mode/members, all Admin-gated, live floor view + SignalR. |
| Live order queue | `admin_web/src/features/orders/board.tsx` | Done. Confirm/cancel with idempotency keys. |
| Customer tab ledger | `Accounts.API` (+ `admin_web/src/features/accounts/`) | Done. Charge/Payment/Balance, `RecordedBy` audit. Staff-operated, nothing posts to it automatically. |
| Catalog with modifiers | `Catalog.API` | Done. Customization groups, options with price adjustments, bundles, per-branch price overrides. |
| Cart implementation | `client_web/src/lib/cart.ts` + `routes/cart.tsx` | Done — reusable as the POS cart (same stack, same generated SDK, idempotent submit). |
| Realtime plumbing | `Notification.API` hub + `admin_web/src/hooks/use-admin-notifications.ts` | Done. Admin group, reconnect/backoff, poll fallback. Hub now also serves anonymous guests via `JoinGuestGroup` (2026-09-01). |
| **Café tables + QR flow** | `Spaces.API` `/api/tables`, `admin_web/src/features/tables/`, `client_web/src/routes/table/$tableId.tsx` | Done (2026-09-01). Table aggregate (label-only, no time billing), admin CRUD + printable QR cards (rooms too), scan → order to table in web and app (App Links). |
| **Guest checkout** | `OrdersApi` + `GuestHeaderExtensions` + `OrderRateLimiting`; `client_web` guest store/gate | Done (2026-09-01). Anonymous orders identified by `X-Guest-Id` + name/phone, must target a table or room, rate-limited per guest/IP, live status over the anonymous hub group. |
| Business-day window | `Branch.API` (`DayStartTime` 17:00 → `DayEndTime` 05:00) | Exists but **unused by any query** — perfect for day reports. |
| Analytics | `/api/orders/stats`, `/api/rooms/sessions/stats` + dashboard | Partial. Revenue is gross; no tender split, no discounts/voids, no Z-report. |

### What is missing (the actual POS layer)

1. **No check/ticket object.** Session time lives in Rooms, order totals in Ordering, tabs in Accounts — nothing unifies "room 3's 2.5h Multi + 3 lattes" into one payable bill. "Get Bill" (`ServiceRequestType.ReceiptToPay`) is just a staff ping.
2. **No payment anything.** No tender types, no split payment, no change, no VAT, no receipt entity, no receipt numbering, no printing.
3. **No shift / cash drawer / Z-report.**
4. **Orders and sessions are joined only by a display string.** `Order.RoomName` is a `LocalizedText` snapshot — no `SessionId`/`RoomId` FK. You cannot query a session's consumption. (Tables are ahead of rooms here: `Order.TableId` + `TableName` landed 2026-09-01 — the same id-plus-snapshot pattern is exactly what rooms need.)
5. **`SessionCompletedIntegrationEvent` has zero subscribers** — published with the full cost breakdown "for billing/loyalty", consumed by nobody. This dangling event is the cleanest integration seam in the whole system.
6. **Staff-entered walk-in orders don't exist.** Buyer-less orders became real with guest checkout (2026-09-01: `Order.GuestId`/`GuestName`/`GuestPhone`, no `Buyer` row, loyalty skipped) — that was the hard domain change. Still missing for POS: an order `Source` (Customer | Guest | Pos), a staff create-and-confirm path, and relaxed guest rules for the counter (a cash sale has no phone number and no destination).
7. **Money math is client-trusted.** `Order.GetTotal()` ignores `OrderItem.Discount` and `LoyaltyDiscount`, and the loyalty discount still comes from the request body. (`UserId` is fixed as of 2026-09-01: identity now comes from the token, or `X-Guest-Id` for guests — but that also closed the accidental order-on-behalf route an Admin token used to have, so the POS on-behalf path must now be built explicitly.)
8. **Only `Admin`/`Owner` roles** — no cashier attribution beyond `RecordedBy` in Accounts.

### Bugs found during analysis (fix along the way)

- Reservation expiry is **10 minutes** (`Reservation.ReservationExpirationMinutes = 10`) while all UI copy in both clients says **15**. *(Still open 2026-09-02.)*
- `Order.GetTotal()` returns gross subtotal — discounts never subtracted (also inflates `/stats` revenue). *(Still open 2026-09-02.)*
- `GET /api/rooms/sessions/my` is unpaged/unbounded and fetched on a 15s timer by the Flutter app. *(Still open 2026-09-02.)*
- ~~`CreateOrderRequest.UserId` taken from body, not token~~ **Fixed 2026-09-01** — `OrdersApi.CreateOrderAsync` derives identity from the token and ignores body `UserId`.
- New with guest checkout (2026-09-01), acceptable for now but POS-relevant: the guest rate limiter partitions by the client-chosen `X-Guest-Id` (rotating ids sidesteps it; only header-less callers fall back to per-IP), and Ordering never verifies `TableId` against Spaces — the table gate is client-side, so the label staff see is claimed, not proven.

---

## 2. Design decisions

### D1 — The check is a new bounded context: `Sales.API`

The check spans Rooms (time) and Ordering (items), and counter sales have no room at all — so it belongs to neither. Extending `Reservation` would drag order lines and payments into Rooms.API; extending Ordering would make "an order" mean two things. A small new service following the house template (`Sales.API` + `Sales.Domain` + `Sales.Infrastructure`, own Postgres DB, BFF route, generated SDK) owns:

- **Ticket** (Loyverse's term, keep it) — the open check
- **Payment** — tenders settling a ticket
- **Receipt** — numbered, frozen document
- **Shift** — cash drawer sessions (phase 3)

Rooms stays the **time authority**, Ordering the **order authority**, Catalog the **price authority**; Sales only composes and settles.

### D2 — Event-driven ticket assembly (uses the existing bus, incl. the dangling event)

```
SessionStarted        ──► Sales: open Ticket(type=Room, sessionId, roomId, branchId)
OrderConfirmed        ──► Sales: append order lines to the session's ticket (idempotent by OrderId);
                          carrying a TableId instead: open-or-append the table's open Ticket(type=Table)
SessionCompleted      ──► Sales: append time lines (Single X.Xh @ rate, Multi Y.Yh @ rate)  ← finally subscribes it
Settle (API call)     ──► Ticket → Settled, Receipt issued
  tender = Account    ──► TicketSettledOnAccount ──► Accounts.API posts a Charge (auto, at last)
OrderConfirmed        ──► Loyalty (already exists, unchanged)
```

While a session is active, the POS shows order lines from the ticket plus a **live time preview computed in the UI** from session data (the room panel already does this); the authoritative time lines land only at `SessionCompleted`, so rounding stays server-owned in one place (`Reservation.GetRoundedHoursForMode`).

Since 2026-09-01, `OrderStatusChangedToConfirmedIntegrationEvent` also carries `GuestId`, and order read models expose `TableId`/`TableName`/`GuestName`/`GuestPhone` — so ticket lines can name the table they belong to, and a guest's ticket can carry their contact snapshot even though there is no customer id behind it.

### D3 — Ticket model sketch

```
Ticket:      Id, Number, BranchId, Type (Room | Table | Counter), SessionId?, RoomId?, TableId?,
             CustomerId?, CustomerName?, GuestPhone?, Status (Open | Settled | Voided),
             OpenedAt/By, SettledAt/By, Lines[], Payments[]
TicketLine:  Source (Order | SessionTime | Manual), OrderId?, Description (localized),
             Qty, UnitPrice, Discount, Total
Payment:     Tender (Cash | Card | InstaPay | Account), Amount, ShiftId?, RecordedBy
Receipt:     Number (per-branch sequence), TicketId, issued snapshot
```

Split payments = multiple Payment rows; server validates `Σ payments ≥ total` (change on cash) and freezes the ticket.

**Table tickets** *(Q7 decided 2026-09-02)*: one open ticket per table. Opened **lazily** by the first confirmed order carrying that `TableId` — no table sessions in Spaces, the table stays a pure label; closed **only by settle** (nothing reliable signals "the group left"). Turnover guards: the floor tile shows how long a ticket has been idle, and the ticket screen gets a "move lines to a new ticket" action for orders that landed on the previous group's bill. Per-person partial settle stays out of v1 — split tender at settle covers the common case.

### D4 — Counter sales are real Orders

A counter sale creates an actual `Order` (walk-in buyer, `Source = Pos`, auto-Confirmed since the cashier *is* staff), which flows onto a `Counter` ticket via the same `OrderConfirmed` event. This keeps **one source of truth for item sales** — top-items stats, loyalty accrual (when a customer is attached), and the barista's order board all keep working without a parallel path.

### D5 — The POS is its own app: `pos_web` *(decided 2026-09-02; supersedes the original `/pos`-in-admin_web proposal)*

The original proposal was a `/pos` route group inside admin_web. Decided instead: a **separate SPA**, because the two surfaces have opposite lives:

- POS is a fullscreen, touch-first app that runs **all day** on a counter tablet; admin_web is a desktop back-office. One app serving both means every back-office deploy risks the counter mid-service, and the tablet carries the entire admin bundle and routes it must never show.
- A separate Keycloak client (`pos-web`) lets a future `Cashier` role be scoped to POS only, without loosening admin_web.
- PWA install, wake lock, and tablet-first layouts apply to the whole app instead of being carved out inside admin_web (whose 768px `use-mobile.tsx` cutoff never fit a 10" tablet anyway).
- The house pattern is already one SPA per audience with its own generated SDKs (admin_web and client_web each generate their own) — pos_web follows it. It shares patterns and copied components, not a build.

Same stack and plumbing as the existing SPAs:

- `src/pos_web`, scaffolded like admin_web: Vite + React, OIDC pinned to `auth.chillax.site`, `npm run generate:api` SDKs, the SignalR reliability layer, EN/AR + RTL.
- **UI on shadcn/ui** (owner request 2026-09-02) — the same component family admin_web's kit builds on, but composed touch-first: large hit targets (≥48px), Sheet/Dialog/Command patterns for ticket + settle flows, a dedicated keypad component, no hover-dependent affordances, visible-at-a-glance state colors on floor tiles.
- `pos.chillax.site` vhost in `deploy/Caddyfile` (static SPA, `/api/*` + `/hub/*` → mobile-bff, same cache-header split), a `pos-web` public client in the Keycloak realm, a build job in `deploy-web.yml`.
- PWA manifest from the first commit (client_web has the pattern); numeric keypad component for amounts (no OS keyboard popping over the settle dialog).

Hardware caveat unchanged by the decision — it's still a browser: it can print to any **Windows/OS-installed 80mm thermal printer** via `window.print()` + print CSS, but it **cannot kick a cash drawer or drive Bluetooth ESC/POS printers directly**. If that's needed, phase 4 adds QZ Tray (a small local agent that bridges browser → raw ESC/POS + drawer kick) — no rewrite required.

### D5b — No synchronous cross-service calls, ever *(decided 2026-09-02)*

Hard rule from the owner: **no service HTTP/gRPC-calls another service from code.** All
service-to-service communication rides the RabbitMQ event bus. Where a service needs another
service's data to do its job, it keeps a **local read model fed by integration events** (the
way Sales assembles tickets from Ordering/Spaces events in D2), or the validation happens as
an **event round-trip** (the existing `AwaitingValidation` pattern in Ordering). The SPAs and
the YARP BFF composing views from several APIs is fine — the ban is on backend service-to-service
calls, which couple deploys, turn one service's downtime into another's, and hide ordering bugs.

Concrete consequences for this plan:
- Sales.API never queries Ordering/Spaces/Catalog; tickets are built only from events.
- Ordering validates `TableId` against a local table read model fed by Spaces table events —
  not by calling Spaces.
- Loyalty redemption is validated by Loyalty consuming order events (compensating if the
  balance is short), not by Ordering asking Loyalty.

### D6 — Online-only for v1

Loyverse works offline; this POS won't at first. The backend is remote, and staff already depend on admin_web live — the POS accepts the same risk. An offline queue is a large architectural investment (queueing across ~20 generated mutation hooks, conflict handling) and is deliberately out of scope; noted as a possible later phase if connectivity proves to be a real problem.

### D7 — Server becomes the pricing authority

Before cashiers can key discounts, money math moves server-side: `UserId` from token (with an explicit Admin on-behalf/walk-in path), loyalty discount recomputed by the server, `GetTotal()` net of discounts. This fixes the existing authz hole at the same time.

---

## 3. Delivery phases

### Phase 0 — Backend seams (no visible change) — **backend DONE 2026-09-02; client wiring pending**

1. ~~`Order.SessionId` + `Order.RoomId` nullable FKs + migration~~ **Done** (`AddOrderSourceAndSessionLink` migration, `GET /api/orders?sessionId=` filter, indexed). *Pending: clients send the active session's id at checkout — both already hold it and drop it (`order-destination.ts:37`, `current_table_provider.dart:122`).*
2. ~~Pricing authority~~ **Done**: `LoyaltyDiscount` is now computed server-side from `PointsToRedeem` at the fixed rate (`Order.LoyaltyPointsPerCurrencyUnit = 100`, deliberately duplicated from Loyalty.API per D5b — no shared kernel), clamped to the items total; the body value is ignored like `UserId`. `GetTotal()` is net of line discounts and loyalty; all five query projections and stats revenue now match. Still open (noted, not Phase 0): Loyalty publishes no compensation event when a redemption exceeds the balance — the throw is ACKed and swallowed (`RabbitMQEventBus.cs`), so the discount survives; needs a Loyalty-side failure event once Sales exists to care.
3. ~~Walk-in/POS orders~~ **Done**: `Order.Source` (Customer | Guest | Pos, string column, backfilled from `GuestId`), `POST /api/orders/pos` (Admin) with optional attach-customer for loyalty, POS orders auto-confirm when stock validation passes (the cashier is the approval), buyer-less handler paths generalized (guest name → "Walk-in" fallback).
4. ~~Drive-bys~~ **Done**: the 15-minute copy was already gone from user-facing strings (all say 10); scrubbed the stragglers (OpenAPI description + comments). `GET /api/rooms/sessions/my` is paged (default 20, cap 50, array shape kept for shipped apps).
5. Rate limit — **Done**: per-IP `GlobalLimiter` ceiling (60/5min) over anonymous order creation, so rotating guest ids can't dodge the per-guest limit. `TableId` validation **moved to Phase 1**: it needs the Spaces table integration events (Created/Renamed/Deactivated/Deleted) that Sales' read models need anyway — today tables raise no events at all and `DELETE /api/tables/{id}` hard-deletes silently.

### Phase 1 — `Sales.API` + room & table tickets *(replaces Loyverse Open Tickets)* — **backend built 2026-09-02**

1. ~~New service per house template~~ **Done**: `Sales.API`/`Sales.Domain`/`Sales.Infrastructure`, DB `salesdb` (schema `sales`), BFF route `/api/tickets`, wired into AppHost + docker-build.yml + deploy compose. `salesdb` created on prod (init script only runs on first boot).
2. ~~Ticket aggregate + consumers + endpoints~~ **Done**: Ticket/TicketLine/Payment/Receipt (per-branch receipt numbers via unique index + retry); consumes `SessionStarted` (open), `OrderConfirmed` (session append / table open-or-append / counter — all lazy-open so missed events never lose a bill), `SessionCompleted` (time lines, idempotent); endpoints: open tickets, detail, open-by-hand (counter/table), manual line, move-lines (turnover guard), settle with split tender + cash change. 10 aggregate unit tests. **Event enrichment shipped with it**: `OrderStatusChangedToConfirmed` now carries branch/session/table/source/items/loyalty; Spaces session events carry `BranchId`; `SessionCompleted` now publishes for walk-ins too (CustomerId nullable — it used to be silently skipped, which would have dropped every cashier-started session's bill).
3. ~~Scaffold pos_web~~ **In progress 2026-09-02**: Keycloak `pos-web` client (realm + deploy upsert), `pos.chillax.site` Caddy vhost + bind mount, deploy.yml + deploy-web.yml build jobs, AppHost Vite app (port 5175). **Needs a DNS record for pos.chillax.site.**
4. pos_web floor view (rooms **and tables** grid with live check totals + open tickets + idle time on table tickets), ticket screen (lines + live time preview + settle dialog with keypad and change due), 80mm receipt print CSS. *(First cut being scaffolded.)*
5. ~~Ticket events → SignalR~~ **Done**: Sales publishes `TicketUpdated`/`TicketSettled`; Notification.API forwards `TicketUpdated` to the admin group as `"TicketUpdated"`.

**Milestone: room and table billing runs entirely in Chillax; Loyverse only still used for counter sales.**

### Phase 2 — Counter POS *(replaces Loyverse entirely)* — **built 2026-09-02 (local)**

1. ~~Item pad~~ **Built**: `/sale` in pos_web — category tabs + item grid + customization sheet + cart (client_web's inline-customizations model), optional attach-customer via `GET /api/identity/users` search.
2. ~~Walk-in order → counter ticket → immediate settle~~ **Built**: Charge → `POST /api/orders/pos` now returns the **order id** (`CreateOrderCommand` returns `int`; 0 = deduplicated retry) → POS polls the new `GET /api/tickets/by-order/{orderId}` until the confirmation event lands the counter ticket → settle dialog auto-opens → receipt. Loyalty accrues through the normal `OrderConfirmed` path when a customer is attached (POS-side points *redemption* deliberately deferred — the cashier has no balance view yet).
3. ~~Account tender~~ **Built, event-driven per D5b**: `Ticket.Settle` requires an attached customer for Account payments and caps all non-cash tenders at the total (no cash change out of a tab); the settled event now carries `AccountAmount`/`CustomerName`/`SettledBy`; **Accounts.API consumes it and posts the Charge automatically** — the first automatic write to a customer tab. Idempotent via a new unique `AccountTransaction.Reference` ("sales-ticket:{id}", migration `AddTransactionReference`), because the bus redelivers and a tab must never pay a ticket twice.

Q5 (counter sales on the barista board) resolved by construction: a POS sale is a real order flowing the same pipeline, so it lands on the live board as Confirmed like any other.

**Milestone: Loyverse switched off** *(after deploy + a shadow-run period).*

### Phase 3 — Cash management & reporting — **backend built 2026-09-02 (local)**

1. ~~Shift aggregate~~ **Built**: `Shift` + `CashMovement` in Sales.Domain — opening float, pay-in/out (reason required), close count with frozen `ExpectedCash`/`OverShort` (`float + cash − change + payIns − payOuts`); one open shift per branch (command check + partial unique index). Attribution is per-ticket, not per-payment: `Ticket.ShiftId` + `Ticket.ChangeGiven` stamped at settle. **A missing shift never blocks a sale** — it settles unattributed (Q4 answered leniently). Endpoints: open / current (live X report) / detail (X or Z) / closed history / movements / close (returns the Z). 6 new unit tests (19 total in Sales).
2. ~~X/Z + day report~~ **Built**: `ShiftView` doubles as X (live) and Z (frozen); `GET /api/tickets/reports/range?from&to` gives net, discounts (line + loyalty), tender split, change, and per-type counts. **The business-day window stays client-side per D5b**: the SPA reads `DayStartTime`/`DayEndTime` from Branch.API and passes explicit bounds — Sales never grows a Branch read model. *Remaining UI: pos_web shift screens (open/close/X-Z, movements) and a tender-split card on the admin dashboard.*

### Phase 4 — Hardening & extras — **three picks built 2026-09-02 (local)**

Built:
- **Voids with audit (Owner-gated)**: `Ticket.Void(reason, by)` — open tickets only, reason mandatory (it *is* the audit trail), lines preserved, `POST /api/tickets/{id}/void` behind the Owner policy. A settled ticket can never be voided — taking money back is a refund, deliberately not built (see below).
- **`Cashier` Keycloak role**: new central `"Pos"` policy (Admin | Owner | Cashier) in ServiceDefaults; applied to Sales tickets + shifts, `POST /api/orders/pos`, and the Identity user search (the one identity read the till needs). Realm role added to chillax-realm.json + idempotent role upsert in deploy.yml. Void stays Owner-only.
- **Loyalty on session time**: the settled event now carries `TimeTotal` (session-time lines only); Loyalty consumes it and awards at the same 2 pts/EGP × tier math, idempotent by `ReferenceId` "sales-ticket:{id}". Items are excluded — they accrued at order confirmation, so the whole-total would double-pay. **Hardening bonus**: the existing order-confirmed Loyalty handler had no redelivery dedup (a redelivered event re-redeemed *and* re-awarded) — now dedupes on the order-id reference.

Deliberately deferred, each for a stated reason:
- **Refunds of settled tickets** — real money back plus loyalty/account reversal; needs an owner policy decision first.
- **QZ Tray** (drawer kick / ESC-POS) — blocked on open question 2 (what printer hardware exists).
- **Kitchen prep statuses** — changes what customers see in their apps; a product decision, not a hardening item.
- **Offline queue** — deliberately out per D6.

*UI done 2026-09-02: pos_web's role gate accepts Cashier; Owner-only Void action on the ticket screen with reason dialog and a voided tombstone view.*

---

### Phase 5 — Ship & cutover *(runbook, 2026-09-02 — execution awaits the owner's go)*

Everything above is built and verified locally (all suites green, all four apps build). Shipping is
deliberately a separate decision. In order:

1. **Pre-flight (owner)**: add a DNS record for `pos.chillax.site` → the server IP; lift the
   "keep it local" hold; decide who gets the `Cashier` role.
2. **Commit & push** the working tree (one review pass first — `git status` is ~250 files across
   backend, three SPAs and the Flutter app).
3. **Build images**: run *Build and Push Docker Images* (`services=all` — ordering, spaces, sales,
   notification, accounts, loyalty, identity all changed).
4. **Deploy**: run *Deploy to Server*. It ships the three SPA bundles, the new compose (sales-api
   included), upserts the `pos-web` Keycloak client and the `Cashier` role, and every changed
   service applies its migrations on startup (`salesdb` already exists on prod; Sales runs its
   single `InitialCreate`, Ordering `AddOrderSourceAndSessionLink`, Accounts
   `AddTransactionReference`).
5. **Smoke-test on prod** (~10 min): open a shift → counter sale on the item pad → auto-settle →
   receipt prints; app order into a room session → end session → room ticket carries time lines →
   settle; table QR order → table ticket accumulates a second round → settle; account tender on an
   attached customer → charge appears on their tab; Z report closes clean; dashboard card shows the
   day.
6. **Shadow-run**: run Chillax POS alongside Loyverse for a few service days, comparing Z reports
   nightly. Loyverse stays the till of record until the numbers agree.
7. **Cutover**: switch Loyverse off. Keep its data export.

Still open before or during the shadow-run: Q2 (printer hardware — decides whether `window.print()`
suffices or QZ Tray moves up), Q3 (VAT/e-receipt), and the refund policy for settled tickets.

---

## 4. Open questions (answers shape phases 1–3)

1. **Tenders:** what do customers actually pay with today — cash only, card machine, InstaPay/wallets? (Determines the tender enum and whether split payment is v1.)
2. **Printer:** what does Loyverse print receipts on now (model, USB/Bluetooth)? Do you use a cash drawer with kick? (Determines whether browser printing suffices or QZ Tray moves up.)
3. **VAT / ETA:** plain receipts, or do you need VAT lines / Egyptian e-receipt compliance?
4. **Shifts:** is cash counting/Z-report needed at launch, or is phase 3 timing fine?
5. **Counter orders on the barista board:** should POS counter sales appear on the orders board for preparation, or settle silently?
6. **Naming:** `Sales.API` for the new service, and "Ticket" as the user-facing term (matching Loyverse) — OK?
7. ~~**Table tickets**~~ **Decided 2026-09-02: one open ticket per table** (Loyverse-style dine-in — all of a table's orders on one bill, settled once). Lifecycle and turnover guards recorded in D3; folded into Phase 1 scope.
