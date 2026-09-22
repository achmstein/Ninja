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

| Area | Unit | Functional | Integration | Acceptance | E2E | UI |
|---|---|---|---|---|---|---|
| Control plane | 114 | **37** | 7 | **1 story** | — | control_web: 4 vitest, `e2e/ControlPlane*.spec.ts` (**2**) |
| **Loyalty** | **6** | **6** | — | | | |
| **Notification** | — | **6** | — | | | |
| Catalog | 47 | **7** | — | | in scenarios | — |
| Ordering | 86 | **9** | — | | in scenarios | — |
| Sales | 71 | **17** | — | | in scenarios | — |
| Spaces | 52 | **6** | — | | Reservation, RoomSession, **SmallerPlan** | — |
| Inventory | 56 | **8** | — | | InventoryFlow | — |
| Finance | 18 | **16** | — | | PayrollAndProfit | — |
| Payroll | 12 | **12** | — | | PayrollAndProfit | — |
| Branch | 15 | **10** | — | | **SmallerPlan** | — |
| Identity | 13 | **8** | — | | — | — |
| Accounts | 7 | **7** | — | | — | — |
| Contracts (events, gateway table) | 8 | | | | | |
| admin_web / pos_web / kds_web / client_web | **39 / 17 / 0 / 24** vitest | | | | | `e2e/`: 3 Playwright specs |
| pos_app / client_app / kds_app | **62 / 20 / 29** widget | | | | | |

What the layers cost: the control plane's functional suite is 23 s for 37
scenarios, a service's is ~12 s, the acceptance story is 50 s against a
real platform, the E2E suite is minutes after a ~6 minute boot.

The pieces every new suite builds on:

- `tests/Ninja.Testing` — the shared Postgres and RabbitMQ, a service
  booted in-process on them (one database and one queue per suite), and the
  personas (owner, admin, cashier, customer, nobody) whose claims are
  spelled the way the realms spell them, so the real policies decide.
- `tests/Control.FunctionalTests` — the same idea for the control plane,
  on its dry-run box.
- `tests/Control.AcceptanceTests` — the platform on a real docker host,
  opt-in with `NINJA_ACCEPTANCE=1`.
- `tests/Identity.FunctionalTests/FakeKeycloak.cs` — Keycloak's admin REST
  API in the test process, for the one service whose work is all done
  through it: the scenarios drive Identity's door and then read what was
  written behind it.

Two habits worth keeping. A suite declares the shape it reads off the wire
(a `…View` record of its own) rather than reusing the service's DTOs: a
change in the service's records then fails a test instead of being followed
silently. And a suite asserts what the wire actually carries — Notification
answers with the enums' numbers, and the tests say so, because that is what
the apps are written against.

## The gaps, by weight

1. **The corners of the front doors already covered**: Spaces has its
   places; its reservations and stays are next in the same suite.
   Inventory's suite covers the storeroom (deliveries, waste, counts,
   recipes); its transfers and suppliers are next in it. Identity's covers
   the door onto Keycloak; the account a customer deletes and the email
   they change are next in it.
2. **Contracts.** Covered in `tests/Ninja.Contracts.Tests`, off the source
   tree: every event is published by one service and consumed by someone,
   each consumer's copy reads only what the publisher sends and reads it as
   the same kind of value, nobody declares an event twice, and the gateway's
   route table matches the AppHost's. What is not covered: the JSON a
   running service actually puts on the wire.
3. **A smaller plan end to end.** One E2E scenario where the stack runs a
   Starter café: the gateway answers 402 for inventory, the admin app hides
   it, Spaces refuses a tariff.
4. **UI.** The pure logic each app carries is covered (the floor's clock
   and its money, the visit tab, the customer's bill, the café's day, the
   filter clamp; the KDS lock, the POS floor list, the customer's room
   row). What is not: component tests for `FeatureGate` / `RequireFeature`
   themselves, which need a DOM and a testing library neither web app has
   yet, and a Playwright flow for the plan gating in admin — it would have
   to switch a module off on the café the dev stack runs, and put it back.
   `SmallerPlanScenario` does that at the API level instead.
5. **The control plane's remaining corners**: the brand proxy and its image
   slots, the seed images, metrics, containers, and the demo-expiry sweep.

## Order of work

| Phase | Scope | State |
|---|---|---|
| 1 | Control plane: functional suite over every endpoint group; acceptance skeleton | **done** — 37 scenarios + the acceptance story |
| 2 | `Ninja.Testing`; Loyalty and Notification; Branch and Spaces functional | **done** |
| 3 | Sales, Inventory, Finance, Payroll, Accounts, Identity functional; event contracts | **done** — 68 scenarios and the contract tests |
| 4 | Starter-café E2E scenario; UI: vitest + Playwright + Flutter widget tests | **done** — `SmallerPlanScenario` (59 s, boot included), the control app's plan spec, and the app tests above |

Each phase lands as its own commits and its own CI job where docker is
needed: `control-integration`, `control-functional` and
`service-functional` (a matrix, one entry per service) in
`.github/workflows/pr-validation.yml`.
