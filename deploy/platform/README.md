# The Ninja platform on one box

What every tenant shares, and the control plane that stamps tenants. A
tenant is its own compose project (`ninja-{slug}`) under
`/opt/ninja/tenants/{slug}`, joined to the `aspire` network declared here;
the control plane writes it, brings it up and takes it down.

## Layout on the host

```
/opt/ninja/
  platform/            this folder: docker-compose.yml, Caddyfile, .env, realms/, web/
  platform/web/        the five SPA builds (admin, client, pos, kds, control), shared by every tenant
  platform/realms/     ninja-realm.json (the platform realm, imported on first boot)
  tenants/{slug}/      docker-compose.yaml, .env — written by the control plane
  tenants/{slug}/seed/     brand images uploaded before the stamp ({slot}.png)
  tenants/{slug}/backups/  one folder per backup: eleven *.dump, uploads.tar.gz, manifest.json
```

## Deploying

`.github/workflows/deploy-platform.yml` does all of it: builds the five web
apps against `https://auth.{domain}`, renders the platform realm, writes
`.env` from the secrets, ships this folder to `/opt/ninja/platform` on the
platform box, installs docker on a fresh box, brings the `ninja` project up,
and smokes `auth.`, `control.` and the control plane's `tls/ask` through the
edge. Inputs: the image tag (control plane and new tenants), whether to
rebuild the web apps. It needs the `platform` environment with secrets
`PLATFORM_SERVER_HOST/USER/SSH_KEY`, `PLATFORM_POSTGRES_PASSWORD`,
`PLATFORM_EVENTBUS_PASSWORD`, `PLATFORM_KEYCLOAK_PASSWORD`,
`PLATFORM_ADMIN_PASSWORD`, `GHCR_TOKEN` (+ optional `GEMINI_API_KEY`,
`FIREBASE_WEB_*`) and the repository variables `PLATFORM_DOMAIN`,
`PLATFORM_SLUG_LABEL`, `ACME_EMAIL`. The control image itself comes from
`docker-build.yml` (`services: control`).

The platform needs its own box while the Chillax stack still owns ports
80/443 on the current one; once Chillax moves onto a stamp they share.

Optional `Platform__*` keys on the `control-api` service, with their
defaults: `PostgresContainer` (`ninja-postgres-1`, for `pg_dump` and
`pg_restore` through `docker exec`), `StackFootprintMb` (2048) and
`ReserveMb` (1024) for the capacity guard, `CapacityRefreshSeconds` (30),
`TimeZone` (`Africa/Cairo`, the platform's own clock), `BackupHour` (3) and
`BackupsKeep` (7) for the nightly backups. Size the footprint to what a stack
really takes on the box: the Capacity tab shows per-stack memory.

## First time, by hand

1. DNS: `A` records for `{domain}`, `auth.{domain}`, `control.{domain}`, and
   wildcards `*.{domain}` and `*.*.{domain}` to this box. Certificates are
   issued on demand, one per host, after the control plane confirms the host
   belongs to a tenant.
2. `cp .env.example .env` and fill it in.
3. `mkdir -p /opt/ninja/tenants web` and put the SPA builds under `web/`
   (the deploy workflow does this).
4. Put the platform realm at `realms/ninja-realm.json`: render
   `src/Control.API/Templates/platform-realm.json` with `{{controlUrl}}`,
   `{{platformDomain}}` and a `{{platformPassword}}` for the first
   `platform` user (temporary; changed on first sign-in).
5. `docker compose up -d` (the project is named `ninja` in the file).
6. Sign in at `https://control.{domain}` as `platform` and create the first tenant.

The Caddyfile carries two hooks the control plane relies on: the auth host
forwards `/api/control/impersonate/*` to `control-api` (the sign-in-as-owner
link lands there so Keycloak's cookies are set on its own host), and every
customer site sends `Content-Security-Policy: frame-ancestors 'self'
https://control.{domain}` so only the control app can frame the live preview.

## What a stamp does

`databases` (eleven `{slug}_*db` on the shared Postgres) → `broker` (vhost
`{slug}` with the dead-letter policy) → `realm` (from
`Templates/tenant-realm.json`: the eight clients, the `ninja-control` service
account, the phone rule for the tenant's country) → `stack` (compose up,
images pulled; `Seed__Profile` and `Tenant__*` in every service's env) →
`health` (every service answers through the gateway) → `brand` (name,
colour, locale and the seed images through the stack's own API) → `owner`
(the first Owner in the realm, temporary password shown once in the control
app). A restore adds `restore-databases` after `databases` and
`restore-uploads` after `health`.

Demos carry an expiry: stopped when it passes, destroyed a week later.
Destroy is the reverse: compose down with volumes, realm, vhost, databases.
Backups are kept on disk under `tenants/{slug}/backups/`, nightly for every
running tenant and on demand; a restore stamps a new slug from one.

## Not yet

- The Chillax stack still deploys on its own (`.github/workflows/deploy.yml`);
  moving it here is the last step of Phase 3 in `docs/ninja-plan.md`.
- Per-tenant Postgres roles and RabbitMQ users; the stacks still connect as
  the shared superuser and `guest`.
- SMTP for the realms; the Keycloak admin console is reachable from anywhere.
- Social sign-in per tenant (a café's own Google and Apple apps).
