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
  tenants/{slug}/      docker-compose.yaml, .env, logo.png — written by the control plane
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

## What a stamp does

`databases` (eleven `{slug}_*db` on the shared Postgres) → `broker` (vhost
`{slug}` with the dead-letter policy) → `realm` (from
`Templates/tenant-realm.json`: the eight clients, the `ninja-control` service
account) → `stack` (compose up, images pulled) → `health` (every service
answers through the gateway) → `brand` (name, color, logo through the
stack's own API) → `owner` (the first Owner in the realm, temporary
password shown once in the control app).

Demos carry an expiry: stopped when it passes, destroyed a week later.
Destroy is the reverse: compose down with volumes, realm, vhost, databases.

## Not yet

- The Chillax stack still deploys on its own (`.github/workflows/deploy.yml`);
  moving it here is the last step of Phase 3 in `docs/ninja-plan.md`.
- Backups per tenant (`deploy/backup.sh` dumps every database on the server,
  which now covers every tenant, but the per-tenant `*-branch-uploads`
  volumes are not in it).
- Social sign-in per tenant (a café's own Google and Apple apps).
