# The platform on your laptop

The same shape as production (`../docker-compose.yml`), with three
differences: plain http, the domain `localhost` (browsers resolve
`cove.localhost` and `admin.cove.localhost` to this machine with no
hosts-file entry; Chrome, Edge and Firefox do, Safari does not), and images
built here for this machine's CPU instead of pulled from GHCR.

```
cd deploy/platform/local
.\build-images.ps1          # twelve service images, five web apps, the platform realm (10–20 min the first time)
docker compose up -d --build
```

Then `http://control.localhost`, sign in as `platform` / `Local123$`, and
create a tenant. Give it a slug like `cove` and, once its steps are done,
open:

| What | Where |
|---|---|
| Customer app | `http://cove.localhost` |
| Admin | `http://admin.cove.localhost` (the owner email you gave, temporary password on the tenant page) |
| Till | `http://pos.cove.localhost` |
| Kitchen | `http://kds.cove.localhost` |
| Keycloak | `http://auth.localhost` (admin / local) |

Docker Desktop needs about 3 GB of memory for the platform plus one tenant;
raise its limit if containers get killed. Stop the Aspire dev AppHost first
if it is running: they do not conflict on ports, but they do compete for
memory.

Tear down: `docker compose down -v` here removes the platform. Tenant
stacks are separate projects: destroy them from the control app first, or
`docker compose -p ninja-cove down -v`.
