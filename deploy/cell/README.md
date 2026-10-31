# A cell: a node beyond the platform's own box

A cell runs tenant stacks for the control plane on another box
(`docs/multi-server-plan.md`). It holds:

- its own Postgres and RabbitMQ for its stacks
- an ingress, which the platform's edge sends a tenant's traffic to
- the node agent, the only way the control plane drives it

All of them listen on the box's WireGuard address only.

```
platform box (10.66.0.1)                    cell (10.66.0.N)
  Caddy edge ──── tenant-routes.caddy ────▶  ingress :8088 → {slug}-gateway:5000
  control-api ─── mTLS, pinned both ways ──▶  agent   :7443 → docker, postgres, rabbit
  internal edge :8090 ◀──── stacks' Keycloak, AI gateway, Talabat relay
```

## Once: the control plane's client certificate

Every agent answers this certificate only, pinned by its SHA-256 thumbprint.
Make it once, keep it with the platform's other secrets, and never commit it:

```bash
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 3650 \
  -subj "/CN=ninja-control-plane" -keyout control.key -out control.crt
openssl pkcs12 -export -inkey control.key -in control.crt -out control.pfx -passout pass:CHOOSE-A-PASSWORD
base64 -w0 control.pfx   # → the NODE_AGENT_CLIENT_PFX secret
rm control.key control.pfx
```

Set these in the GitHub environment:

- **Secrets:** `NODE_AGENT_CLIENT_PFX` (the base64) and `NODE_AGENT_CLIENT_PASSWORD`.
- **Variable:** `PLATFORM_WG_IP=10.66.0.1`.

Then run **Deploy Platform**. It puts the certificate where the control plane
reads it, and publishes the internal edge on the WireGuard address.

## Each node: Setup Node

Run **Setup Node** (`.github/workflows/setup-node.yml`) with the node's name,
public address, SSH user and private address (`10.66.0.2`, `10.66.0.3`, …).
The workflow:

1. Gives the node Docker and WireGuard.
2. Makes the node a peer of the platform box.
3. Opens only SSH and WireGuard on the node.
4. Writes this folder to `/opt/ninja/cell`, with secrets made on the node.
5. Makes the agent's certificate.
6. Brings the cell up.

Its summary is the body to register the node with:

```
POST /api/control/platform/nodes        → the node, cordoned
POST /api/control/platform/nodes/{id}/ping
PATCH /api/control/platform/nodes/{id}  {"status":"Active"}   (or the control app's Nodes tab)
```

The tenant images are built for arm64. An amd64 node runs the agent, but
cannot run stacks until the images are built for amd64 as well.

## Running it again

Every step can be repeated safely. The node keeps its secrets, its agent
certificate (and so its pin) and its data; the agent's tag and the control
plane's pin are updated. To replace the agent's certificate, delete
`/opt/ninja/cell/certs/agent.pfx`, run the workflow again, and register the
new pin.
