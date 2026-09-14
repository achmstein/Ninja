# Chillax tests

| Project | What it checks | Needs |
|---|---|---|
| `*.UnitTests` | One service's domain and application logic, mocked. | nothing |
| `Chillax.Contracts.Tests` | The integration-event contracts as written in `src/`: every subscribed event has a publisher, every published event a consumer (known dead ends listed in `Allowlist.cs`), no service declares an event twice, and each consumer's copy of an event reads only properties the publisher's copy sends. Roslyn over the source, no host. | nothing |
| `Chillax.E2E` | Whole workflows across every service — a cashier's day replayed through the BFF with the calls the React apps make — with each downstream effect asserted five ways: the consuming service's projection, the event on RabbitMQ, the outbox row, the SignalR push, and the service logs (a handler that throws is ACKed and lost by `RabbitMQEventBus`; only the log shows it). | Docker Desktop |
| `*.FunctionalTests` | eShop-era in-process harnesses; stale. | Docker |

## Running

```sh
dotnet test --solution Chillax.Web.slnf                          # what CI runs: unit + contracts (+ the stale functional tests)
dotnet test --project tests/Chillax.Contracts.Tests              # 2 s
dotnet test --project tests/Chillax.E2E                          # ~2-3 min; boots the whole system
dotnet run --project tests/Chillax.E2E -- --filter-class Chillax.E2E.Scenarios.CounterSaleScenario   # one scenario
dotnet run --project tests/Chillax.E2E -- --filter-trait Category=Slow                                 # the 8-minute room-time test
```

## How the E2E suite works

- `Harness/ChillaxApp` boots `src/Chillax.AppHost` in-process through `Aspire.Hosting.Testing` with `Chillax:TestMode=true`: fresh Postgres, RabbitMQ and Keycloak containers with no volumes and random ports (a dev `aspire run` can stay up), all twelve APIs, the YARP BFF; no pgAdmin, no Vite apps. Same images as dev. One boot per test run (~45 s), removed afterwards.
- Personas sign in with Keycloak password grants like `pos_app` does: `cashier` (Cashier, branch 1), `admin` (Admin + Owner), `tester` (Customer).
- `Actors/` speak for the screens: `CashierActor` (pos_web), `OwnerActor` (admin_web and the owner-only till moves), `KitchenActor` (kds_web), `CustomerActor` (client_web). Each method sends the body the SPA sends.
- `Fixtures/DaySetup` creates the run's master data once (pricing, supplier, partner, the cashier on payroll, tracked stock behind two menu items, a loyalty account); `Housekeeping` resets the floor before and after each scenario; `ScenarioBase` opens a shift for it.
- Scenarios assert deltas and references, never absolutes, so they rerun in any order. A failed scenario prints every bus event, hub push and log failure since it started.
- `Manifest/KnownEvents` lists every integration event with its publisher and consumers; `Guards/` keeps it and the hub method list in step with the source; `ChoreographyAudit` closes the full-day scenario.

Boot problems print the tail of every resource log and write the whole lot to `%TEMP%\chillax-e2e-boot.log`.
