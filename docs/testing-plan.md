# Testing the whole of Ninja

The aim: every piece of functionality in the solution has a test that would
fail if it broke, at the cheapest layer that can prove it. This is the map
of where that stands and the order to close the gaps.

## The layers

| Layer | Proves | How | Runs |
|---|---|---|---|
| **Unit** | A rule, a calculation, a template | Plain classes, doubles for the box (`RecordingShell`, `DryRun*`), in-memory EF | every PR, seconds (`Ninja.Web.slnf`) |
| **Functional** | A service through its front door: endpoint + auth + pipeline + persistence | `WebApplicationFactory<Program>` in-process, a Testcontainers Postgres with the real migrations, a test auth scheme | every PR, its own docker job |
| **Integration** | An adapter against the real thing | Testcontainers Postgres / RabbitMQ / Keycloak, the adapter as it runs in production | every PR, its own docker job |
| **E2E** | A day in a café across every service | `tests/Ninja.E2E`: the AppHost booted, the BFF driven, events and hub recorded | nightly / on demand |
| **Acceptance** | The platform on a real docker host | Against `deploy/platform/local`: the real API, `docker ps`, `rabbitmqctl`, a probe through the gateway | on demand, opt-in |
| **UI** | A screen does what it says | vitest for logic and components, Playwright for flows, Flutter widget tests | every PR |

Rules that hold across all of them: assert **effects** (the row, the file,
the queue, the status) rather than calls; one scenario is one story, named
as a sentence; the doubles are the ones the app itself registers (a dry
run), never hand-rolled mocks of the same interface.

## Where it stands (2026-09-22)

| Area | Unit | Functional | Integration | E2E | UI |
|---|---|---|---|---|---|
| Control plane | 109 | **12** (new: `tests/Control.FunctionalTests`) | 6 | — | control_web: 4 vitest, `e2e/ControlPlane.spec.ts` |
| Catalog | 47 | 13 | — | in scenarios | — |
| Ordering | 86 | 11 | — | in scenarios | — |
| Sales | 71 | — | — | in scenarios | — |
| Spaces | 52 | — | — | Reservation, RoomSession | — |
| Inventory | 56 | — | — | InventoryFlow | — |
| Finance | 18 | — | — | PayrollAndProfit | — |
| Payroll | 12 | — | — | PayrollAndProfit | — |
| Branch | 15 | — | — | — | — |
| Identity | 13 | — | — | — | — |
| Accounts | 7 | — | — | — | — |
| **Loyalty** | **0** | — | — | — | — |
| **Notification** | **0** | — | — | — | — |
| Contracts (events, gateway table) | 8 | | | | |
| admin_web / pos_web / kds_web / client_web | 2 / 0 / 0 / 0 vitest | | | | `e2e/`: 3 Playwright specs |
| pos_app / client_app / kds_app | 17 / 2 / 6 widget | | | | |

Ten E2E scenarios exist (counter sale, table order, shift lifecycle, cash
movements, room session, reservation, inventory flow, payroll and profit,
full day, assistant). They run the chillax stack with every module on;
nothing runs a café on a smaller plan end to end.

## The gaps, by weight

1. **Control plane, the rest of its front door.** The functional suite
   covers create/provision/convert/subscription/stop/start/upgrade/destroy.
   Missing: backups (create, list, restore into a new slug, delete, platform
   backups), the jobs queue (list, cancel, position), fleet upgrade with a
   canary, rollback after a failed upgrade, secure/rotate, the record edits
   and demo extension, the sweeps (demo expiry, subscription past-due →
   suspend, resume by payment), impersonation ticket and redeem, mail
   outbox, the platform endpoints (capacity, updates, health), and every
   refusal the API writes. Then an **acceptance** skeleton against the local
   platform for the one thing the dry run cannot prove: containers.
2. **Two services with no tests at all**: Loyalty (points, tiers, clawback
   on refund/void, redemption on order) and Notification (the hub groups,
   what each event becomes on the wire). Unit and functional both.
3. **Front doors for the rest of the services.** A shared
   `tests/Ninja.Testing` helper (factory + Postgres + test auth + the event
   bus doubled or a RabbitMQ container) so each `X.FunctionalTests` is
   scenarios only. Order by risk: Branch (the switches and entitlements
   clamp, the module-off page, the features event), Spaces (the module
   checks on places, holds, stays), Sales (settle, refund, shifts), then
   Inventory, Finance, Payroll, Accounts, Identity.
4. **Contracts.** Every integration event a service publishes has a
   consumer copy with the same shape (today: pairing only); the features
   event; the gateway route table (exists).
5. **A smaller plan end to end.** One E2E scenario where the stack runs a
   Starter café: the gateway answers 402 for inventory, the admin app hides
   it, Spaces refuses a tariff.
6. **UI.** vitest for the pure logic each web app carries (money, the visit
   tab rule, `isTimed` with the clock off, feature gates); component tests
   for `FeatureGate` / `RequireFeature`; Playwright flows for the plan
   gating in admin and the control app's plan tab; Flutter widget tests for
   the gated screens (cart points, reserve, the KDS lock).

## Order of work

| Phase | Scope | Size |
|---|---|---|
| 1 | Control plane functional suite to every endpoint group; acceptance skeleton | ~30 scenarios |
| 2 | `Ninja.Testing` helper; Loyalty and Notification (unit + functional); Branch and Spaces functional | ~60 tests |
| 3 | Sales, Inventory, Finance, Payroll, Accounts, Identity functional; event contracts | ~80 tests |
| 4 | Starter-café E2E scenario; UI: vitest + Playwright + Flutter widget tests | ~40 tests |

Each phase lands as its own commits and its own CI job where docker is
needed, the way `control-integration` and `control-functional` do.
