# Chillax — System map

**Goal:** one home for every function, so nothing is built twice and nothing is left half-alive. The backend already has this shape — twelve bounded contexts, events only, one owner per fact (`pos-plan.md` D5b). This page fixes the same rule for the front-ends and records what is stale.

**Status:** decided 2026-09-15.

---

## 1. Services (unchanged)

| Service | Owns | Talks to others by |
|---|---|---|
| Catalog | The menu, prices, customizations, availability | events; the assistant's menu features |
| Ordering | Orders, baskets, validation | events |
| Spaces | Rooms, tables, sessions and their time billing | events |
| Sales | Tickets, tenders, shifts, the drawer | events (tickets are built from Ordering/Spaces events) |
| Inventory | Stock items, recipes, the ledger, receipts, counts, transfers, costs | events; the assistant's receipt scan |
| Finance | Expenses, suppliers' and partners' accounts, the P&L projection | events; the assistant's bill scan |
| Payroll | Employees, attendance, pay | events |
| Accounts | Customer tabs | events |
| Loyalty | Points | events |
| Identity | Who can sign in (Keycloak) | — |
| Branch | Branches, business-day window, settings; the tenant's brand (name, color, logo, icons, manifest) and feature switches | events; `GET /api/tenant` read by every surface at boot |
| Notification | SignalR hub, FCM push, announcements | consumes everyone's events |

No service calls another over HTTP; where a screen needs two services' data, the SPA or the YARP BFF joins.

## 2. Surfaces — one audience each

| Surface | Audience, device | Owns | State |
|---|---|---|---|
| `admin_web` | Owner / manager at a desk | Everything back-office: dashboard, menu (with the assistant), inventory, finance, payroll, staff, customers, loyalty, announcements, branches, settings, till reports | The reference. Keep. |
| `pos_web`, `pos_app` | Cashier at the counter (tablet), all day | Tickets, floor, sessions, tabs, drawer, requests, pay-outs to staff / suppliers / partners | Done. Keep. |
| `kds_web`, `kds_app` | The kitchen screen | Orders to make | Done. Keep. |
| `client_web`, `mobile_app` | Customers | Menu, ordering, rooms, loyalty, tabs | Keep. |
| **Manager phone** — a new Flutter app scaffolded from `pos_app` (same forui / riverpod / go_router / dio stack) | Owner / manager on the move | The owner's glance (today's till, month money, low stock), stock on the go (count by area, receive with the camera and the receipt scan, waste), a bill scanned onto an expense, push (`new_order`, `stock_low`), approvals later | **To build.** Replaces `admin_app`. |
| `admin_app` | — | — | **Retired 2026-09-18.** `admin_web` installs as a PWA (manifest, icons) and subscribes this browser as the admin push device from the profile menu, so the day's digest, new orders and requests reach the owner's phone without a store app. Its ARB strings moved to `src/admin_web/i18n/`. |

Rules that follow:

- A function lives in one surface. A second surface may *read* it (the POS shows what is sold out) but never edits it.
- The phone app is not "admin_web on a phone": it takes only the jobs done standing up. Anything done sitting down stays in `admin_web`.
- Every surface generates its own SDK from the services' OpenAPI documents and shares patterns and copied components, not a build (`pos-plan.md` D5).

## 3. The AI assistant

One shared library (`src/Ninja.AI`), one chat model, one agent per feature, owned by the service that owns the data, always proposing and never writing (`ai-assistant-plan.md`). Surfaces show the sparkle; services answer 503 when no model is configured and the surfaces hide it.

## 4. What is not clean yet, in order

1. ~~`admin_app`~~ retired 2026-09-18 (above).
2. `*.FunctionalTests` — eShop-era in-process harnesses, stale; the E2E suite covers what they did.
3. ~~`README.md` still opens as eShop's~~ rewritten 2026-09-19 as the Ninja README (see `ninja-plan.md`).
