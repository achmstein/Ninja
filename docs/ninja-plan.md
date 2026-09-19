# Ninja — from one café to a platform

**Goal:** sell what Chillax runs on. A café or restaurant subscribes, gets a branded self-ordering menu (web, and native apps on the higher plan) and runs the rest — till, kitchen, stock, money, staff — under the Ninja name. Setting a new client up for a demo is one command plus a photo of their menu.

**Status:** decided 2026-09-19 (four decisions below, all agreed). Phase 1 in progress.

**Repo:** this repository (`NinjaPlatform`) is a copy of `achmstein/Chillax` at `c43fee71`, detached from that remote. It is *not* the older `achmstein/Ninja` repository (a food-delivery experiment); the two share nothing and must not be merged. Chillax keeps running from its own repo until Phase 3 moves it onto a Ninja stamp; after that the Chillax repo is history.

---

## 1. What the codebase already gives us

| Need | State on 2026-09-19 |
|---|---|
| Menu from a photo | **Built.** `POST /api/catalog/assist/menu/scan` (Catalog `Assist/MenuScanner.cs`) proposes sections and items with both languages and prices; `admin_web/src/features/menu/components/menu-review-sheet.tsx` reviews and creates them. Onboarding wires this in; it does not build it. |
| Brand | Shallow. "Chillax" / "PlayStation" live in a dozen places per surface: page title, manifest, `app_config.dart`, realm JSON, Caddyfile, i18n `appTitle`. The web theme is already CSS variables in oklch (`client_web/src/styles/theme.css`), so a tenant's primary color is a runtime override, not a build. |
| Feature switches | Started on `Branch` (`IsOrderingEnabled`, `IsReservationsEnabled`, `RequireSignInForTableOrders`). Rooms, loyalty, tabs, inventory, finance, payroll become the same kind of switch at tenant level. |
| Twelve services | Every tenant needs all of them running. This drives D2. |
| Event bus | Routing key is the event's short type name (`RabbitMQEventBus.cs`), and the outbox replays by short name too (`IntegrationEventLogEntry.EventTypeShortName`), so renaming namespaces does not break queues or pending outbox rows. |
| OpenAPI | Schema ids do not carry namespaces (the generated web SDKs contain no `Chillax`), so the rename does not change the generated clients. |

## 2. Decisions

**D1 — One codebase; Chillax is tenant one.** No fork. The code is renamed to Ninja in place (namespaces, projects, images). Chillax the café runs on Ninja like every other tenant, so it stays the proving ground and no fix lands twice.

**D2 — A stack per tenant, shared infrastructure.** Each tenant gets its own copy of the twelve services under one compose project (`ninja-<slug>`). They share one Postgres server (databases `<slug>_catalogdb` …), one Keycloak (a realm per tenant — real isolation and a branded login page), one RabbitMQ (a vhost per tenant), one Redis (a db index per tenant) and one Caddy. No tenant column through twelve services, no event-contract change, no cross-tenant query to get wrong. Cost is roughly 2 GB of RAM per tenant: fine for demos and the first dozen paying cafés. Past that, the next step is one host process per tenant (the services as modules of one ASP.NET host), *not* shared tenancy.

**D3 — Brand lives in data, not in builds.** A `Tenant` record (owned by Branch.API, which already owns settings) holds: name in both languages, logo, primary color, platform subdomain, custom domain, and the feature switches. The six web apps are built once; at boot they read `GET /api/tenant/brand` for the host they were served on: title, manifest, PWA icons (generated server-side from the uploaded logo), theme variables light and dark, receipt header, push sender name. Wildcard DNS plus a wildcard certificate: a new tenant needs no Caddy edit.

**D4 — White-label mobile from the same record.** A `tenants/<slug>.json` drives Flutter flavors: application id, display name, icon, splash, colors, API host, realm, deep-link domain. Subscribed tenants are a CI matrix. Apple guideline 4.2.6 rejects template apps unless the café publishes under its own developer account, so the playbook is: the client enrolls, Ninja is admin on their account, CI signs with their certificates.

## 3. Phases

Each phase is one reviewable batch on `main`, verified by `dotnet build`, `flutter analyze` and the web type checks before it lands.

### Phase 1 — Rename *(in progress)*
Code identity becomes Ninja: `Chillax.*` namespaces and projects, `Chillax*` classes, the `Chillax:TestMode` configuration key, solution files, npm package names, container image names, CI image prefix, OpenAPI titles. Mechanical, one commit, build-verified.

Deliberately **not** renamed here, because they are tenant one's data and move in later phases:
- `*.chillax.site` hosts, the `chillax` realm and login theme, `com.chillax.*` app ids, `ChillaxLiveActivity` and the native Android/iOS folders (Phase 3 and 5);
- the display strings "Chillax" / "تشيلاكس" in i18n, manifests, `app_config.dart`, the realm's client display names and the marketing site under `deploy/website` (Phase 2);
- database names, the compose network, `/opt/chillax`, cron markers and APK file names (Phase 3 rewrites deploy);
- historical plan documents under `docs/` beyond path references.

### Phase 2 — Tenant record and runtime branding
- `Tenant` in Branch.API: names, logo (upload → stored original + generated 192/512/maskable/apple-touch icons using the 76%/68% fill rule from the PWA work), primary color, hosts, switches (`Rooms`, `Loyalty`, `Tabs`, `Inventory`, `Finance`, `Payroll`, `Kds`).
- `GET /api/tenant/brand` (anonymous, cached) and `PUT /api/tenant` (Admin).
- All six web apps: title, `<meta>`, manifest served from the API, favicon/icons, theme variables derived from one color (light + dark, contrast-checked), logo in the header and on receipts, `appTitle` gone from i18n.
- "PlayStation rooms" copy becomes tenant copy or disappears behind the `Rooms` switch; admin sidebar, pos floor and client tabs hide switched-off features.
- Done when: no "Chillax" literal remains outside tenant data, and changing the tenant's color and logo re-skins every surface without a build.

### Phase 3 — Provisioning
- `deploy/` becomes templates: `docker-compose.tenant.yml` (services only, `-p ninja-<slug>`, env file per tenant), shared `docker-compose.infra.yml` (Postgres, Keycloak, RabbitMQ, Redis, Caddy), `realm.template.json` with `{slug}`, `{hosts}`; Caddy with `*.<platform-domain>` (DNS challenge) routing by host label, on-demand TLS for custom domains.
- `scripts/ninja`: `new <slug> --name --logo --color [--domain]` (databases, vhost, realm, env, compose up, migrations, tenant record, first admin, first branch; prints the admin URL and credentials), `upgrade [slug|all]`, `destroy <slug>` (demos), `backup` per tenant (from `backup.sh`).
- Secrets and ports per stack (the item deferred from the 2026-09-18 roadmap).
- Move chillax.site onto a stamp as tenant `chillax` with its custom domains; retire the Chillax repo's deploy.
- Done when: `ninja new demo-cafe …` gives a working admin login in under five minutes on the current VM.

### Phase 4 — First-run wizard
In admin, on an empty tenant: logo and color → menu photos into the existing review sheet → tables and printable QR → first staff member → "open the menu". The ten-minute demo.

### Phase 5 — White-label mobile
Flutter flavors generated from `tenants/<slug>.json` (ids, name, icon, splash, colors, host, realm, App Links domain), a CI matrix over subscribed tenants, and the store playbook (D4).

### Phase 6 — Control plane *(after there are paying tenants)*
Tenant list, plan, usage, billing, provision from a form instead of the CLI.

## 4. Open before Phase 3
- The platform domain for tenant subdomains.
- Ship the undeployed 2026-09-18 roadmap tiers to Chillax prod *before* the Phase 3 migration, so the migration is not debugging two things.
- The VM's RAM: sets how many demo tenants fit before a second box.
- GitHub: this repo needs a name that is not `Ninja` (taken by the older project), e.g. `NinjaPlatform`. Its workflows still carry the Chillax server secrets and hosts until Phase 3.

## 5. Gotchas to carry forward
- `IntegrationEventLog.EventTypeName` stores the old full name on rows written before the rename; replay matches on the short name, so nothing to migrate.
- Keycloak realm names cannot be renamed in place; tenant one's realm stays `chillax`, and new tenants get `<slug>`.
- The Flutter package names (`pos_app`, `kds_app`, client) and the Android/iOS native folders were never brand-named; only the app ids and display names are, and those are per-tenant flavor data (Phase 5).
