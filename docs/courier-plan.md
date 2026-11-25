# Courier plan: outside couriers for a business, and a courier app Ninja sells

Status: planned 2026-11-25, checked against the code the same day; nothing built. Phase 1 is the
only phase to start now.

Decided (owner, 2026-11-25):
- Ninja does not run couriers. It sells a **courier app** to courier companies, and that app
  integrates with Ninja businesses.
- Every business gets an **outside courier** mode first, with one provider interface any courier
  company can sit behind. The courier app is one provider among others.

Recommended, to confirm before the phase that needs each (section 8): the app is priced per
completed delivery; courier companies charge businesses per zone; the courier company carries
cash risk and sets its payout cycle; customer details go after 90 days.

## 1. Goal

A business with no riders of its own takes delivery orders on its own app and site, hands them
to a courier company from the till, and keeps the customer. Today its only way to deliver without
riders is an aggregator (Talabat), which owns the customer and takes a commission.

Non-goals:
- Orders from aggregators. Talabat stays as it is (docs/talabat-integration.md).
- Replacing a business's own riders. Riders and couriers sit side by side, chosen per order.
- Live map tracking and automatic courier assignment in a first version.
- Ninja employing couriers, holding cash, or setting what couriers charge.

## 2. What exists today

- **Isolation.** Each business is its own stack: databases, realm, broker vhost. Nothing spans two.
- **Riders.** A rider is a staff account in the business's realm with the Rider role and one or
  more branches (`RiderAccount` in Ordering, announced by Identity). On duty counts at every
  branch on the account (`RiderPresenceRule`).
- **Rider app.** One generic build (`com.ninja.rider`) that connects to one business. It lists
  what the rider was given at any of their branches and names the pickup branch on the card.
- **Delivery.** `Delivery` on the order in Ordering.Domain, with a `Version` and the stages
  Waiting, Assigned, OnTheWay, Delivered, Failed, Returned. The till gives and takes back
  (`DeliveryStepCommands`); the rider says out, delivered, failed.
- **Cash.** The rider hands cash in at the till (`HandInDeliveryCashCommand`), and Sales settles
  the bill with it (`DeliveryCashier`).
- **Who reads the stages.** `OrderDeliveryChangedIntegrationEvent` feeds the till's board, admin's
  riders pages, the customer app's tracking, and the pushes. Anything that moves the stages the
  same way keeps all of them working.
- **The reverse direction.** A Talabat order carries a `PlatformOrder`; the platform's rider
  collects at the counter and Sales settles it to the tender `Talabat`. Calls in arrive at the
  control plane, signed, and are passed to the stack; calls out go through the control plane's
  relay. That shape is the one to copy.

Why the rider app cannot simply be given to a courier company: a courier serves many businesses
in one shift and would need an account in each, switching between them.

## 3. Shape

```
business stack (Ordering) ──request/cancel──► provider ──► its couriers
business stack (Ordering) ◄──signed status──── provider
```

A delivery is with **one of the business's riders or one courier provider, never both**. A
courier's steps, marked by the till for a manual courier and reported by the provider for a
networked one, move the delivery through the stages the rider app's taps move it through today. Providers, in build order:

1. **Manual courier** (phase 1). The till types the courier's name and phone and marks the stages
   itself. No integration. Works with any courier company that takes jobs by phone.
2. **Ninja's courier app** (phase 3), one credential per courier company. The provider interface
   and the signed status calls are built with it.
3. **Third-party couriers**, one adapter each, when a business asks.

## 4. Phase 1: outside courier in each business

Sold as part of the Delivery add-on; no new add-on. Phase 1 builds the **manual courier only**:
nothing is called over the network, so the provider interface and the status endpoint wait for
phase 3, when the first provider that needs them exists (section 6).

### Ordering

- `Delivery` gains a courier, exclusive with its rider: provider key, courier name and phone,
  quoted fee, and what the courier collected. Later, for a networked provider: its job id and a
  tracking link.
- Domain rules that change (checked against `Delivery.cs`):
  - `MarkOut` refuses a delivery with no rider (`DeliveryErrors.NoRider`). It must accept a
    rider **or** a courier.
  - `AssignCourier` and `UnassignCourier` follow `AssignRider` and `Unassign`: only before the
    order has left. Giving it to a courier takes it from a rider, and the reverse.
  - A new step, `MarkCourierCollected(amount)`, stands where `MarkCashHandedIn` stands for a
    rider: only after delivered, once. It is what settles the bill (see Sales).
  - Out, delivered, failed and returned are otherwise unchanged, and `Version` guards them all.
- The till takes every step for a manual courier, as it already can for a rider whose phone
  cannot (`DeliveryProgress` policy). No new policy.
- `DeliveryAssignment` (the history) records the courier and provider where it records the rider.
- `OrderDeliveryChangedIntegrationEvent` gains `CourierProvider`, `CourierName` and
  `CourierCollected`. `RiderUserId` stays null for a courier, so Notification rings no rider
  without being told; the customer's "on the way" push says the courier's name where it says
  the rider's.
- `DeliveryOrder` (the board's and the apps' view) carries the courier.
- The board keeps a delivery until its cash is in or its bill is paid; a courier delivery leaves
  it when its bill settles, which sets `PaidAt` as any settled bill does.
- A branch setting, off by default, names the provider the till offers first when no rider is on
  duty. Sending by itself waits for a networked provider.

### Sales

- A new tender, `PaymentTender.Courier = 6`, with the provider's name on the payment: never cash
  in the drawer and never offered at the till, exactly as `Talabat` is.
- Settling follows `DeliveryCashier`, with its four outcomes, on the event that says the courier
  collected instead of the one that says the till took cash in:
  - collected the bill's total or more: the bill settles to `Courier`;
  - collected less: the bill stays open for the till and the shortfall is recorded;
  - the report came before the bill: it waits and settles when the bill lands;
  - the till settled it by hand already: nothing more.
- An order paid online ahead is already settled; only the courier's fee is recorded.
- A balance per provider and branch: collected for the business, less fees, less payouts. A
  payout lists the orders it covers; an order collected and not yet paid out shows as owed.
- The courier's fee is a cost of the business. Finance hears of nothing like it today (it
  subscribes to settled and refunded tickets, cash moved, purchases, stock and payroll), so
  Sales raises a new event for the fee and Finance books it. Until that ships, profit is
  overstated by the fees: do it in phase 1, not later.

### Tills, admin, apps

- **pos_web, pos_app:** the rider picker lists the branch's riders, then "A courier", which asks
  for the provider, the courier's name and phone, and the fee. The delivery card shows the
  courier and its steps: left, delivered with the amount collected, could not deliver, brought
  back. Shift reports and receipts name the new tender; an unknown tender is already kept out
  of cash.
- **admin_web:** the branch's delivery dialog (`branches/components/delivery-dialog.tsx`) lists
  the courier providers the branch uses. A new Couriers page shows each provider's balance order
  by order and records payouts. The riders pages stay about riders.
- **client_app, client_web:** the courier's name where the rider's shows. Nothing else.
- **rider_app:** unchanged.

### Tests

Unit: a delivery has a rider or a courier, never both; it can leave with a courier and no
rider; the courier's collection is taken once and only after delivery; the four settle outcomes;
the drawer does not move; the balance after a payout; the fee reaches Finance once. Functional:
a cash delivery and one paid online, through a manual courier end to end.

### Effort

About 2 weeks: Ordering 3 to 4 days, Sales and Finance 4 days, the two tills and admin 4 days.

### What phase 3 adds here (not built in phase 1)

- `ICourierProvider` (`QuoteAsync`, `RequestAsync`, `CancelAsync`) and the adapter for Ninja's
  courier app. One implementation would be an interface with nothing behind it; it is written
  when the second exists.
- Status calls in: `POST /api/orders/couriers/{provider}/status`, unversioned. The gateway only
  passes `/api/orders/*` with an API version, so it needs its own line in the route table in
  both places (`Templates.cs` and the AppHost's `Extensions.cs`), as the Paymob callback has;
  `Gateway_routes_match_the_AppHost_route_table` holds the two together.
- Signed per business. Each call carries the provider's own event id and sequence number for
  the job: an event seen before, or behind the last one applied, changes nothing. (The
  delivery's `Version` cannot be used for this; a provider does not know it.)
- Status mapping:

  | Provider says | Step | Notes |
  | --- | --- | --- |
  | Courier assigned | `AssignCourier` | name and phone saved |
  | Picked up | `MarkOut` | |
  | Delivered, with the cash collected | `MarkDelivered`, `MarkCourierCollected` | |
  | Failed | `MarkFailed` | reason kept |
  | Bag returned | `MarkReturned` | or said by the till |
  | No courier, or cancelled, **before pickup** | `UnassignCourier` | back to Waiting; the till is alerted |
  | Cancelled **after pickup** | `MarkFailed` | an order that has left cannot go back to Waiting |

- Sending by itself to a provider when no rider is on duty.

## 5. Phase 2: pilot by hand

One courier company, one area, three to five businesses with no riders, all on the manual courier.
No engineering beyond fixes. It answers what phase 3 needs: real volumes and peak hours, what
fee businesses accept, how long cash takes to come back, and what the courier company's
dispatcher actually does all day.

Gate to phase 3: the businesses still send couriers after four weeks, and the cash recorded in
admin matches what the courier company paid out.

## 6. Phase 3: the courier app

A separate product on the shared platform. **A courier company is its tenant**, as a business is
Ninja's: its couriers, prices and cash are its own and no other company sees them.

- **Courier service** (new, on the platform beside the control plane): companies, couriers,
  zones and prices, jobs, the cash ledger. Its own database. It takes quote, request and cancel
  from business stacks and sends them signed status calls.
- **In each business stack:** the provider interface, its adapter for the courier service and
  the status endpoint (the last part of section 4). About a week of the effort below.
- **Sign-in:** a platform-level realm for courier companies' staff and couriers. A courier
  belongs to one company; one account serves every business that company serves.
- **Dispatch board** (web): open jobs by area, couriers on shift and what each carries, assign
  and reassign by hand, record cash handed in.
- **Courier app:** the rider app's screens in a second build that signs in to the courier
  service: the job list, the card with the business and branch to collect from, the bottom
  sheets, the duty switch, the pushes. Shared code lives in `ninja_app_core`; the rider app's
  deliveries feature moves there first.
- **Pricing:** a flat fee per zone, with distance bands as an option, quoted before the till sends.
- **Cash ledger:**

  | Ledger | Up | Down |
  | --- | --- | --- |
  | Courier's cash in hand | a cash order delivered | cash handed in, recorded by a dispatcher |
  | Owed to a business | a cash order delivered for it | fees charged; payouts made |
  | Fees earned | a job delivered, or failed after pickup | a fee refunded in a dispute |

  A cash limit per courier: past it, no new cash jobs until they hand in.
- **Connecting a business:** the business's owner picks a courier company; the company accepts;
  the control plane gives the stack its credential for that company and the company its signing
  key for that stack. Either side can end it.
- **Billing courier companies:** per completed delivery, counted by the courier service.

Effort: about 6 to 10 weeks for a first version. The dispatch board, the second app build and the
ledger are most of it.

Gate to phase 4: the pilot businesses run on the courier app, payouts on schedule, and the two
sides' records match order for order.

## 7. Phase 4: grow

More courier companies and areas; automatic assignment; live courier location and a tracking
link for the customer; adapters for the third-party couriers businesses already use; masked
phone numbers.

## 8. Recommendations to confirm

| Question | Recommendation | Why | Needed by |
| --- | --- | --- | --- |
| What Ninja charges courier companies | Per completed delivery, in tiers, a small free tier, nothing per courier | Delivery software is mostly priced per task (Onfleet, Tookan) or per order (Shipday); per-courier pricing punishes part-time couriers | Phase 3 |
| What courier companies charge businesses | Flat fee per zone; distance bands optional | Businesses already price delivery by zone; easy to compare with a marketplace's commission | Phase 3 |
| Who carries a courier's cash shortfall | The courier company | It holds the cash; Egyptian couriers guarantee COD to merchants (Bosta) | Phase 2 |
| Payout cycle | The courier company's choice: next day, twice a month or weekly; weekly by default | What Bosta offers; merchants compare couriers on it | Phase 3 |
| Who pays the courier fee | The business pays the company and sets what the customer pays | Keeps the price with the business | Phase 1 |
| Couriers employed or freelance | The courier company's decision; the app pays per delivery either way | Not Ninja's once the company is a customer | Phase 3 |
| Customer details kept | Hidden from the courier when the job closes; deleted after 90 days, keeping the order number, amounts and times | Law 151 of 2020 requires a defined, limited retention period. **Confirm the period with a lawyer** | Phase 3 |

No published rate card for couriers serving restaurants in Egypt was found; actual fees come from
the pilot.

## 9. Security and data

- **What a provider gets:** the pickup branch, the drop-off address and pin, the customer's first
  name and phone, the cash to collect, the order number. Never the account, history or loyalty.
- **Phase 1 sends nothing out.** A manual courier is told the address by the business, by phone.
- **Stack to provider (phase 3):** a credential per business per provider, sealed in the stack
  as the payment secrets are (`PAYMENTS_KEY` pattern), revocable from the control plane.
- **Provider to stack (phase 3):** signed per business; unsigned, replayed or stale calls change
  nothing.
- **In the courier app:** a courier sees only jobs given to them, and the customer's phone only
  while the job is open. A dispatcher sees their company's jobs, never a business's other data
  or another company's jobs.
- **Isolation holds:** the courier service never reads a business's database. Everything crosses
  the provider interface.

## 10. Risks

| Risk | Effect | What we do |
| --- | --- | --- |
| Too few couriers at peak | Jobs wait; businesses go back to Talabat | One area first; the till falls back to a rider or another provider |
| Courier cash shortfalls | The courier company owes money it does not hold | Cash limit per courier, hand-ins recorded, the company's own terms |
| A status call is late or lost (phase 3) | A delivery stuck at the till | Retries, idempotent calls, and the till can always mark a step by hand |
| A manual courier's steps go unmarked | Deliveries sit open on the board and bills stay unsettled | The board shows them as it shows a rider's; the pilot tells whether tills keep up |
| Fee or total disputes | Businesses stop trusting payouts | One record per order on both sides, keyed by order number and job id |
| Building the courier app before demand is proven | Weeks spent on something nobody uses | Phase 2's gate |
| Two builds of one app drifting | Fixes land in one and not the other | Shared code in `ninja_app_core` before the second build exists |

## 11. Open, not yet answered

1. Does the courier app carry Ninja's name or its own brand?
2. Can a courier company on the app serve businesses that are not on Ninja? (It decides how
   much of an ordering side the courier service needs.)
3. Which courier company is the pilot partner?

Sources for section 8: bosta.co/en-eg/smes, bosta.co/en-eg/dashboard,
shipday.com/post/best-last-mile-delivery-software-2026-ranking, clickpost.ai/blog/courier-software,
menuthere.com/delivery-app-commission/talabat-egypt, tamimi.com (Egypt's data protection
regulations), kennedyslaw.com (Egypt's Personal Data Protection Law).
