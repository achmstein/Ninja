# Control plane — the next batches

**Status 2026-09-19:** the control plane provisions real tenants. Verified on
a laptop (`deploy/platform/local`, https, Caddy's local CA): tenant `cove`
stamped end to end, destroyed, and re-provisioned. Production has not run
yet (needs a domain, DNS and a box; see the bottom). This file is the plan of
record for what comes next, in order. `docs/ninja-plan.md` holds the
decisions (D1–D7) and the phase history.

## Where things are

| Piece | Path | State |
|---|---|---|
| Control API | `src/Control.API` | Tenants, steps, provision/stop/start/upgrade/destroy/extend, `tls/ask`; dry run in the AppHost |
| Control app | `src/control_web` | Tenant list, new tenant (slug, color, logo, demo days), tenant page (hosts, owner password, steps, actions) |
| Templates | `src/Control.API/Templates/*.json`, `Platform/Templates.cs` | Tenant realm, platform realm, compose built in code, custom-domain Caddy sites |
| Shared box | `deploy/platform/` | Compose project `ninja` (Postgres, RabbitMQ, Keycloak, Caddy, control), Caddyfile with on-demand TLS |
| Laptop | `deploy/platform/local/` | Same shape on `*.localhost`; `build-images.ps1`, README with the CA step |
| Deploy | `.github/workflows/deploy-platform.yml`, `docker-build.yml` (`control` job) | Written, never run |
| Tests | `tests/Control.UnitTests` (24) | Naming, templates, stamped gateway routes vs the AppHost table, custom domains, image shape |

Local run: `https://control.localhost` (`platform` / `Local123$`); Cove at
`https://cove.localhost`, `https://admin.cove.localhost` (`owner@cove.test`,
temporary password shown on the tenant page). The local `control-web`
Keycloak client has direct grants enabled for curl tests; production's does
not. The `certutil -user -addstore -f Root caddy-root.crt` step is done on
this machine.

## Batch 0 — Neutral seeds *(first: a fresh tenant must not be Chillax)*

What a fresh stack plants today, and what it should plant:

| Service | Today | Should be |
|---|---|---|
| Branch (`BranchContext.cs` seed) | Branches "El-Manshia" and "El-Benzina"; business day 17:00–05:00 | One branch, "Main" / "الرئيسي", business day 08:00–02:00 (model defaults too) |
| Catalog (`CatalogContextSeed.cs`, 1,241 lines) | Chillax's eight categories, its menu and customizations | `Catalog:Seed` = `none` (default, an empty menu the wizard fills) / `sample` (a small generic bilingual café menu so a demo looks alive) / `chillax` (the current data, used by the dev AppHost and tenant one) |
| Spaces (`SpacesContextSeed.cs`) | Chillax's PlayStation rooms and tables per branch | Nothing; the wizard creates places (for `sample`, a few tables and one room) |
| Finance (`FinanceContextSeed.cs`) | Generic expense categories (rent, electricity…) | Keep, they are generic |
| Loyalty, Ordering, Notification | Tiny or none | Check for Chillax numbers (tiers, EGP thresholds) |
| Keycloak realm template | Service accounts only | Keep |

The control plane passes `Catalog__Seed=sample` for demos and `none` for
customers (`Templates.Compose`, branch and catalog env); the AppHost passes
`chillax`. Verify by destroying and re-provisioning `cove` locally and
reading `/api/branches` and `/api/catalog/categories` through
`https://cove.localhost`.

## Batch 1 — Brand from the control panel

The owner's asks, all for the tenant page in `control_web`:

1. **Show the logos.** Read the tenant's brand through the control plane:
   `GET /api/control/tenants/{slug}/brand` proxies the stack's
   `GET /api/tenant` (anonymous). Mark, wordmark, colors, name in the list
   and on the page.
2. **Edit the brand from control.** `PUT .../brand`, `PUT|DELETE
   .../brand/logo|wordmark` proxied to the stack with the `ninja-control`
   service-account token (the provisioner already gets one in
   `HttpTenantStack.SeedBrandAsync`; factor the token fetch out). Same form
   as admin's Brand & theme page, moved into a shared shape.
3. **Light and dark logos.** Branch.API `Tenant` gains `LogoDark` and
   `WordmarkDark` (optional; fall back to the light ones). Endpoints
   `.../logo?scheme=dark`, `.../wordmark?scheme=dark`; brand response
   `logoDarkUrl`, `wordmarkDark`. `BrandMark`/`BrandWordmark` in client_web
   and client_app pick by the active scheme. PWA icons stay cut from the
   light mark (white tile).
4. **Colors from the logo.** In the color field: swatches extracted from the
   uploaded image (quantize the pixels in the browser, top 6), and an
   eyedropper over the logo preview using the browser's `EyeDropper` API
   where it exists (Chrome, Edge). Both feed the live token preview.
5. **Live preview of the real customer app.** A phone-sized `iframe` of the
   tenant's customer URL on the tenant page, light/dark toggle, reloaded
   after every brand save. Keycloak refuses to render inside a frame, so the
   preview browses as a guest. Caddy must not send `X-Frame-Options` for the
   customer app (it does not today); add `Content-Security-Policy:
   frame-ancestors 'self' https://control.{domain}` on the customer site
   block so only the control app may frame it.

## Batch 2 — Country, currency, time zone, language

`Tenant` (Control) and the stack's `Tenant` (Branch) gain `Country` (ISO
3166-1), `Currency` (ISO 4217), `TimeZone` (IANA), `DefaultLanguage`. Set in
the new-tenant form, passed as `Tenant__*` env, returned in the brand.
Consumers to change: the web apps' price formatting (`formatEgp`,
`currency` i18n keys in admin/client/pos/kds) and client_app's; the services'
`LocalClock` (Cairo today) from `Tenant__TimeZone`; the realm template's
phone pattern (`^01[0-9]{9}$` is Egyptian) per country; receipts. Keep EGP,
Africa/Cairo, EG, ar as the defaults so Chillax is unchanged.

## Batch 3 — First production run

Missing values only the owner has: repository variables `PLATFORM_DOMAIN`,
`ACME_EMAIL`; environment `platform` secrets `PLATFORM_SERVER_HOST`,
`PLATFORM_SERVER_USER`, `PLATFORM_SERVER_SSH_KEY` (the passwords and
`PLATFORM_SLUG_LABEL=2` are set; `platform` user's temporary password is in
the owner's notes). DNS: apex, `auth.`, `control.`, `*.` and `*.*.` to the
box. A separate box while Chillax owns 80/443 on the current one. Run
`docker-build.yml` with `services: control`, then `Deploy Platform`. Expect
a day of fixes; the laptop run found five.

## Batch 4 — The advanced panel (after a customer is live)

- Tenant record: contact, phone, address, plan, notes, demo → customer conversion.
- Per-tenant metrics on the tenant page through the stack's own APIs
  (orders/stats, sales range report) with the control token; no direct
  database reads.
- Sign in as the owner (Keycloak impersonation from the master admin).
- Health and logs: `docker compose ps` and the last lines of each service's
  log, on the tenant page.
- Capacity guard: refuse a stamp when the box's free memory is below the
  stack's footprint (about 2 GB); show the count the box can hold.
- Fleet upgrades: a canary tenant, then all; the E2E suite against the canary.
- Audit log of every platform action, with who did it.
- Backups: per-tenant dump and the uploads volume, on demand and nightly;
  restore into a new slug.
- Isolation: per-tenant Postgres roles and RabbitMQ users instead of the
  shared superuser and `guest` (do this before two paying cafés share a box).
- SMTP for the realms (password reset, staff invites); Keycloak admin
  console restricted by IP at Caddy.

## Gotchas learned on the laptop run

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
