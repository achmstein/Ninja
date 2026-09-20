# The platform on your laptop

The same shape as production (`../docker-compose.yml`), with two
differences: the domain `localhost` (browsers resolve `cove.localhost` and
`admin.cove.localhost` to this machine with no hosts-file entry; Chrome,
Edge and Firefox do, Safari does not) with certificates from Caddy's own
local CA, and images built here for this machine's CPU instead of pulled
from GHCR. It is https because Keycloak only sets Secure cookies; plain
http cannot sign anyone in.

```
cd deploy/platform/local
.\build-images.ps1          # twelve service images, five web apps, the platform realm (10–20 min the first time)
docker compose up -d --build
```

Then `https://control.localhost`, sign in as `platform` / `Local123$`, and
create a tenant. Give it a slug like `cove` and, once its steps are done,
open:

| What | Where |
|---|---|
| Customer app | `https://cove.localhost` |
| Admin | `https://admin.cove.localhost` (the owner email you gave, temporary password on the tenant page) |
| Till | `https://pos.cove.localhost` |
| Kitchen | `https://kds.cove.localhost` |
| Keycloak | `https://auth.localhost` (admin / local) |
| Mail | `http://localhost:8025` (Mailpit: every mail the platform and the realms send) |
| Bucket | `http://localhost:9001` (MinIO console, minioadmin / minioadmin: the offsite copies) |

The control app's Capacity tab reads Docker Desktop's VM, not the laptop:
with two stacks up it will say there is room for none, and a third stamp
needs the force switch. Backups land in the `ninja-local` tenants volume
(`/opt/ninja/tenants/{slug}/backups` inside the control container).

From a shell, `*.localhost` does not resolve and Caddy's CA is not trusted:
`curl --resolve control.localhost:443:127.0.0.1 -k https://control.localhost/api/control/platform`.

Docker Desktop needs about 3 GB of memory for the platform plus one tenant;
raise its limit if containers get killed. Stop the Aspire dev AppHost first
if it is running: they do not conflict on ports, but they do compete for
memory.

Tear down: `docker compose down -v` here removes the platform. Tenant
stacks are separate projects: destroy them from the control app first, or
`docker compose -p ninja-cove down -v`.
