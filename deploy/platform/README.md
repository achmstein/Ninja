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
  platform/themes/     ninja/, the login theme every realm uses (its mark and name come from the realm)
  tenants/{slug}/      docker-compose.yaml, .env — written by the control plane
  tenants/{slug}/seed/     brand images uploaded before the stamp ({slot}.png)
  tenants/{slug}/backups/  one folder per backup: eleven *.dump, uploads.tar.gz, manifest.json
  tenants/_platform/backups/  the platform's own: controldb.dump, keycloak.dump, manifest.json
  tenants/_archive/{slug}/    a destroyed tenant's last backup, kept ArchiveKeepDays (90)
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

Every container of a stack is capped, so one café's runaway service ends at
its own limit rather than at the box: `ServiceMemoryMb` (256),
`ServiceMemoryOverridesMb__<service>` (catalog, inventory and finance run
the assistant and get 384), `GatewayMemoryMb` (128), `ServiceCpus` (1.0),
`GatewayCpus` (0.5), `PidsLimit` (256, processes), and `LogMaxSize` (`10m`) ×
`LogMaxFile` (3) of log per container. The caps add up to the stack's cap
(3584 MB by default), shown next to the footprint on the Capacity tab; the
footprint must fit under it or the control plane refuses to start. A change
reaches a running stack on its next upgrade.

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

`credentials` (the role and the broker user `{slug}_app`, passwords on the
record) → `databases` (eleven `{slug}_*db` on the shared Postgres, owned by
the role) → `broker` (vhost `{slug}` for the user, with the dead-letter
policy) → `realm` (from
`Templates/tenant-realm.json`: the eight clients, the `ninja-control` service
account, the phone rule for the tenant's country) → `stack` (compose up,
images pulled; `Seed__Profile` and `Tenant__*` in every service's env) →
`health` (every service answers through the gateway) → `brand` (name,
colour, locale and the seed images through the stack's own API) → `owner`
(the first Owner in the realm, temporary password shown once in the control
app) → `broker-lockdown` (the shared broker user off the vhost). A restore
adds `restore-databases` after `databases` and `restore-uploads` after
`health`.

Demos carry an expiry: stopped when it passes, destroyed a week later.
Destroy is the reverse: compose down with volumes, realm, vhost, databases,
role.

Each stack connects as its own Postgres role and RabbitMQ user (both
`{slug}_app`), which own its eleven databases and its vhost and nothing
else; the platform's own databases are closed to everyone but the
superuser. A stack stamped before this shows "Runs on the shared
credentials" on its page: **Secure now** (or its next upgrade) creates the
role and user, hands the databases over and restarts it. **Rotate
credentials** in the menu gives a secured stack new passwords the same way.
A tenant's `.env` carries only its own secrets.
Backups are kept on disk under `tenants/{slug}/backups/`, nightly for every
running tenant and on demand; a restore stamps a new slug from one. Before
the tenants' nightly run, the platform's own databases (`controldb`,
`keycloak`: every tenant's secrets, realms and users) are dumped under
`tenants/_platform/backups/`; the Backups tab on the platform page lists
them, takes one on demand, and goes red when a night was missed. A destroy
takes a last backup (unless one is fresher than `BackupFreshMinutes`) and
moves the newest one to `tenants/_archive/{slug}/` before the folder goes.

With `OFFSITE_*` set in `.env` (any S3-compatible bucket: Backblaze B2,
Cloudflare R2, Hetzner, AWS), every backup is also uploaded as one
`{slug}/{id}.tar.gz` right after it is taken, and its manifest records when;
the tenant's Backups tab shows the time. The bucket's own lifecycle rule is
the retention there (30 days is plenty); the platform deletes a copy only
when its backup is deleted here. Archives leave the box as plain
`.tar.gz`: keep the bucket private with server-side encryption.
`RESTORE_DRILL_ENABLED=true` adds a weekly proof: the customer whose newest
backup was verified longest ago is restored into a scratch stack
(`drill-{slug}`), waited on until healthy, marked verified on the manifest,
and destroyed. It needs a stack's worth of memory for ten minutes and is
skipped when the box has none.

With `MAIL_*` set (any SMTP account), the platform writes to owners and to
`MAIL_OPS_TO`: the welcome with the admin app's address and the first
password when a stamp finishes, a demo's expiry warnings (three days before
it stops, then that it stopped, then two days before it is deleted), the
subscription notices, and to ops a failed stamp, a failed backup, and any
running tenant without a backup from the last two nights. Every mail is
audited as `mail.sent`, `mail.failed` (three attempts) or, while mail is
off, `mail.skipped`; the platform page shows when one last went out. The
realms get the same SMTP settings when stamped, for their own password
resets; after setting the secrets on a running platform, `POST
/api/control/platform/mail/realms` gives the existing realms theirs. A
tenant's welcome can be sent again from its page.

A customer pays for a plan and add-ons. The plan (Free / Starter / Pro)
includes a set of modules (`Platform/Plans.cs` is the one table: Free has
Kds; Starter adds Rooms, Loyalty and Tabs; Pro has all seven), and any
module a plan leaves out can be bought as an add-on; a demo is entitled to
everything while it is a demo, and converting it narrows it to its plan.
The tenant's Subscription tab sets both. What a café is entitled to is
enforced twice: its gateway answers `402 {"type":"module-off"}` on a
module's routes (`/api/inventory/*`, `/api/finance/*`, `/api/payroll/*`,
`/api/loyalty/*`, `/api/accounts/*`, and for Rooms `/api/stays/*` with the
room-only place routes), and its Branch.API clamps the owner's feature
switches so an unentitled module can never be switched on; the admin app
shows those switches locked with "not in your plan". Changing the
subscription only recreates the gateway (seconds); every service keeps
running. Billing is by hand for now: **Record payment** on the tab writes a
payment with its period and moves *paid through*, and that is the one
entry point a payment provider would call later. A daily sweep
(`SubscriptionSweepHour`, 6) marks a customer past due when the date
passes, mails the owner, and after the grace (`SubscriptionGraceDays`, 7,
or the tenant's own) suspends the tenant: its stack is stopped, the edge
answers every API call with `503 {"code":"paused"}` and the customer app
shows a paused page. **Start** refuses a suspended tenant; a recorded
payment (or **Resume**) brings it back.

An upgrade (`POST /tenants/{slug}/upgrade` with an image tag, or **Upgrade
all** on the platform page) takes a backup first (or reuses one fresher
than `BackupFreshMinutes`), re-stamps the compose on the new tag, and
waits five minutes for every service to answer; if they do not, the stack
goes back to the previous tag by itself and the tenant ends Running with
an amber "rolled back" note (audit `tenant.upgrade.rolledback`). **Roll
back** in the menu does the same by hand, while the previous tag is known.
A rollback restores the images, never the data: migrations are
forward-only, so a version that predates one is restored from the
pre-upgrade backup into a new slug instead (the dialog names it). Use
immutable tags in production; `latest` to `latest` has nothing to go back
to. **Upgrade all** takes an optional canary: it goes first, and the rest
run only while it stays Running on the new tag (`tenant.upgrade.skipped`
otherwise). The queue is serial, so a fleet of *n* stacks takes *n* × a
minute or so.

To bring the platform itself back on a new box: install this folder,
restore `controldb` and `keycloak` from the newest `_platform` backup
(`docker compose exec -T postgres pg_restore -U postgres --clean --if-exists
-d controldb < controldb.dump`, likewise `keycloak`), put each tenant's
backup under `tenants/{slug}/backups/`, and restore every tenant into its
own slug from the control app.

## Not yet

- The Chillax stack still deploys on its own (`.github/workflows/deploy.yml`);
  moving it here is the last step of Phase 3 in `docs/ninja-plan.md`.
- The Keycloak admin console is reachable from anywhere.
- Social sign-in per tenant (a café's own Google and Apple apps).
