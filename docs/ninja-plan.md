# Ninja — from one café to a platform

**Goal:** sell what Chillax runs on. A café or restaurant subscribes, gets a branded self-ordering menu (web, and native apps on the higher plan) and runs the rest — till, kitchen, stock, money, staff — under the Ninja name. Setting a new client up for a demo is one command plus a photo of their menu.

**Status:** decided 2026-09-19 (four decisions below, all agreed). The next batches of work are in `docs/control-plane-plan.md`. Phase 1 `09949837`, Phase 2 `2fc5ae38`, Phase 2.5 `abc9119c`; the control plane (Phases 3 + 6 together) built 2026-09-19, awaiting its first run on the box.

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
- **Who wears the brand** (owner's rule, settled 2026-09-19, revised 2026-09-21): the café leads on every surface. What the customer sees wears the café's everything — the customer web app and client_app (name, logo, colour, manifest, icons) and everything printed (receipts, tab slips, shift reports, QR cards). The staff surfaces (admin, pos, kds, web and Flutter) carry the café's name, mark and icons too — the sidebar tile is the café with the branch under it, the sign-in page is the café with "Admin/POS/Kitchen" under it, the manifest is "{café} · Admin/Till/Kitchen" on the café's icon — but keep the neutral theme: the café's colours are for customers, not for an ops screen. Ninja appears only as the vendor line ("Powered by ninja", the traced wordmark) at the foot of the sidebar and the sign-in page. The first version put Ninja's name and N tile at the top of the staff apps with the café underneath; it read as if Ninja were the account and the café a sub-item.
- Web apps (admin, client, pos, kds), the same three files in each: `lib/brand.ts` (query + localStorage cache, `bootBrand` before first paint, `useBrand`/`useBrandName`/`useFeatures`/`useCustomerOrigin`, head links and manifest by language), `lib/brand-theme.ts` (one hex → OKLCH → `--primary`, `--primary-foreground`, `--ring` for `:root` and `.dark`, injected as a `<style>` after the theme file), `components/brand-mark.tsx` (logo, or a primary tile with the initial; customer app) / `components/platform-mark.tsx` (staff apps). `index.html` points icon, apple-touch-icon and manifest at the API; the static icons, cup, wordmark and manifests are deleted.
- Admin: Administration → Brand (owner) edits the tenant; sidebar, command menu, dashboard and the customer panel follow the switches (`feature` on nav items/groups); the printed QR cards carry the café's logo and its customer host. Client: header, top bar, About, receipt, install prompts use the brand; rooms tab, loyalty and tab entries follow the switches. POS: the three printed sheets carry the café's; holds strip, Room filter, points, tab, Account tender and pay-out kinds follow the switches. KDS: nothing to gate.
- Flutter: `lib/core/brand/` in each app (a `TenantBrand` model, `initializeBrand()` from SharedPreferences before `runApp`, a Riverpod notifier that fetches `GET /api/tenant` and refreshes on resume). client_app wears the brand (title, sign-in, About, Forui primary color, receipt mirror) and gates spaces/loyalty/tabs; pos_app prints the café's name and logo (downloaded and cached under the documents dir, `path_provider`) and gates the same things as pos_web; pos_app and kds_app show the café's mark (`BrandMark`: its logo, else its initial on a tile) and name, with "Powered by ninja" on sign-in. The loading screen of every staff app (the web apps' index.html before any script, then the session gate; the Flutter apps' router splash) is the platform's: the `ninja` wordmark on the dark tile colour with a ring, since the café is not known until the app has read it — the Flutter apps bundle Original Surfer (OFL) for it. App ids, launcher icons and the native launch images stay for Phase 5. Ninja's own mark is the N of its display face (Original Surfer) on a dark tile, traced as a path for favicons; its wordmark is lowercase `ninja`.
- Switches are enforced on the surfaces only: with one stack per tenant the owner is gating their own screens, and the services need no tenant knowledge.
- Still Chillax's in the build, on purpose: the `chillax` realm (the login theme is now the platform's `ninja` one for every realm, 2026-09-20: the realm's display name is the café's name and its HTML display name is the café's mark, an `<img>` at `api.{slug}.{domain}/api/tenant/icons/icon-192.png` that the control plane stamps; a realm without one gets a tile with its initial), the `*.chillax.site` hosts and the marketing site under `deploy/website`, `com.chillax.*` ids and the native folders (Phase 5).

### Phase 2.5 — The customer app's theme *(built 2026-09-19)*
- `Tenant` gains a **wordmark** (the wide or tall logo, trimmed, capped at 1600 px, stored with its size so a box is reserved before it loads; `PUT|DELETE|GET /api/tenant/wordmark`) and a **theme** of five optional tokens: `accent`, `background`, `foreground` (#rrggbb), `radius` (none|sm|md|lg|xl), `font` (an allowlist of ten Google families; Arabic always falls back to Cairo). Validated server-side; empty means the platform default.
- `brand-theme.ts` (one copy per app) turns the tokens into CSS variables: primary → `--primary/--primary-foreground/--ring`; accent → `--secondary` and a tint for `--accent`; background/foreground → the page, cards and popovers in the light scheme only (dark stays neutral); radius → `--radius`; font → `--font-sans` plus a Google Fonts `<link>` loaded on demand. The admin's Brand page is now *Brand & theme*: two image slots, four colors, corners, font, and a live preview of the customer home painted with the same token math (`brandTokens()`).
- client_web shows the wordmark in the header, top bar, About and receipt (`BrandWordmark`), the mark and name when there is none. client_app mirrors all of it: `TenantBrand` carries wordmark + theme, `brandedColors()` maps the tokens onto Forui (secondary, background, foreground, `FLerpBorderRadius`), the font goes through `google_fonts` for Latin text, `BrandWordmark` at sign-in, register, splash, About and the receipt mirror. Staff apps ignore the theme.
- Not done: a Ninja logo asset (the N tile stands in), the splash background for a dark-ink wordmark.

### Phase 3 + 6 — The control plane *(built 2026-09-19, not yet rolled out)*
Provisioning and the control plane were built together, because "manage instances and demos" is what provisioning is for. `src/Control.API` (the platform's own service, its own `controldb`, auth against the platform realm `ninja`, role `PlatformAdmin`) and `src/control_web` (its SPA on `control.{domain}`).

**D5 — One box, one shared compose project (`ninja`), one compose project per tenant (`ninja-{slug}`).** `deploy/platform/docker-compose.yml` (project `ninja`, so the shared containers are `ninja-postgres-1`, `ninja-keycloak-1`, `ninja-caddy-1`) runs Postgres (Keycloak's store too, no more dev-mode H2), RabbitMQ, Keycloak, Caddy and `control-api`, on the `aspire` network. A tenant is `ninja-{slug}` under `/opt/ninja/tenants/{slug}`: the twelve services and a YARP gateway, every compose service named `{slug}-…` so nothing collides on the shared network, joined to that network. The control plane stamps it with the host's docker (socket mounted).

**D6 — Hosts.** `{slug}.{domain}` is the café's customer app; `admin|pos|kds.{slug}.{domain}` the staff apps; `api.{slug}.{domain}` the native apps' API; `auth.{domain}` Keycloak for every realm; `control.{domain}` the control app. Caddy routes by host label to `{slug}-gateway:5000` and serves the five SPA builds once for everyone; certificates are on demand, one per host, after `GET /api/control/tls/ask` confirms the host belongs to a tenant. A café's own domain (`menu.cafe.com`) becomes a site in `custom-domains.caddy`, which the control plane rewrites and reloads. Wildcard DNS (`*.{domain}` and `*.*.{domain}`) is the only outside step.

**D7 — Sign-in per tenant without a build.** The stack's Branch.API is told `Tenant__AuthUrl` (`https://auth.{domain}/realms/{slug}`) and returns it in the brand as `auth.authority`; the web apps build their OIDC config lazily after `bootBrand()`, so a first visit already signs in against the tenant's realm. The realm comes from `Templates/tenant-realm.json` (the eight clients with the tenant's hosts, no social providers, an Owner service account `ninja-control` the control plane uses to seed the brand).

**A stamp:** `databases` → `broker` (vhost + dead-letter policy) → `realm` → `stack` (compose up) → `edge` (custom domains) → `health` (every service through the gateway) → `brand` (name, color, logo through the stack's own API) → `owner` (first Owner, temporary password shown once). Every step is idempotent and recorded (`ProvisioningStep`), so a failed run is retried from the top. Demos carry an expiry: stopped when it passes, destroyed after the grace days (`DemoExpiryService`). Stop, start, upgrade (re-stamp on a tag + pull) and destroy (down -v, realm, vhost, databases) are the other jobs; one worker runs them in order.

**Dev:** the AppHost runs `control-api` in dry-run mode (every step recorded, nothing stamped) against the `ninja` realm imported from `KeycloakConfiguration/realms/`, and `control-web` on 5177. Tests: `tests/Control.UnitTests` (naming, templates, the stamped gateway's routes checked against the AppHost's route table, custom-domain sites).

**Deploy:** `deploy-platform.yml` (web builds, rendered `ninja` realm, `.env` from secrets, ship, `docker compose up`, smoke through the edge) and `docker-build.yml` for the `ninja-control` image. **Not yet:** a real run on a box (the platform needs its own until chillax.site moves, since the Chillax stack owns 80/443), moving chillax.site onto a stamp, per-tenant backups of the uploads volumes, a tenant's own Google/Apple sign-in, the platform's own login theme, and a real run on the box — the whole flow has only been exercised in dry run.

### Phase 4 — First-run wizard
In admin, on an empty tenant: logo and color → menu photos into the existing review sheet → tables and printable QR → first staff member → "open the menu". The ten-minute demo.

### Phase 5 — White-label mobile
Flutter flavors generated from `tenants/<slug>.json` (ids, name, icon, splash, colors, host, realm, App Links domain), a CI matrix over subscribed tenants, and the store playbook (D4).

*Started 2026-09-20:* `tenants/<slug>.json` exists and is what a build is told (`--dart-define-from-file`): API host, auth host, realm, Google server client id. `AppConfig` in the three apps carries no tenant: a release build without a record fails at first use, debug reaches the AppHost and is told the realm (`--dart-define=REALM=chillax`). `mobile-deploy.yml` takes a `tenant` input (default `chillax`) and passes the record to its seven builds. Still tenant one's in the native folders: app ids and redirect schemes (`REDIRECT_SCHEME` is read, defaulting to the manifests'), display names, icons, splash, App Links host, Firebase config, signing.

*To decide:* the staff apps are Ninja's by the owner's rule, so they may not need a flavor per café at all: one "Ninja Till" and one "Ninja Kitchen" in the stores that ask which café on first launch (the slug, or a QR from the admin's staff page), keep `api.{slug}.{domain}` and the realm in SharedPreferences and build their sign-in from that — the mobile twin of the web's `bootBrand`. That leaves the flavor matrix, the per-café Firebase app and the store accounts to client_app alone.

### Phase 6 — Plans and billing *(built 2026-09-20, manual billing)*
Plan, usage and billing on the control plane; the tenant list and provisioning from a form landed with Phase 3. On 2026-09-20 the plans became real: a plan includes modules, the rest are paid add-ons, the stack's gateway and Branch.API enforce what a café is entitled to (402 on a module it has not bought; the owner cannot switch it on), a platform admin records payments by hand and a daily sweep suspends an unpaid café behind a paused page. The same batch gave every stack its own database role and broker user, resource caps, platform and offsite backups with a restore drill, outbound mail, and upgrades that back up first and roll back on their own. Map in `docs/control-plane-plan.md` (Batch 4); a payment provider plugs into `RecordPaymentAsync` when there is one.

## 4. Open before Phase 3
- The platform domain for tenant subdomains (everything reads `PLATFORM_DOMAIN`; nothing is hardcoded).
- Ship the undeployed 2026-09-18 roadmap tiers to Chillax prod *before* the Phase 3 migration, so the migration is not debugging two things.
- The VM's RAM: sets how many demo tenants fit before a second box.
- GitHub: this repo needs a name that is not `Ninja` (taken by the older project), e.g. `NinjaPlatform`. Its workflows still carry the Chillax server secrets and hosts until Phase 3.

## 5. Gotchas to carry forward
- `IntegrationEventLog.EventTypeName` stores the old full name on rows written before the rename; replay matches on the short name, so nothing to migrate.
- Keycloak realm names cannot be renamed in place; tenant one's realm stays `chillax`, and new tenants get `<slug>`.
- The Flutter package names (`pos_app`, `kds_app`, client) and the Android/iOS native folders were never brand-named; only the app ids and display names are, and those are per-tenant flavor data (Phase 5).
