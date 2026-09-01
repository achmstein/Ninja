# Chillax POS — Analysis & Plan

**Goal:** replace Loyverse (Open Tickets for rooms + counter sales) with a POS built into Chillax, handling both **live orders** from the customer apps and **direct orders** taken at the counter.

**Status:** proposed 2026-08-29 — awaiting decisions on the open questions at the bottom.

> **Naming note (2026-09-01):** `Rooms.API` / `Rooms.Domain` / `Rooms.Infrastructure` are now
> `Spaces.API` / `Spaces.Domain` / `Spaces.Infrastructure`, since the service owns café tables
> alongside rooms. The database is `spacesdb` and the schema is `spaces`. Public routes are
> unchanged (`/api/rooms`, `/api/sessions`, plus the new `/api/tables`). Paths below predate the
> rename.

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
| Realtime plumbing | `Notification.API` hub + `admin_web/src/hooks/use-admin-notifications.ts` | Done. Admin group, reconnect/backoff, poll fallback. |
| Business-day window | `Branch.API` (`DayStartTime` 17:00 → `DayEndTime` 05:00) | Exists but **unused by any query** — perfect for day reports. |
| Analytics | `/api/orders/stats`, `/api/rooms/sessions/stats` + dashboard | Partial. Revenue is gross; no tender split, no discounts/voids, no Z-report. |

### What is missing (the actual POS layer)

1. **No check/ticket object.** Session time lives in Rooms, order totals in Ordering, tabs in Accounts — nothing unifies "room 3's 2.5h Multi + 3 lattes" into one payable bill. "Get Bill" (`ServiceRequestType.ReceiptToPay`) is just a staff ping.
2. **No payment anything.** No tender types, no split payment, no change, no VAT, no receipt entity, no receipt numbering, no printing.
3. **No shift / cash drawer / Z-report.**
4. **Orders and sessions are joined only by a display string.** `Order.RoomName` is a `LocalizedText` snapshot — no `SessionId`/`RoomId` FK. You cannot query a session's consumption.
5. **`SessionCompletedIntegrationEvent` has zero subscribers** — published with the full cost breakdown "for billing/loyalty", consumed by nobody. This dangling event is the cleanest integration seam in the whole system.
6. **Walk-in orders don't exist.** `CreateOrderRequest` mandates `UserId`/`UserName`; a counter cash sale has no representation.
7. **Money math is client-trusted.** `Order.GetTotal()` ignores `OrderItem.Discount` and `LoyaltyDiscount`; the loyalty discount and even `UserId` come from the request body (an Admin token can already order on behalf of anyone — useful for POS, but currently an authz hole for customers too).
8. **Only `Admin`/`Owner` roles** — no cashier attribution beyond `RecordedBy` in Accounts.

### Bugs found during analysis (fix along the way)

- Reservation expiry is **10 minutes** (`Reservation.ReservationExpirationMinutes = 10`) while all UI copy in both clients says **15**.
- `Order.GetTotal()` returns gross subtotal — discounts never subtracted (also inflates `/stats` revenue).
- `GET /api/rooms/sessions/my` is unpaged/unbounded and fetched on a 15s timer by the Flutter app.
- `CreateOrderRequest.UserId` taken from body, not token (any authenticated user can create orders as someone else).

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
OrderConfirmed        ──► Sales: append order lines to the session's ticket (idempotent by OrderId)
SessionCompleted      ──► Sales: append time lines (Single X.Xh @ rate, Multi Y.Yh @ rate)  ← finally subscribes it
Settle (API call)     ──► Ticket → Settled, Receipt issued
  tender = Account    ──► TicketSettledOnAccount ──► Accounts.API posts a Charge (auto, at last)
OrderConfirmed        ──► Loyalty (already exists, unchanged)
```

While a session is active, the POS shows order lines from the ticket plus a **live time preview computed in the UI** from session data (the room panel already does this); the authoritative time lines land only at `SessionCompleted`, so rounding stays server-owned in one place (`Reservation.GetRoundedHoursForMode`).

### D3 — Ticket model sketch

```
Ticket:      Id, Number, BranchId, Type (Room | Counter), SessionId?, RoomId?,
             CustomerId?, CustomerName?, Status (Open | Settled | Voided),
             OpenedAt/By, SettledAt/By, Lines[], Payments[]
TicketLine:  Source (Order | SessionTime | Manual), OrderId?, Description (localized),
             Qty, UnitPrice, Discount, Total
Payment:     Tender (Cash | Card | InstaPay | Account), Amount, ShiftId?, RecordedBy
Receipt:     Number (per-branch sequence), TicketId, issued snapshot
```

Split payments = multiple Payment rows; server validates `Σ payments ≥ total` (change on cash) and freezes the ticket.

### D4 — Counter sales are real Orders

A counter sale creates an actual `Order` (walk-in buyer, `Source = Pos`, auto-Confirmed since the cashier *is* staff), which flows onto a `Counter` ticket via the same `OrderConfirmed` event. This keeps **one source of truth for item sales** — top-items stats, loyalty accrual (when a customer is attached), and the barista's order board all keep working without a parallel path.

### D5 — The POS UI is a mode of admin_web, not a new app

admin_web already has the auth, the branch switcher, EN/AR + RTL, the generated SDKs, the SignalR reliability layer, and the three operations screens staff keep open. A new `/pos` route group gives a touch-first, fullscreen experience while reusing all of it. Needed alongside:

- **PWA for admin_web** (client_web already has the pattern: manifest, icons, SW) — installable on a counter tablet, standalone display, wake lock.
- **Tablet breakpoint** — `use-mobile.tsx` has a single 768px cutoff; 10" tablets currently get desktop layouts.
- **Numeric keypad component** for amounts (no OS keyboard popping over the settle dialog).

Hardware caveat, decided eyes-open: a browser can print to any **Windows/OS-installed 80mm thermal printer** via `window.print()` + print CSS, but it **cannot kick a cash drawer or drive Bluetooth ESC/POS printers directly**. If that's needed, phase 4 adds QZ Tray (a small local agent that bridges browser → raw ESC/POS + drawer kick) — no rewrite required.

### D6 — Online-only for v1

Loyverse works offline; this POS won't at first. The backend is remote, and staff already depend on admin_web live — the POS accepts the same risk. An offline queue is a large architectural investment (queueing across ~20 generated mutation hooks, conflict handling) and is deliberately out of scope; noted as a possible later phase if connectivity proves to be a real problem.

### D7 — Server becomes the pricing authority

Before cashiers can key discounts, money math moves server-side: `UserId` from token (with an explicit Admin on-behalf/walk-in path), loyalty discount recomputed by the server, `GetTotal()` net of discounts. This fixes the existing authz hole at the same time.

---

## 3. Delivery phases

### Phase 0 — Backend seams (no visible change)

1. `Order.SessionId` + `Order.RoomId` nullable FKs + migration; clients send the active session's id at checkout (they already look it up to send `roomName` — keep the name for display); `GET /api/orders?sessionId=`.
2. Pricing authority: token-derived `UserId`, server-side loyalty discount, net `GetTotal()`.
3. Walk-in/POS orders: nullable buyer, `Source` (Customer | Pos), admin create-and-confirm path.
4. Drive-bys: 10-vs-15-minute expiry copy, page `GET /sessions/my`.

### Phase 1 — `Sales.API` + room tickets *(replaces Loyverse Open Tickets)*

1. New service per house template; DB `salesdb`; BFF route `/api/sales`; `npm run generate:api`.
2. Ticket aggregate; subscribe `SessionStarted`, `OrderConfirmed`, `SessionCompleted`; endpoints: open tickets, ticket detail, manual line, settle (cash first), reprint.
3. admin_web `/pos`: floor view (rooms grid with live check totals + open tickets), ticket screen (lines + live time preview + settle dialog with keypad and change due), 80mm receipt print CSS.
4. Ticket events → SignalR admin group for live updates.
5. admin_web PWA + tablet breakpoint.

**Milestone: room billing runs entirely in Chillax; Loyverse only still used for counter sales.**

### Phase 2 — Counter POS *(replaces Loyverse entirely)*

1. Item pad: category tabs + item grid + customization sheet + cart (ported from `client_web/src/lib/cart.ts`).
2. Walk-in order → counter ticket → immediate settle → receipt. Optional attach-customer for loyalty.
3. Tenders: Card, InstaPay, split payments; **Account** tender → auto Charge in Accounts.API.

**Milestone: Loyverse switched off.**

### Phase 3 — Cash management & reporting

1. Shift aggregate: open float, pay-in/out, close count, over/short; payments stamped with shift.
2. X/Z reports; day report bucketed by the Branch business-day window (finally using it); tender split + discounts in dashboard analytics.

### Phase 4 — Hardening & extras (pick as needed)

Voids/refunds with audit (Owner-gated) · `Cashier` Keycloak role · QZ Tray for ESC/POS + drawer kick · loyalty points on session time · kitchen prep statuses (Preparing/Ready) · offline queue.

---

## 4. Open questions (answers shape phases 1–3)

1. **Tenders:** what do customers actually pay with today — cash only, card machine, InstaPay/wallets? (Determines the tender enum and whether split payment is v1.)
2. **Printer:** what does Loyverse print receipts on now (model, USB/Bluetooth)? Do you use a cash drawer with kick? (Determines whether browser printing suffices or QZ Tray moves up.)
3. **VAT / ETA:** plain receipts, or do you need VAT lines / Egyptian e-receipt compliance?
4. **Shifts:** is cash counting/Z-report needed at launch, or is phase 3 timing fine?
5. **Counter orders on the barista board:** should POS counter sales appear on the orders board for preparation, or settle silently?
6. **Naming:** `Sales.API` for the new service, and "Ticket" as the user-facing term (matching Loyverse) — OK?
