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
             Label?, GuestPhone?, Status (Open | Settled | Voided),
             Subtotal/ServiceCharge/Vat/Total + the rates, frozen at settle (D9),
             OpenedAt/By, SettledAt/By, Lines[], Payments[]
TicketLine:  Source (Order | SessionTime | Manual), OrderId?, Description (localized),
             Qty, UnitPrice, Discount, Total
Payment:     Tender (Cash | Card | InstaPay | Account), Amount, ShiftId?, RecordedBy
Receipt:     Number (per-branch sequence), TicketId, issued snapshot
```

Split payments = multiple Payment rows; server validates `Σ payments ≥ total` (change on cash) and freezes the ticket.

**Table tickets** *(Q7 decided 2026-09-02)*: one open ticket per table. Opened **lazily** by the first confirmed order carrying that `TableId` — no table sessions in Spaces, the table stays a pure label; closed **only by settle** (nothing reliable signals "the group left"). Turnover guards: the floor tile shows how long a ticket has been idle, and the ticket screen gets a "move lines to a new ticket" action for orders that landed on the previous group's bill. Per-person partial settle stays out of v1 — split tender at settle covers the common case.

### D8 — A bill has a label, not a customer *(2026-09-02)*

The ticket-level `CustomerId`/`CustomerName` is gone. It was one slot filled from three sources with three meanings (a session's owner, a typed tab name, the account attached at a counter sale), on a document that routinely has several people on it. What replaces it:

- **`Ticket.Label`** — what the bill is called, for humans: the session owner's name at open time on a room ticket, the typed name on a counter tab, nothing on a table (the table's name suffices). Never reaches Loyalty or Accounts.
- **People are snapshots on lines and payments**, keyed by something that already exists upstream: an account holder by `CustomerId`, a guest by the `GuestId` Ordering minted (`TicketLine.GuestId`, new). Session-time lines carry the session owner's account, so a room that only bought time still offers its owner's tab at settle. A receipt shows who ordered what as it was at the time — copying the name is the right pattern for a sales document, not drift.
- **Derived, not stored**: "who is on this bill" is the distinct keys over its lines; per-person subtotals are a fold by key; per-person settle, when wanted, is payments tagged with the same key. No parties entity — Spaces owns who is in the room, Ordering owns who ordered, Sales owns the money.
- `TicketSettled` no longer carries a ticket customer; the per-payment `AccountCharges` were already what Accounts posts.

Migration `TicketLabelAndLineGuestId`: `tickets.CustomerName` renamed to `Label` (data kept), `CustomerId` dropped, `ticket_lines.GuestId` added.

### D9 — Money on the receipt: pricing rules, frozen bills, credit notes *(2026-09-02)*

- **Rules are Sales-owned and per branch** (`BranchPricing`): VAT rate, whether menu prices already include it, service charge rate. Defaults are "menu prices are the bill". Sales owns them because the figures a receipt is computed with must not depend on another service answering at settle time.
- **Service is for being served**: it applies to what is ordered at a table or in a room — never to a counter sale, never to room time. VAT applies to everything, service included, either shown out of an inclusive price or added on top.
- **An open ticket is priced live** under the current rules; **settle freezes** subtotal, service, VAT, total and the rates onto the ticket. A rate change never moves a printed receipt. Reports sum the frozen figures.
- **A refund is a credit note, not an edit**: its own numbered document (per-branch sequence like receipts) referencing the receipt, by line and quantity, each line giving back exactly what the customer paid for it (menu price × total/subtotal). Refunding everything left gives back exactly what is left. Cash leaves the drawer (the Z report subtracts it); Account credits the tab through the refunded event; Loyalty reverses each refunded order's points in proportion (`refund:{id}:{orderId}` references, never below zero). Owner-only, reason mandatory. Deliberately not built: refunding a refund, or refunding across tickets.

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
- **Discard empty tickets (any cashier)**: `Ticket.Discard()` + `DELETE /api/tickets/{id}` behind the Pos policy. Lines only ever accumulate (`MoveLines` refuses to empty its source), so an open ticket with no lines provably has no history — nothing for a void reason to record — and the row is deleted outright; the log line is the only trace. Counter and Table only: a Room ticket is empty only while its session runs. Receipt numbers are their own per-branch sequence, so a gap in ticket ids is not a gap in the books.
- **POS confirms pending orders (2026-09-02)**: `GET /api/orders/pending`, `PUT /confirm` and `PUT /cancel` moved from Admin to the Pos policy (delete, history, stats and per-user lookups stay Admin). The human confirmation step stays — auto-confirming customer orders was weighed and declined by the owner: stock is validated *before* an order is ever pending, so confirmation is staff accepting it (customer push, ticket lines, loyalty), and the last point a cancel is possible. pos_web: a "Waiting for confirmation" strip on the floor (Confirm on the card; tap for items, note and Cancel), the admin board's chime + toast on submitted/reminder events over the hub group the till already joined, and a **settle guard**: a ticket whose table or session still has an unconfirmed order shows them inline and warns before settling — confirmed after the settle, the order would lazily open a fresh ticket for a group that already paid.
- **Rooms and sessions on the till (2026-09-02)**: the Spaces session-control endpoints (start reserved / walk-in, end, cancel, player mode, assign customer, add/remove member, active sessions) moved from Admin to the Pos policy; room set-up (create/edit/delete, maintenance, QR, history, stats) stays Admin. pos_web gets a **Rooms** screen (tiles with live clocks, reservation countdowns, rates) and a room panel with every control admin_web's panel has, plus **Cancel without charge** for a running session (admin_web only cancels reservations). A Room ticket shows a **session bar** (clock, mode, billed-so-far, End session, room controls) and a **settle guard**: the time only lands on the bill at `SessionCompleted`, so Settle on a running session offers to end it rather than proceed — settled first, the time would open a fresh ticket after the group paid. **Sales closes the gap it had**: it now subscribes to `ReservationCancelled` and drops the cancelled session's still-empty ticket (one that already carries lines stays open with a warning — someone settles or voids it). Reserving a room from the till is left out: customers reserve from their apps.
- **Move lines onto an existing ticket (2026-09-02)**: `Ticket.MoveLinesTo(target, lineIds)` beside the split — the customer who ordered at Table 1 and then took Room 1. Any open target in the same branch, Room included; session-time lines never move; a Table/Counter source left empty is discarded in the same transaction (so "an empty ticket has no history" still holds), a Room source stays for its session. `POST /api/tickets/{id}/move-lines` takes an optional `targetTicketId` (without it: the split as before) and returns the ticket the lines ended up on. pos_web: the Move button in select mode opens a picker — the floor's open bills, a new counter tab (named or not), any free table (its bill opened and filled in one step; a table that already has one takes the lines onto it, per Q7), and "New ticket for this place" (the turnover split; hidden for room tickets and when every line is selected). A room ticket can hand lines to any of these; it just never gets a second bill of its own. **Hardening shipped with it**: the confirmed-order handler now dedupes redeliveries across all tickets (`ITicketRepository.HasOrderAsync`), not just the one the order would land on — after a move, a redelivered confirmation would have re-appended the lines where they first landed.
- **Sales outbox + concurrency tokens (2026-09-02)**: Sales modelled the `IntegrationEventLog` table but never used it — every event went straight to the bus, and domain events were dispatched before the commit, so the floor was nudged before the row existed, a failed commit still emitted, and `TicketSettled` (what makes Accounts post a tab charge) was fire-and-forget after the save. Now: `SalesTransaction` runs one transaction per unit of work and publishes the outbox after the commit; MediatR commands get it through `TransactionBehavior`, the bus handlers that assemble tickets call it directly. `ISalesIntegrationEventService` mirrors Ordering's. Postgres `xmin` is the concurrency token on `tickets` and `shifts`: two tills settling one ticket, a settle racing a discard, a shift closed twice — the second writer gets "Someone else changed this a moment ago. Reload and try again." (the receipt-number retry stays, EF's savepoints keep the transaction usable across it). *Spaces still publishes directly from its domain event handlers (8 sites, no outbox service) — same refactor, scheduled separately.*
- **Tax, service charge and refunds (2026-09-02)** — see D9. `BranchPricing` (Sales-owned, `GET/PUT /api/tickets/pricing/{branchId}`, PUT Owner-only; admin_web edits it from the branch card) → `Ticket.GetBill(rules)` prices open tickets live and `Settle` freezes subtotal / service / VAT / total and the rates onto the ticket; `Refund` is a numbered credit note (`POST /api/tickets/{id}/refunds`, Owner) per line and quantity, giving back what the customer paid for the line (its share of service and VAT); cash refunds reduce the shift's expected drawer, account refunds credit the tab (Accounts, idempotent by reference), and Loyalty claws back each refunded order's points in proportion. The till: receipt breakdown, a Refund action and credit-note list on settled tickets, and a **Receipts** screen (`GET /api/tickets/settled`, newest receipt first, find by number) — the way back to a bill after it leaves the floor, to reprint or refund it. **One floor that scales with activity, not with the building** (settled after three rejected cuts — a stacked tile grid, a segmented one, a map-plus-bills split — each "too crowded", and the owner's real constraint: many rooms and tables): the floor shows only what is *happening* — open bills by last activity (one line each: place or label, line count, the clock for a running room, the total), the app orders waiting for a tap, and reservations about to arrive (room, name, expiry countdown; tap opens the room's controls). Nothing static is drawn. Every free room or table sits in a **narrow left column** — the searchable list that briefly lived behind an Open button, made permanent to save the tap (owner's call): rooms with their state, tables, "new tab"; a room opens its controls, a table opens its bill. It scrolls and searches on its own, so it never grows the screen. The separate Rooms screen is gone. *(Tried and reverted 2026-09-02: a rail shared with the ticket screen, open bills on top of the places list — the owner preferred the ticket screen on its own.)*
- **`Cashier` Keycloak role**: new central `"Pos"` policy (Admin | Owner | Cashier) in ServiceDefaults; applied to Sales tickets + shifts, `POST /api/orders/pos`, and the Identity user search (the one identity read the till needs). Realm role added to chillax-realm.json + idempotent role upsert in deploy.yml. Void stays Owner-only.
- ~~**Loyalty on session time**~~ **Reverted 2026-09-02 (owner's call): points are earned by ordering, not by booking a room.** Loyalty's `TicketSettled` subscription and handler are gone; accrual happens only at order confirmation. The settled event still carries `TimeTotal` (session-time lines only) as reporting data, and points already awarded were left on accounts. **Hardening bonus**: the existing order-confirmed Loyalty handler had no redelivery dedup (a redelivered event re-redeemed *and* re-awarded) — now dedupes on the order-id reference.
- **Customers on the till (2026-09-10)** — the customer in front of the cashier, at a glance, and their tab as something to act on. **Points are the app's, not the till's** (owner): the card shows the loyalty balance and tier as information only — no redemption, no enrolling at the counter — so customers earn, join and spend in the app. In-context **customer card** (no browse-all list; the back office has that) opened by tapping a customer wherever they already appear on the till: the sale pad chip (which also shows the points line), a ticket's per-person group heading, a room member chip, an info button on each search row, and a **Find customer** icon beside Receipts on the floor's toolbar (search, then the card — the customer who walked in only to pay their tab). It shows name and phone, points ≈ EGP and tier (or "not in the program"), and the tab: owed / in credit / settled up, with **Pay tab**. The settle dialog's "Whose account?" rows now show what each holder already owes beside their share of this bill, so nobody adds to a tab blind. **Pay tab is Sales-owned**: `TabPayment` is its own numbered slip per branch (`tab_payments`, migration `TabPayments`), Cash / Card / InstaPay only, stamped with the branch's open shift whatever the tender; cash raises `ExpectedCash` / `ExpectedInDrawer`, card and InstaPay reconcile against the terminal; `ShiftView` and `RangeReport` carry `tabPaymentTenderTotals` beside the sales figures, never inside them (the sale was counted when the bill went on account). `POST /api/tickets/tab-payments` (Pos, x-requestid; number 0 on a replay), `GET /api/tickets/tab-payments[/{id}]`. `TabPaymentRecorded` → Accounts posts the Payment (`sales-tab-payment:{id}`, source `PosTabPayment`, the slip number as `SourceNumber`), opening the tab if none exists so money already taken is never lost. No void: a slip made in error is reversed by a manual charge on the ledger (plus a cash pay-out if cash was handed back). **Access tightened with it**: `ClaimsPrincipalExtensions.CanActFor` (self or Pos staff) guards Loyalty's per-user reads, enrolling is self-or-Admin with the customer's name supplied (it used to store the caller's), `POST /transactions/earn` is Admin, and Accounts gained a Pos-readable `GET /api/accounts/{customerId}/balance` (the ledger stays Admin). The tills print an 80 mm slip; both `pos_web` and `pos_app` (which reuses the settle keypad and a shared `TenderGrid`, and hides the balances while offline) carry it; the four other clients label the new ledger source "Tab payment #N".

- **Bill discounts (2026-09-16)** - one discount per ticket, a percent or an amount with a mandatory reason, applied to the menu subtotal before service and VAT (`Ticket.ApplyDiscount` / `RemoveDiscount`, `POST`/`DELETE /api/tickets/{id}/discount`, Pos policy). A cashier is held to the branch's `BranchPricing.MaxCashierDiscountRate` (default 10 %, edited in the admin pricing dialog); an owner is uncapped. Settle freezes `Discount` beside the other figures; refunds needed no change (they give back `Total/Subtotal` per menu pound, and `Subtotal` stays the pre-discount menu money); the Z report and the range report count it in `Discounts`. Both tills: a Discount button on the open ticket (value, %/EGP, reason; Remove when one is on), the discount on the bottom-bar breakdown, the receipt and the Z report. Migration `TicketDiscount`.

- **Sales breakdown (2026-09-16)** - `GET /api/tickets/reports/breakdown?from&to&offsetMinutes` (Pos policy, branch from the header): the window by hour and weekday (in the caller's clock, hence the offset), by cashier (tickets, net, discounts, voids, refunds - voids and refunds attributed to whoever gave them) and by item (the line's name snapshot, qty, tickets, amount, top 50; negative lines excluded). Sales has no catalog ids on ticket lines, so there is no by-category cut; adding `CatalogItemId` to `TicketLine` from the confirmation event would enable it later. admin_web: Till > Breakdown tab, bars as divs, two tables. No Flutter surface (admin_app is retiring).

- **Receipt header per branch (2026-09-16)** - `Branch.TaxNumber` and `Branch.ReceiptFooter` (LocalizedText) on Branch.API (`PUT /api/branches/{id}`, migration `BranchReceiptHeader`), edited in the admin branch dialog. Both tills print the active branch's name, address, phone and tax number under the wordmark, and its footer line instead of the till's thank-you when set. The Branch is read off the branch list the switcher already holds - no new request. Also brought the pos_app receipt up to parity: the discount row.

- **Scheduled offers (2026-09-16)** - the item offer gained a window: `CatalogItem.OfferWeekdays` (a bit per DayOfWeek, none = every day) and `OfferFrom`/`OfferTo` (local time, both null = all day, ending before starting runs past midnight and belongs to the day it started). `IsOfferActive` decides against the cafe's clock (`LocalClock`, Cairo, the same choice as Finance's BusinessDay); `EffectivePrice` and the DTO's `IsOnOffer` follow it, so every menu and till badge is right without a client change; the admin edits the configured switch from `Base`. A branch still overrides only the switch and the price; the window is the item's. Set on `PUT /items/{id}` and `PATCH /items/{id}/offer`; migration `ItemOfferSchedule`; `OfferWindowTest`. Admin item form: weekday chips + from/to under the offer switch (its hint paragraph is gone).

Deliberately deferred, each for a stated reason:
- **Refunds of settled tickets** — real money back plus loyalty/account reversal; needs an owner policy decision first.
- **QZ Tray** (drawer kick / ESC-POS) — blocked on open question 2 (what printer hardware exists).
- **Kitchen ready state** — **decided 2026-09-05: kitchen-only, customers never see it. Simplified 2026-09-09:** the Start / In-progress step and the 30-minute recall window are gone. Ordering keeps one kitchen field beside the order status (`Order.ReadyAt`, null while the order is on the board, plus `ConfirmedAt` for the clock); `GET /api/orders/kitchen` returns the last day's confirmed orders ready or not, and `PUT /api/orders/{id}/ready` `{ready}` marks one done or brings it back, both behind the Pos policy. `OrderReadyChanged` fans out to the admin hub group as `OrderStatusChanged{type:"order_ready"}`. Shown on `kds_web` at `kds.chillax.site` and the native `kds_app`: one grid of open orders, a Ready button per card, and a History dialog (today's finished orders, newest first) with Bring back.
- **Offline queue** — deliberately out per D6.

*UI done 2026-09-02: pos_web's role gate accepts Cashier; Owner-only Void action on the ticket screen with reason dialog and a voided tombstone view. A Discard action replaces Void while a ticket is still empty. The typed-in "Add item" line is gone from the till — the owner's call, the café sells from the menu only; the manual-line endpoint stays in the API.*

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
