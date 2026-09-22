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
| Control plane | 114 | **37** | 7 | **1 story** | — | control_web: 4 vitest, `e2e/ControlPlane.spec.ts` |
| **Loyalty** | **6** | **6** | — | | | |
| **Notification** | — | **6** | — | | | |
| Catalog | 47 | 13 | — | | in scenarios | — |
| Ordering | 86 | 11 | — | | in scenarios | — |
| Sales | 71 | — | — | | in scenarios | — |
| Spaces | 52 | **6** | — | | Reservation, RoomSession | — |
| Inventory | 56 | — | — | | InventoryFlow | — |
| Finance | 18 | — | — | | PayrollAndProfit | — |
| Payroll | 12 | — | — | | PayrollAndProfit | — |
| Branch | 15 | **10** | — | | — | — |
| Identity | 13 | — | — | | — | — |
| Accounts | 7 | — | — | | — | — |
| Contracts (events, gateway table) | 8 | | | | | |
| admin_web / pos_web / kds_web / client_web | 2 / 0 / 0 / 0 vitest | | | | | `e2e/`: 3 Playwright specs |
| pos_app / client_app / kds_app | 17 / 2 / 6 widget | | | | | |

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

Two habits worth keeping. A suite declares the shape it reads off the wire
(a `…View` record of its own) rather than reusing the service's DTOs: a
change in the service's records then fails a test instead of being followed
silently. And a suite asserts what the wire actually carries — Notification
answers with the enums' numbers, and the tests say so, because that is what
the apps are written against.

## The gaps, by weight

1. **Front doors for the rest of the services**: Sales (settle, refund,
   shifts), then Inventory, Finance, Payroll, Accounts, Identity. Each is a
   `X.FunctionalTests` on `Ninja.Testing`, so each is scenarios and nothing
   else. Spaces has its places covered; its reservations and stays are next
   in the same suite.
2. **Contracts.** Every integration event a service publishes has a
   consumer copy with the same shape (today: pairing only); the features
   event; the gateway route table (exists).
3. **A smaller plan end to end.** One E2E scenario where the stack runs a
   Starter café: the gateway answers 402 for inventory, the admin app hides
   it, Spaces refuses a tariff.
4. **UI.** vitest for the pure logic each web app carries (money, the visit
   tab rule, `isTimed` with the clock off, feature gates); component tests
   for `FeatureGate` / `RequireFeature`; Playwright flows for the plan
   gating in admin and the control app's plan tab; Flutter widget tests for
   the gated screens (cart points, reserve, the KDS lock).
5. **The control plane's remaining corners**: the brand proxy and its image
   slots, the seed images, metrics, containers, and the demo-expiry sweep.

## Order of work

| Phase | Scope | State |
|---|---|---|
| 1 | Control plane: functional suite over every endpoint group; acceptance skeleton | **done** — 37 scenarios + the acceptance story |
| 2 | `Ninja.Testing`; Loyalty and Notification; Branch and Spaces functional | **done** |
| 3 | Sales, Inventory, Finance, Payroll, Accounts, Identity functional; event contracts | |
| 4 | Starter-café E2E scenario; UI: vitest + Playwright + Flutter widget tests | |

Each phase lands as its own commits and its own CI job where docker is
needed: `control-integration`, `control-functional` and
`service-functional` (a matrix, one entry per service) in
`.github/workflows/pr-validation.yml`.
