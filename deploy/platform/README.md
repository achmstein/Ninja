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
  platform/apps/       the native apps' download page (index.html) and the APKs mobile-deploy.yml drops beside it
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
platform box, installs docker on a fresh box, dumps `controldb` and
`keycloak` on the box before anything changes (under
`tenants/_platform/pre-deploy/`, the last ten kept), brings the `ninja`
project up, and smokes `auth.`, `control.` and the control plane's `tls/ask`
through the edge. Inputs: the image tag (a release, `vYYYY.MM.DD`; anything
else needs `allow_unreleased`, which is for a staging box), the GitHub
environment (`platform`, or `platform-staging` for a second box with its
own secrets and domain), whether to rebuild the web apps. It needs the `platform` environment with secrets
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
Kds; Starter adds Spaces, Loyalty and Tabs; Pro has all seven), and any
module a plan leaves out can be bought as an add-on; a demo is entitled to
everything while it is a demo, and converting it narrows it to its plan.
The tenant's Subscription tab sets both. What a café is entitled to is
enforced twice: its gateway answers `402 {"type":"module-off"}` on a
module's routes (`/api/inventory/*`, `/api/finance/*`, `/api/payroll/*`,
`/api/loyalty/*`, `/api/accounts/*`, and for Spaces `/api/stays/*` with the
room-only place routes), and its Branch.API clamps the owner's feature
switches so an unentitled module can never be switched on; the admin app
shows those switches locked with "not in your plan". Changing the
subscription re-stamps the stack: the gateway recreates on its new routes,
the containers of modules that left the plan are removed and their queues
deleted on the broker (a module bought back starts from then, nothing is
replayed), and one that joined is created. Billing is by hand for now:
**Record payment** on the tab writes a
payment with its period and moves *paid through*, and that is the one
entry point a payment provider would call later. A daily sweep
(`SubscriptionSweepHour`, 6) marks a customer past due when the date
passes, mails the owner, and after the grace (`SubscriptionGraceDays`, 7,
or the tenant's own) suspends the tenant: its stack is stopped, the edge
answers every API call with `503 {"code":"paused"}` and the customer app
shows a paused page. **Start** refuses a suspended tenant; a recorded
payment (or **Resume**) brings it back.

A release is a git tag `vYYYY.MM.DD` (or any `v…`) pushed to the repo:
`docker-build.yml` builds all twelve service images and the control image
with that tag and moves `latest` to it. A manual run of the workflow
builds work in progress under the commit's sha and `latest` instead; a sha
is on the services that changed, not necessarily all twelve, so it is not
something to upgrade a fleet to. Every ten minutes
(`UpdateRefreshSeconds`), and after every stamp, the control plane reads
what each stack's containers run, what each tag resolves to (on the box,
and in the registry when it pulls), and which release tags all twelve
images carry. A tenant whose service runs an older build than its tag
points to now, or that stands on a release older than the newest, shows
**Update available** in the table and on its page, with an **Upgrade**
button up front; the platform page counts them by its title
(`GET /platform/updates` has the lists). While the packages are private,
`REGISTRY_USER` and `REGISTRY_TOKEN` (a PAT with `read:packages`) let the
control plane read the registry; without them, and when the images are
built on the box, only the box's own copies are compared.

An upgrade (`POST /tenants/{slug}/upgrade` with an image tag, or **Upgrade
all** on the platform page) takes a backup first (or reuses one fresher
than `BackupFreshMinutes`), re-stamps the compose on the new tag, and
waits five minutes for every service to answer; if they do not, the stack
goes back to the previous tag by itself and the tenant ends Running with
an amber "rolled back" note (audit `tenant.upgrade.rolledback`). The tag
is picked, not typed: the dialog offers the releases, the default and every
tag a tenant stands or stood on, with the newer release (or the tenant's
own tag, to re-pull it) chosen already. **Upgrade all** ticks the tenants
behind and lets the rest be ticked too (`Slugs` on the request). **Roll
back** in the menu does the same by hand, while the previous tag is known.
A rollback restores the images, never the data: migrations are
forward-only, so a version that predates one is restored from the
pre-upgrade backup into a new slug instead (the dialog names it). Use
release tags: the deploy workflow refuses anything else without
`allow_unreleased`, and `latest` to `latest` has nothing to go back to. **Upgrade all** takes an optional canary: it goes first, and the rest
run only while it stays Running on the new tag (`tenant.upgrade.skipped`
otherwise). Stamps run one at a time, so a fleet of *n* stacks takes *n* × a
minute or so.

Every job (a stamp, a stop, an upgrade, a backup) is a row in `controldb`,
not something held in memory: a restart of the control plane loses nothing,
and a job that was running when the process died is queued again once
(every step is idempotent) and abandoned the second time. A tenant left
Provisioning, Upgrading or Destroying with nothing queued for it is marked
Failed with the reason, so the control app offers a retry instead of a
stamp that never ends. Two lanes: **stamps** (compose up and down,
upgrades, stops) go one at a time; **backups** run beside them, so a
nightly run never holds a suspension, and a backup waits while its own
tenant is mid-stamp. What an admin or a sweep needs now (stop, suspend,
destroy, start, resume) goes before a stamp already waiting. The same job
queued twice is one row. The **Queue** tab on the platform page shows each
lane's running job, what waits behind it (with a way to take a queued job
off the line), and what ran lately; a tenant's page names its own. Mail
goes through an outbox table the same way, written in the same save as
whatever it announces, so the owner's first password cannot be lost
between a stamp finishing and the SMTP call.

To bring the platform itself back on a new box: install this folder,
restore `controldb` and `keycloak` from the newest `_platform` backup
(`docker compose exec -T postgres pg_restore -U postgres --clean --if-exists
-d controldb < controldb.dump`, likewise `keycloak`), put each tenant's
backup under `tenants/{slug}/backups/`, and restore every tenant into its
own slug from the control app.

## What watches the platform

`control-api`'s `/health` (inside the network; the container's own
healthcheck reads `/alive`) says more than "up": each lane's worker has
gone round in the last two minutes, the tenants drive is above
`MIN_FREE_DISK_MB` (unhealthy below it, degraded within twice it), the
platform's own backup is not older than 26 hours (degraded), and Keycloak
answers on its management port. Caddy comes up only once the control plane
is healthy, and docker restarts a container that stops answering.

A watchdog looks once a minute and once an hour compares the record with
what docker runs. What it finds is a red line at the top of the platform
page until it clears, an audit row the first time, and, with `MAIL_OPS_TO`
set, one mail: the drive below its floor (`ops-disk-low`: no backup is taken
and no stack is stamped until space is freed), a lane that has stopped
(`ops-worker-dead`: restart the control plane, every job survives it), a
job running past `JobTimeoutMinutes` (`ops-job-stuck`, 45; nothing is
killed), a tenant Running on the record with none of its containers up
(`ops-stack-down`; nothing is changed), and a compose project no record
explains (`platform.orphan-stack`, audit only).

The capacity guard counts three things before a stamp: memory (the
footprint beyond the reserve), Postgres connections (every running stack
is eleven services holding `SERVICE_CONNECTIONS_ESTIMATE` each, plus the
platform's own forty, against `POSTGRES_MAX_CONNECTIONS`, which the
`postgres` service is started with; `SERVICE_POOL_SIZE` is the ceiling
stamped into each service's connection string, not what is counted), and the drive (the floor
plus a quarter of a footprint). The Capacity tab shows all three; the
refusal says which one. The shared services carry memory limits of their
own (`POSTGRES_MEMORY`, `KEYCLOAK_MEMORY`, `EVENTBUS_MEMORY`,
`CONTROL_MEMORY`, `CADDY_MEMORY`), so a runaway there ends at its cap too.

Every backup's manifest carries a SHA-256 per file; a copy that does not
match never leaves the box and a dump that does not match is never
restored. What the platform can lose is a day: the backups are nightly
logical dumps, and there is no WAL archiving. A café that cannot afford a
day should get a backup on demand before anything risky, and the weekly
restore drill (`RESTORE_DRILL_ENABLED`, on by default in `.env.example`)
is the proof the dumps restore. `.github/workflows/platform-uptime.yml`
probes the auth host, the control app and the control plane through the
edge every fifteen minutes from outside, plus the tenant API hosts in the
`PLATFORM_PROBE_HOSTS` repository variable, and checks the admin console
is not reachable from there.

## Keys, roles and who may sign in

The tenants' secrets on the record (each stack's database and broker
passwords, its realm's client secrets, the owner's first password) are
encrypted at rest under `PLATFORM_ENCRYPTION_KEY` (`openssl rand -base64
32`), so a dump of `controldb` is not a dump of every café's credentials.
The first start with the key rewrites rows written before it (audit
`platform.secrets.encrypted`). The key is part of a platform restore:
without it, a restored `controldb` has no usable secrets, so keep it with
the backups and not only in `.env`. The owner's first password leaves the
record once the owner has changed it (Keycloak stops asking them to) or
after a month, whichever comes first (`owner.password.cleared`).

The control plane connects to its own database as the role `control`
(`CONTROL_DB_PASSWORD`), which owns `controldb` and nothing else; the
superuser is only for stamping tenants. `control-role.sh` creates the role
on a fresh box and, run by the deploy workflow on a box that predates it,
hands `controldb` over. Keycloak's admin API is used as the master-realm
user `platform-control` (`KEYCLOAK_CONTROL_PASSWORD`), which the deploy
workflow creates with the `admin` role, so the bootstrap `admin` is only for
people and can be rotated on its own; the token is fetched once per
lifetime, not per call.

The `ninja` realm asks everyone for a second factor: the OTP form is
required in the browser flow, so a user without one sets it up at the next
sign-in. Access tokens last fifteen minutes (the control app renews them
silently), a session idles out after eight hours and ends after a day. The
control API accepts only tokens minted for it (`aud=control`). The Keycloak
admin console (`auth.{domain}/admin/*`) answers only from
`ADMIN_ALLOW_CIDR` (space-separated networks; nowhere until set). The two
anonymous endpoints, the edge's certificate question and the
sign-in-as-owner link, are metered per address; everything else per admin.

The assistant key reaches only the stacks whose plan is listed in
`ASSISTANT_PLAN_0`, `ASSISTANT_PLAN_1`, … (`Pro` by default; a demo always
gets it), so one café's compromised service does not hand the platform's
key to everyone; the rest run with the assistant off.

## Tests

`tests/Control.UnitTests` covers the pure parts (templates, naming, the
queue over an in-memory record, the sweeps' decisions, the mail, the
secrets) and runs in the PR's .NET job. `tests/Control.IntegrationTests`
runs the real adapters against Postgres, RabbitMQ and Keycloak in
containers (Testcontainers; docker on the box): the role and hand-over SQL,
`rabbitmqctl`, the admin API with a realm from the template, an owner, a
control token and an impersonation, and `pg_dump` into `pg_restore` across
two tenants. It is its own PR job and, locally, `dotnet test
tests/Control.IntegrationTests`. `src/control_web` has vitest for its pure
modules (`npm test`), and `e2e/ControlPlane.spec.ts` drives the control app
against the dry-run AppHost: sign in, stamp a demo, every step Done,
destroy. With the AppHost already running (`dotnet run --project
src/Ninja.AppHost`), `npx playwright test -c playwright.control.config.ts`
runs it on its own.

## Not yet

- The Chillax stack still deploys on its own (`.github/workflows/deploy.yml`);
  moving it here is the last step of Phase 3 in `docs/ninja-plan.md`.
- Social sign-in per tenant (a café's own Google and Apple apps).
- One assistant key for every entitled stack: no per-tenant keys or quotas.
- WAL archiving (point-in-time recovery): the backups are nightly dumps, so
  a day is what can be lost.
- The offsite tarballs are not encrypted by the platform; the bucket's own
  server-side encryption is the control.
- The control container runs as root with the host's docker socket, which
  the design needs (compose, exec, run); no socket proxy in front of it.
- The control app keeps its tokens in localStorage.
