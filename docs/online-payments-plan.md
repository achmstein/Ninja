# Online payments (online payment and bill splitting)

Status: built 2026-09-26; waiting on a Paymob sandbox account for the end-to-end test.
Decided: Paymob; each café's own merchant account; OnlinePayments is an add-on on
every plan (included in none); fee and tips are the café's choice.

As built (differences from the design below):
- Payment settings and the provider secrets live in Sales (the only service
  that calls Paymob), sealed with AES-GCM under a per-stack payments key the
  control plane generates and passes as PAYMENTS_KEY (never in the database).
- Routes: `/api/sales/payments/*` (places/{id}, tickets/{id}, {key}, settings,
  {key}/refund, tickets/{id}/online) and the callback
  `POST /api/sales/payments/paymob/callback?hmac=` (unversioned, never blocked).
- Guests return to `{customer}/pay/{key}`; the page polls the payment.
- Paid shares become `Online` tender when the ticket settles: by itself at
  100% (settledBy "online") or at the till, which takes only the rest.
- A refund through the provider is allowed while the bill is open; a closed
  bill is refunded with a credit note and from Paymob's dashboard.
Reference: Qlub (app.qlub.io) screenshots the user shared — view the table's
bill, "Pay fully" or "Split bill" (pay for your items / divide equally / pay
a custom amount), online payment fee line, Apple Pay / card / local debit.

## Goal

A guest at a table (or a signed-in customer on their bill) pays part or all
of the bill online from the customer app. The till sees online payments live;
the bill closes itself when fully paid. Sold per café as a module.

## Decisions to confirm with the user before coding
1. **Provider: Paymob** (Egypt; cards, Apple Pay, wallets, Meeza). Needs a
   test (sandbox) merchant account from the user.
2. **Money flow: each café's own Paymob merchant account** (keys entered by
   the owner). Ninja never holds funds. (The alternative — Ninja as payment
   facilitator — is out of scope.)
3. **Plan**: new module `OnlinePayments`; included in which plans vs add-on.
4. Fee: café chooses whether the guest pays the online fee (percentage +
   fixed, shown as its own line) or the café absorbs it. Tips: optional.

## What exists (read these first)

| Piece | Where |
|---|---|
| Modules and plans | `src/Control.API/Platform/Plans.cs` (`Module` enum, `PlanCatalog`), `BusinessProfiles.cs`; entitlements pushed via `PUT /api/tenant/entitlements` (`src/Tenant.API/Apis/TenantApi.cs` → `SetEntitlements`) |
| Feature flags on the stack | `src/Tenant.API/Model/Tenant.cs` → `TenantFeatures` record; `TenantFeaturesChangedIntegrationEvent` (Tenant.API publishes; Spaces etc. consume) |
| Owner's module switches | admin_web brand/features page (`src/admin_web/src/features/brand/index.tsx`) |
| Bills (tickets) | `src/Sales.Domain/AggregatesModel/TicketAggregate/{Ticket,Payment,PaymentTender,Refund}.cs`; `Ticket.Settle(...)` requires payments to cover the total; `src/Sales.API/Apis/TicketsApi.cs` (`/{id}/settle`, `/payments`) |
| Guest bill view | `src/client_web/src/routes/bills.tsx`, `src/client_web/src/lib/bills.ts`, `src/client_web/src/components/bills/bill-slip.tsx`; room bills already know "whose round" per member |
| Till settle UI | pos_web `src/pos_web/src/features/ticket/*` (settle dialog), pos_app `lib/features/ticket/*` |
| Real-time | SignalR hubs (`/hub/*`) used by till/KDS — reuse for "paid online" pushes |

## Design

### Module and settings
- `Module.OnlinePayments` in Control.API; add to `PlanCatalog` (Included/Addon
  per the decision), `TenantFeatures.OnlinePayments` on Tenant.API, the features
  event, admin switch (only when entitled), client_web/client_app feature
  flag (`features.onlinePayments`).
- **Payment settings** (Tenant.API, café-wide, owner-only, admin "Payments"
  page): provider = paymob, API/secret key, public key, integration ids per
  method (card, Apple Pay, wallet), HMAC secret, fee mode (guest|café) with
  percent + fixed, tips on/off + presets, allowed split modes. **Secrets
  encrypted at rest** (use ASP.NET Data Protection with a key persisted in
  the tenant's volume, or the platform's secret store — decide), never
  returned by GET (show "set ••••1234"). Publish a
  `TenantPaymentSettingsChanged` event carrying only non-secret flags for
  other services; only the payments owner holds secrets.

### Where payments live
Add a **Payments** bounded context inside **Sales** (tickets are Sales'), not
a new microservice:
- `OnlinePayment` aggregate: id, ticketId, branchId, amount, fee, tip,
  currency, split mode + detail (item ids / people counts / custom), payer
  (userId or guestId + name), provider, provider intention/order id,
  status (Pending → Paid | Failed | Expired | Refunded), timestamps.
- On **Paid** (webhook), add a `Payment` to the ticket with a new
  `PaymentTender.Online` (+ provider reference), and if payments now cover
  the total, **auto-settle** the ticket (settledBy = "online").
- Concurrency: two guests paying the same items/amount at once — reserve
  the share when the intention is created (Pending holds for ~15 min);
  "remaining" = total − paid − pending holds; reject intentions exceeding
  remaining; expire holds.

### Paymob integration (verify every detail against Paymob's current docs)
- Create a payment **intention** server-side with the café's secret key
  (amount in piasters, billing data from name/phone, items, integration ids,
  notification/redirection URLs) → returns a client secret; the customer app
  opens Paymob's **unified checkout** (or the pixel/embedded SDK).
- **Webhook** (`POST /api/sales/payments/paymob/webhook/{tenant}` through the
  gateway, anonymous): verify the **HMAC** with the café's HMAC secret,
  idempotent by transaction id, then mark Paid/Failed. Never trust the
  redirect alone; the redirect page polls our API for the status.
- Refunds: admin/till "refund online payment" calls Paymob refund API and
  records a Sales refund.
- Keep a provider interface (`IPaymentProvider`) so Kashier/Geidea/Fawry can
  follow; implement Paymob only.

### Customer app (client_web first, then client_app)
- On the bill: "You pay" summary, **Pay fully** / **Split bill**.
- Split sheet (bottom sheet, like the screenshots):
  - **Pay for your items**: list with select toggles; already-paid items
    disabled; shows your share.
  - **Divide equally**: people at the table (default = room members if
    known) and how many you pay for; ring visual.
  - **Custom amount**: up to remaining.
- Summary: your share, online fee (if guest pays), tip, **You pay**; methods
  from settings (Apple Pay shown only on Safari/iOS); Confirm → provider
  checkout → return page with live status → receipt.
- Other guests see "Paid so far / Remaining" live.
- en + ar (Egyptian and Standard files), زائر for non-registered.

### Staff side
- Till (pos_web + pos_app) ticket screen: "Paid online" rows with payer and
  provider ref, remaining amount, live via SignalR; settle dialog accounts
  for online payments; auto-settled bills move to settled.
- Admin: Payments settings page; online payments report (by day, fees,
  refunds) — can be a later step.
- Shift/drawer: online payments are not cash — exclude from drawer
  expectations, show separately in the X/Z report.

## Steps
1. Decisions confirmed; sandbox keys from the user.
2. Control.API module + plans; Tenant.API features + payment settings (secret
   storage) + events; admin switch + Payments page; tests.
3. Sales: OnlinePayment aggregate, remaining/holds logic, `PaymentTender.Online`,
   auto-settle; unit tests for all split modes and races.
4. Paymob provider: intention, webhook + HMAC, refunds; tests with recorded
   payloads; sandbox end-to-end.
5. client_web: pay/split UI + return page; tests; screenshots.
6. Till web + app: online payment rows, live updates, settle integration,
   shift report.
7. client_app parity.
8. E2E on a demo tenant with Paymob sandbox; then release.

## Acceptance
- A table of 3 splits a bill three ways (items / equal / custom) from 3
  phones; the till shows each payment live; the bill auto-settles at 100%.
- Overpay impossible; concurrent payers can't double-pay the same items.
- Webhook forged without a valid HMAC is rejected; duplicates are no-ops.
- Module off (plan or owner switch) → no pay buttons anywhere.
- Secrets never leave the server; not in logs, API responses or backups
  unencrypted.
