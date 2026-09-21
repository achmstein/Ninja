# Control plane — what landed, what is next

**Status 2026-09-20:** the production-readiness batch (Batch 4 below) is
built and verified on the laptop platform: `mcdonald-s` secured onto its
own credentials and capped, platform and tenant backups in the MinIO
bucket, welcome and payment mails in Mailpit, `cove` converted to Starter
(402 on inventory, locked switches), paid, suspended behind the paused
page, resumed by a payment and destroyed with an archived backup,
`mcdonald-s` upgraded to `v2` and an upgrade to a missing tag rolled back
by itself. Not yet committed as one slice.

**Status 2026-09-19:** the advanced panel is built. Blocks 0–9 of the
September plan are on `main`, one commit each (`9b9eff36` seeds …
`17f5488e` control app, then the Flutter money commit), verified on the
laptop platform (`deploy/platform/local`): tenant `cove` upgraded onto the
new images, `nile` restored from cove's backup and destroyed, demo `oasis`
created in Saudi Arabia with seed images. Production has not run yet; that
is Batch 3 below. `docs/ninja-plan.md` holds the decisions (D1–D7) and the
phase history.

## Where things are

| Piece | Path | State |
|---|---|---|
| Control API | `src/Control.API` | `Apis/ControlApi*.cs`: tenants, brand, record, ops, impersonation, backups, audit, capacity; `Platform/*`: provisioner, templates, stack proxy, capacity, backups, audit; dry-run doubles for the AppHost |
| Control app | `src/control_web` | `/` Tenants · Capacity · Audit · Backups; `/new` with a phone preview; `/t/{slug}` Overview · Brand · Subscription · Health · Metrics · Backups · Audit; EN/AR, RTL; shadcn only |
| Templates | `src/Control.API/Templates/*.json`, `Platform/Templates.cs` | Realms, compose (with `Seed__Profile` and `Tenant__*` env), custom-domain Caddy sites with `frame-ancestors` |
| Shared box | `deploy/platform/` | Compose project `ninja`; Caddyfile: on-demand TLS, CSP on customer sites, `/api/control/impersonate/*` on the auth host |
| Laptop | `deploy/platform/local/` | Same on `*.localhost` over https; `Platform__PostgresContainer: ninja-local-postgres-1` |
| Seeds | `src/Shared/SeedProfile.cs`, `*ContextSeed*.cs` | `Seed:Profile` = `none` / `sample` / `chillax`; the AppHost and E2E pass `chillax` |
| Locale | `src/Shared/TenantClock.cs`, `Platform/Locale.cs` | `Tenant__Country/Currency/TimeZone/DefaultLanguage`; phone rules per country in the realm |
| Tests | `tests/Control.UnitTests` (88), `tests/Branch.UnitTests` (13), `money_test.dart` in client_app and pos_app | Templates, naming, locale, audit, capacity maths, ops parsers, impersonation tickets, backups |

Local run: `https://control.localhost` (`platform` / `Local123$`). From
git-bash or PowerShell, `*.localhost` does not resolve and Caddy's CA is not
trusted: `curl --resolve control.localhost:443:127.0.0.1 -k …`.

## What a tenant is now

- **Record:** kind (Demo / Customer), seed (`none` / `sample`), contact
  name, phone, address, notes, custom customer domain; `PUT
  /tenants/{slug}`; a Demo converts with `POST /tenants/{slug}/convert`
  (plan, add-ons, paid through). A changed custom domain re-writes the
  edge. The plan (Free / Starter / Pro), add-ons, subscription status and
  payments live on the Subscription tab (Batch 4).
- **Locale:** country, currency, time zone, first language. The country
  alone implies the other three (`LocaleFields.Normalize`, table in
  `Platform/Locale.cs`); tenant one's EG / EGP / Africa/Cairo / ar are the
  defaults. Every service gets them as env; the realm checks phone numbers
  the way the country writes them; every app prints `12.50 EGP` /
  `12.50 ج.م` from the brand's currency (no `£`, no `currency` i18n key).
- **Brand:** six image slots on the running stack — `logo`, `logo-dark`,
  `wordmark-en`, `wordmark-en-dark`, `wordmark-ar`, `wordmark-ar-dark`;
  dark falls back to light, Arabic to English, a missing wordmark to the
  mark and the name. Icons are cut from `logo`. Before a stamp the same
  slots live as seed images under `{tenants}/{slug}/seed/`. The control app
  edits name, colours, radius, font, feature switches and locale through
  `PUT /tenants/{slug}/brand`, proxied with the `ninja-control` token.
- **Preview:** a phone mock in the new-tenant form (nothing stamped yet)
  and a live iframe of the customer app on the Brand tab
  (`?preview-theme=dark&lang=ar`, honoured without touching the visitor's
  own storage). Caddy allows framing only from `control.{domain}`.
- **Health:** containers (`compose ps`), the last lines of one service's
  log, the twelve `/health` probes through the gateway.
- **Metrics:** orders, revenue, settled tickets, net sales, month profit,
  loyalty accounts, a daily series and top items, read from the stack's own
  APIs per branch; a failing service becomes a warning, never an error.
- **Sign in as owner:** `POST /tenants/{slug}/impersonate` gives a 60 s
  single-use link on the auth host; the relay replays Keycloak's admin
  impersonation cookies and lands on `admin.{slug}.{domain}`. An owner who
  never signed in lands on Keycloak's set-a-password page: that is a valid
  session, not a failure.
- **Backups:** `{tenants}/{slug}/backups/{yyyyMMdd-HHmmss}/` holds eleven
  `pg_dump -Fc` files, `uploads.tar.gz` and a manifest; nightly at
  `BackupHour` platform time for every running tenant, pruned to
  `BackupsKeep`; on demand, downloadable as one tar.gz, restorable into a
  new slug (`restore-databases` before the services boot, `restore-uploads`
  after health; the restored stack keeps its theme, switches and locale).
  Keycloak users are not in a dump: a restored tenant has a fresh realm.
- **Capacity:** memory, load, disk and per-stack memory from the host
  (`/proc/meminfo` inside the unconstrained control container is the host's;
  `docker stats` joined with `docker ps` by name); `roomFor = floor((free −
  ReserveMb) / StackFootprintMb)`. A stamp is refused with 409 at zero
  unless `force`.
- **Audit:** every platform action (API, provisioner, expiry, backup) with
  who did it, on the dashboard and per tenant.

## Batch 3 — First production run *(next)*

Missing values only the owner has: repository variables `PLATFORM_DOMAIN`,
`ACME_EMAIL`; environment `platform` secrets `PLATFORM_SERVER_HOST`,
`PLATFORM_SERVER_USER`, `PLATFORM_SERVER_SSH_KEY` (the passwords and
`PLATFORM_SLUG_LABEL=2` are set). DNS: apex, `auth.`, `control.`, `*.` and
`*.*.` to the box. A separate box while Chillax owns 80/443 on the current
one. Run `docker-build.yml` with `services: control`, then `Deploy
Platform`. Expect a day of fixes; the laptop run found five. On the box,
size `Platform__StackFootprintMb` / `ReserveMb` to what a stack really
takes there (the Capacity tab shows per-stack memory after the first
tenant).

## Batch 4 — Production readiness and paid modules *(built 2026-09-20)*

Decided with the owner: manual, invoice-based billing for now; any SMTP
account; any S3-compatible bucket. `deploy/platform/README.md` has the
operator's view; this is the map.

- **Isolation** (`Platform/Infra.cs`): a Postgres role and a RabbitMQ
  user `{slug}_app` per tenant, created before the databases, the
  databases handed over (tables first, then free-standing sequences,
  functions, types, schemas; the role must be `INHERIT` for
  `pg_database_owner`), `PUBLIC` revoked, the shared `guest` cleared off
  the vhost last. `controldb`, `keycloak` and `postgres` are closed to
  `PUBLIC` at startup (`PlatformLockdownService`). `secure` / `rotate`
  jobs migrate a stack stamped before this; the `.env` carries only the
  tenant's own secrets and `ProcessShell.ForLog` masks them.
- **Limits** (`Templates.AppendLimits`): memory, cpus and pids under
  `deploy.resources.limits` plus json-file log rotation on every
  container; `StackLimitMb` is their sum and the footprint must fit under
  it (`ValidateOnStart`).
- **Backups** (`Platform/Backups.cs`, `Offsite.cs`): `_platform`
  (controldb, keycloak) before the tenants each night; each backup
  uploaded as `{slug}/{id}.tar.gz` when `Offsite` is configured;
  `_archive/{slug}/{id}` kept on destroy for `ArchiveKeepDays`; a weekly
  `RestoreDrillService` restores the least-recently-verified customer
  into `drill-{slug}` and marks the manifest.
- **Mail** (`Platform/Mail.cs`, `MailTemplates.cs`): MailKit over
  `Platform:Mail`, a channel and a sender with three attempts, every mail
  audited; templates en/ar for the owner (welcome, demo expiry, past due,
  suspended, payment received) and ops (stamp failed, backup failed,
  backups stale). The realms get the same `smtpServer`.
- **Subscription** (`Platform/Plans.cs`, `Subscriptions.cs`,
  `Apis/ControlApi.Subscription.cs`): `Module` × `TenantPlan` in
  `PlanCatalog` (Free = Kds; Starter + Spaces, Loyalty, Tabs; Pro = all),
  `Addons` on the tenant, a demo entitled to everything.
  Entitlements are pushed to the stack's Branch.API (`PUT
  /api/tenant/entitlements`, policy `Control` = `azp == ninja-control`),
  which clamps the owner's switches, and stamped into the gateway, where
  an unentitled module's routes become `402 module-off`. `Payment` rows,
  `RecordPaymentAsync` as the one entry point, a daily sweep
  (`SubscriptionSweep.Decide`) for past due → suspended; `Suspended = 8`
  stops the stack and the edge answers `503 {"code":"paused"}`, which the
  customer app turns into a paused page.
- **Upgrades** (`Provisioner.UpgradeAsync`): backup → stack → health with
  an automatic rollback to `PreviousImageTag`, `POST /rollback` by hand,
  `POST /platform/upgrade` for the fleet with an optional canary;
  `Upgrading = 7` while it runs. Tags on the job, not the record, so a
  queued fleet upgrade that never runs changes nothing.
- **Tests:** `tests/Control.UnitTests` (88) covers the templates, infra
  command shapes, backups, mail, plans and sweeps, and the upgrade/rollback
  paths over an in-memory `ControlContext`; `tests/Branch.UnitTests` (13)
  the clamp; `tests/Ninja.Contracts.Tests` unchanged.

## After a customer is live

- Keycloak admin console restricted by IP at Caddy.
- The E2E suite against the canary before the rest of a fleet upgrade.
- A payment provider's webhook onto `SubscriptionService.RecordPaymentAsync`;
  prices stay out of code until then.
- Client-side encryption of the offsite archives (they leave the box as
  plain `.tar.gz`; a private bucket with server-side encryption until then).
- Social sign-in per tenant (a café's own Google and Apple apps).
- Moving the Chillax stack onto a stamp (last step of Phase 3 in
  `docs/ninja-plan.md`); its seed profile is `chillax`.

## Gotchas learned on the laptop runs

- Keycloak 26 always sets Secure cookies: no sign-in over plain http. Local
  runs are https with Caddy's local CA; browsers reject `*.localhost`
  wildcards, so certificates are exact per host, issued on demand after
  `tls/ask`.
- Keycloak cannot create its own Postgres database: `init-multiple-databases.sh`.
- YARP transforms: `X-Forwarded` and `HeaderPrefix` share one transform index.
- Catalog, Inventory and Finance Dockerfiles must copy `src/Ninja.AI`.
- The docker CLI in the control image comes from `docker:cli` (static), not apt.
- PowerShell: call `npx.cmd`, and set `$ErrorActionPreference = 'Continue'`
  around docker, which writes progress to stderr.
- Caddy caches issued certificates in its data volume; after changing site
  addresses, purge `/data/caddy/certificates/local/*`.
- A destroyed slug can be provisioned again; the secrets are kept on the row.
- Compose prefixes volume names with the project: the uploads volume is
  `ninja-{slug}_{slug}-branch-uploads` (`TenantNaming.UploadsVolumeOnDocker`);
  `docker run -v {slug}-branch-uploads` silently creates an empty stray.
- Hosted services must not start during the build-time OpenAPI boot
  (`builder.Environment.IsBuild()` guards their registration).
- The dev AppHost runs the control plane in dry run: every job records its
  steps and the ops, brand and metrics endpoints answer with canned data.
