# Ninja — from one café to a platform

**Goal:** sell what Chillax runs on. A café or restaurant subscribes, gets a branded self-ordering menu (web, and native apps on the higher plan) and runs the rest — till, kitchen, stock, money, staff — under the Ninja name. Setting a new client up for a demo is one command plus a photo of their menu.

**Status:** decided 2026-09-19 (four decisions below, all agreed). Phase 1 done (`09949837`); Phase 2 built 2026-09-19.

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

**D3 — Brand lives in data, not in builds.** A `Tenant` record (owned by Branch.API, which already owns settings) holds: name in both languages, logo, primary color, the customer app's URL, and the feature switches. Hosts belong to provisioning, not the record: a stack serves one tenant, so the apps just read `GET /api/tenant` at boot: title, manifest, PWA icons (generated server-side from the uploaded logo), theme variables light and dark, receipt header, push sender name. Wildcard DNS plus a wildcard certificate: a new tenant needs no Caddy edit.

**D4 — White-label mobile from the same record.** A `tenants/<slug>.json` drives Flutter flavors: application id, display name, icon, splash, colors, API host, realm, deep-link domain. Subscribed tenants are a CI matrix. Apple guideline 4.2.6 rejects template apps unless the café publishes under its own developer account, so the playbook is: the client enrolls, Ninja is admin on their account, CI signs with their certificates.

## 3. Phases

Each phase is one reviewable batch on `main`, verified by `dotnet build`, `flutter analyze` and the web type checks before it lands.

### Phase 1 — Rename *(done, `09949837`)*
Code identity becomes Ninja: `Chillax.*` namespaces and projects, `Chillax*` classes, the `Chillax:TestMode` configuration key, solution files, npm package names, container image names, CI image prefix, OpenAPI titles. Mechanical, one commit, build-verified.

Deliberately **not** renamed here, because they are tenant one's data and move in later phases:
- `*.chillax.site` hosts, the `chillax` realm and login theme, `com.chillax.*` app ids, `ChillaxLiveActivity` and the native Android/iOS folders (Phase 3 and 5);
- the display strings "Chillax" / "تشيلاكس" in i18n, manifests, `app_config.dart`, the realm's client display names and the marketing site under `deploy/website` (Phase 2);
- database names, the compose network, `/opt/chillax`, cron markers and APK file names (Phase 3 rewrites deploy);
- historical plan documents under `docs/` beyond path references.

### Phase 2 — Tenant record and runtime branding *(built 2026-09-19)*
- `Tenant` in Branch.API: one row per stack (`Id = 1`), name in both languages, `PrimaryColor` (#rrggbb), `CustomerUrl` (where the printed QR codes point), `LogoVersion`, and the switches `Rooms`, `Loyalty`, `Tabs`, `Inventory`, `Finance`, `Payroll`, `Kds`. Seeded from `Tenant__Name__En/Ar`, `Tenant__PrimaryColor`, `Tenant__CustomerUrl` (dev and the Chillax stamp pass Chillax's; a new stamp passes its own); "Ninja" when nothing is passed.
- Endpoints (`api/tenant`, gateway route without api-version so `<link>` and `<img>` can hit them): `GET /` (anonymous), `PUT /` (Owner), `PUT|DELETE /logo` (Owner), `GET /logo`, `GET /icons/{name}`, `GET /manifest?app=client|admin|pos|kds&lang=`. Logo and icons carry `?v=` and are served immutable.
- `TenantBrandStore` (SkiaSharp): one upload → transparent margins trimmed, capped at 1024 px, saved as PNG, and `icon-192`, `icon-512`, `maskable-512` (68 % fill), `apple-touch-icon`, `favicon` cut from it on a white tile (76 % fill). No logo → a tile in the brand color, drawn on demand. Files live under `uploads/` (a named volume `branch-uploads` in the compose publish). Tests in `tests/Branch.UnitTests`.
- **Who wears the brand** (owner's rule, settled 2026-09-19): only what the customer sees wears the café's — the customer web app and client_app (name, logo, color, manifest, icons) and everything printed (receipts, tab slips, shift reports, QR cards). The staff surfaces (admin, pos, kds, web and Flutter) are Ninja's: name "Ninja", a neutral N tile, the neutral theme, `?platform=1` icons and a "Ninja Admin/Till/Kitchen" manifest. They still read the tenant for its switches, its customer URL and what they print.
- Web apps (admin, client, pos, kds), the same three files in each: `lib/brand.ts` (query + localStorage cache, `bootBrand` before first paint, `useBrand`/`useBrandName`/`useFeatures`/`useCustomerOrigin`, head links and manifest by language), `lib/brand-theme.ts` (one hex → OKLCH → `--primary`, `--primary-foreground`, `--ring` for `:root` and `.dark`, injected as a `<style>` after the theme file), `components/brand-mark.tsx` (logo, or a primary tile with the initial; customer app) / `components/platform-mark.tsx` (staff apps). `index.html` points icon, apple-touch-icon and manifest at the API; the static icons, cup, wordmark and manifests are deleted.
- Admin: Administration → Brand (owner) edits the tenant; sidebar, command menu, dashboard and the customer panel follow the switches (`feature` on nav items/groups); the printed QR cards carry the café's logo and its customer host. Client: header, top bar, About, receipt, install prompts use the brand; rooms tab, loyalty and tab entries follow the switches. POS: the three printed sheets carry the café's; holds strip, Room filter, points, tab, Account tender and pay-out kinds follow the switches. KDS: nothing to gate.
- Flutter: `lib/core/brand/` in each app (a `TenantBrand` model, `initializeBrand()` from SharedPreferences before `runApp`, a Riverpod notifier that fetches `GET /api/tenant` and refreshes on resume). client_app wears the brand (title, sign-in, About, Forui primary color, receipt mirror) and gates rooms/loyalty/tabs; pos_app prints the café's name and logo (downloaded and cached under the documents dir, `path_provider`) and gates the same things as pos_web; kds_app is Ninja. App ids, launcher icons and splash stay for Phase 5; there is no Ninja logo asset yet, the N tile stands in.
- Switches are enforced on the surfaces only: with one stack per tenant the owner is gating their own screens, and the services need no tenant knowledge.
- Still Chillax's in the build, on purpose: the `chillax` realm and its login theme ("Sign in to Chillax" — Phase 3 templates the realm and passes the display name), the `*.chillax.site` hosts and the marketing site under `deploy/website`, `com.chillax.*` ids and the native folders (Phase 5).

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
